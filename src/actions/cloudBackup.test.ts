import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter } from '../data/localStorageAdapter';
import { createEmptyData } from '../data/migrations';
import { Repository } from '../data/repository';
import type { CloudFile } from '../lib/googleDrive';
import { DriveAuthError } from '../lib/googleDrive';
import { installMemoryStorage } from '../test/memoryStorage';
import type { WorkoutSession } from '../types/models';
import { CloudBackup, type CloudDeps, type PhotoDeps } from './cloudBackup';

const storage = installMemoryStorage();

const workout = (id: string): WorkoutSession => ({
  id,
  date: '2026-10-20',
  createdAt: 1,
  updatedAt: 1,
  exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }],
});

/** 假的 Google Drive：記住一個檔案 */
function fakeDrive() {
  let file: (CloudFile & { content: string }) | null = null;
  let tick = 0;
  return {
    get file() {
      return file;
    },
    /** 模擬別台裝置上傳 */
    putFromOtherDevice(content: string) {
      file = { id: 'f1', modifiedTime: `other-${++tick}`, size: content.length, content };
    },
    findBackup: vi.fn(async () => (file ? { id: file.id, modifiedTime: file.modifiedTime, size: file.size } : null)),
    uploadBackup: vi.fn(async (_t: string, content: string, fileId?: string) => {
      file = { id: fileId ?? 'f1', modifiedTime: `mine-${++tick}`, size: content.length, content };
      return { id: file.id, modifiedTime: file.modifiedTime, size: file.size };
    }),
    downloadBackup: vi.fn(async () => file?.content ?? ''),
  };
}

/** 假的照片：雲端與這台裝置各一份 */
function fakePhotos() {
  const remote = new Map<string, Blob>(); // 雲端檔案 id（= cloud-<照片 id>）→ 內容
  const local = new Map<string, Blob>();
  const deps: PhotoDeps = {
    list: vi.fn(async () => new Map([...remote.keys()].map((fileId) => [fileId.slice('cloud-'.length), fileId]))),
    upload: vi.fn(async (_t: string, id: string, blob: Blob) => void remote.set(`cloud-${id}`, blob)),
    download: vi.fn(async (_t: string, fileId: string) => remote.get(fileId)!),
    remove: vi.fn(async (_t: string, fileId: string) => void remote.delete(fileId)),
    localIds: vi.fn(async () => new Set(local.keys())),
    getLocal: vi.fn(async (id: string) => local.get(id)),
    saveLocal: vi.fn(async (id: string, blob: Blob) => void local.set(id, blob)),
  };
  return { remote, local, deps };
}

async function setup(sessions: WorkoutSession[] = []) {
  const repo = new Repository(new LocalStorageAdapter());
  await repo.init();
  for (const s of sessions) await repo.saveSession(s);
  const drive = fakeDrive();
  const photos = fakePhotos();
  const deps: CloudDeps = {
    repo,
    requestToken: vi.fn(async () => ({ token: 'tok', expiresAt: Date.now() + 3_600_000 })),
    revoke: vi.fn(async () => undefined),
    findBackup: drive.findBackup,
    uploadBackup: drive.uploadBackup,
    downloadBackup: drive.downloadBackup,
    confirmRestore: vi.fn(async () => true),
    photos: photos.deps,
    storage: localStorage,
  };
  const cloud = new CloudBackup(deps);
  cloud.start();
  return { repo, drive, deps, cloud, photos };
}

describe('CloudBackup', () => {
  beforeEach(() => storage.reset());
  afterEach(() => vi.useRealTimers());

  it('連線後上傳目前的資料（不含草稿），並記下狀態', async () => {
    const { cloud, drive } = await setup([workout('a')]);
    await cloud.connect();
    expect(JSON.parse(drive.file!.content)).toMatchObject({ sessions: [{ id: 'a' }], activeDraft: null });
    expect(cloud.state.meta).toMatchObject({ enabled: true, dirty: false, fileId: 'f1', lastUploadedModified: 'mine-1' });
    expect(JSON.parse(localStorage.getItem('fitlog:cloud')!)).toMatchObject({ enabled: true });
  });

  it('資料變更後自動上傳；草稿變動不算', async () => {
    vi.useFakeTimers();
    const { cloud, repo, drive } = await setup([workout('a')]);
    await cloud.connect();
    drive.uploadBackup.mockClear();

    await repo.saveDraft({ id: 'd', date: '2026-10-20', exercises: [], note: '', startedAt: 1 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.uploadBackup).not.toHaveBeenCalled();

    await repo.saveSession(workout('b'));
    expect(cloud.state.meta.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.uploadBackup).toHaveBeenCalledTimes(1);
    expect(JSON.parse(drive.file!.content).sessions).toHaveLength(2);
    expect(cloud.state.meta.dirty).toBe(false);
  });

  it('權杖過期時不在背景上傳，只標記有變更（等使用者按上傳）', async () => {
    vi.useFakeTimers();
    const { cloud, repo, drive, deps } = await setup([workout('a')]);
    await cloud.connect();
    vi.setSystemTime(Date.now() + 2 * 3_600_000);
    drive.uploadBackup.mockClear();

    await repo.saveSession(workout('b'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.uploadBackup).not.toHaveBeenCalled();
    expect(cloud.state.meta.dirty).toBe(true);

    await cloud.uploadNow();
    expect(deps.requestToken).toHaveBeenLastCalledWith(false);
    expect(drive.uploadBackup).toHaveBeenCalledTimes(1);
  });

  it('新手機（沒有資料）連線時，雲端有備份：不上傳空白資料，問要不要還原，還原後資料回來', async () => {
    const { cloud, repo, drive } = await setup();
    drive.putFromOtherDevice(JSON.stringify({ ...createEmptyData(), sessions: [workout('old')] }));

    await cloud.connect();
    expect(drive.uploadBackup).not.toHaveBeenCalled();
    expect(cloud.state.decision?.kind).toBe('restore');

    await cloud.resolve('useCloud');
    expect(repo.getSessions().map((s) => s.id)).toEqual(['old']);
    expect(cloud.state.decision).toBeNull();
    expect(cloud.state.meta).toMatchObject({ dirty: false, lastUploadedModified: drive.file!.modifiedTime });
  });

  it('雲端被別台裝置改過：暫停自動上傳，讓使用者選；選「用這支手機」才覆蓋', async () => {
    vi.useFakeTimers();
    const { cloud, repo, drive } = await setup([workout('a')]);
    await cloud.connect();
    drive.putFromOtherDevice(JSON.stringify({ ...createEmptyData(), sessions: [workout('x')] }));
    drive.uploadBackup.mockClear();

    await repo.saveSession(workout('b'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.uploadBackup).not.toHaveBeenCalled();
    expect(cloud.state.decision?.kind).toBe('conflict');

    // 有待決定的事時，之後的變更也不會自動上傳
    await repo.saveSession(workout('c'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.uploadBackup).not.toHaveBeenCalled();

    await cloud.resolve('useLocal');
    expect(JSON.parse(drive.file!.content).sessions).toHaveLength(3);
    expect(cloud.state.decision).toBeNull();
  });

  it('使用者取消還原時資料不變', async () => {
    const { cloud, repo, drive, deps } = await setup([workout('a')]);
    drive.putFromOtherDevice(JSON.stringify({ ...createEmptyData(), sessions: [workout('x')] }));
    vi.mocked(deps.confirmRestore).mockResolvedValueOnce(false);
    await cloud.restoreFromCloud();
    expect(repo.getSessions().map((s) => s.id)).toEqual(['a']);
  });

  it('資料讀取失敗（以空白資料啟動）時絕不自動上傳', async () => {
    vi.useFakeTimers();
    storage.store.set('fitlog:data', '{broken');
    storage.store.set('fitlog:cloud', JSON.stringify({ enabled: true, dirty: true, token: 'tok', tokenExpiresAt: Date.now() + 3_600_000 }));
    const { drive } = await setup();
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.findBackup).not.toHaveBeenCalled();
    expect(drive.uploadBackup).not.toHaveBeenCalled();
  });

  it('授權被撤銷（401）：清掉權杖並顯示錯誤，資料仍標記為未上傳', async () => {
    const { cloud, drive } = await setup([workout('a')]);
    await cloud.connect();
    drive.findBackup.mockRejectedValueOnce(new DriveAuthError());
    await expect(cloud.uploadNow()).rejects.toBeInstanceOf(DriveAuthError);
    expect(cloud.state.meta.token).toBeUndefined();
    expect(cloud.state.error).toContain('授權已過期');
  });

  it('中斷連線：撤銷授權、清除這台的狀態', async () => {
    const { cloud, deps } = await setup([workout('a')]);
    await cloud.connect();
    await cloud.disconnect();
    expect(deps.revoke).toHaveBeenCalledWith('tok');
    expect(cloud.state.meta.enabled).toBe(false);
    expect(localStorage.getItem('fitlog:cloud')).toBeNull();
  });
});

describe('CloudBackup.refreshOnTap（按「完成」時順便更新授權）', () => {
  beforeEach(() => storage.reset());
  afterEach(() => vi.useRealTimers());

  it('授權過期時，在按下的當下就開啟 Google 視窗（不能等任何 await，否則瀏覽器會擋），之後自動上傳', async () => {
    vi.useFakeTimers();
    const { cloud, repo, drive, deps } = await setup([workout('a')]);
    await cloud.connect();
    vi.setSystemTime(Date.now() + 2 * 3_600_000);
    vi.mocked(deps.requestToken).mockClear();
    drive.uploadBackup.mockClear();

    cloud.refreshOnTap();
    // 同步呼叫：還沒經過任何 await
    expect(deps.requestToken).toHaveBeenCalledTimes(1);
    expect(deps.requestToken).toHaveBeenCalledWith(false);

    await repo.saveSession(workout('b'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.uploadBackup).toHaveBeenCalledTimes(1);
    expect(JSON.parse(drive.file!.content).sessions).toHaveLength(2);
  });

  it('授權還有效、沒開雲端備份、或有待決定的事時不開視窗', async () => {
    const { cloud, deps } = await setup([workout('a')]);
    cloud.refreshOnTap(); // 還沒連線
    expect(deps.requestToken).not.toHaveBeenCalled();
    await cloud.connect();
    vi.mocked(deps.requestToken).mockClear();
    cloud.refreshOnTap(); // 授權還有效
    expect(deps.requestToken).not.toHaveBeenCalled();
  });

  it('使用者關掉視窗時不丟出錯誤，資料仍標記為未上傳', async () => {
    vi.useFakeTimers();
    const { cloud, repo, deps } = await setup([workout('a')]);
    await cloud.connect();
    vi.setSystemTime(Date.now() + 2 * 3_600_000);
    vi.mocked(deps.requestToken).mockRejectedValueOnce(new Error('已取消 Google 登入'));
    cloud.refreshOnTap();
    await repo.saveSession(workout('b'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(cloud.state.meta.dirty).toBe(true);
    expect(cloud.state.busy).toBeNull();
  });
});

describe('CloudBackup 照片同步', () => {
  beforeEach(() => storage.reset());
  afterEach(() => vi.useRealTimers());

  const jpeg = (n: number) => new Blob([new Uint8Array([n])], { type: 'image/jpeg' });
  const meal = (id: string, photoId: string) => ({ id, date: '2026-10-20', meal: 'lunch' as const, name: '便當', kcal: 700, photoId, createdAt: 1 });

  it('上傳紀錄後，把紀錄用到的照片上傳；沒用到的本機照片不傳', async () => {
    const { cloud, repo, photos } = await setup([workout('a')]);
    photos.local.set('p1', jpeg(1));
    photos.local.set('orphan', jpeg(9));
    await repo.saveFoodEntry(meal('f1', 'p1'));
    await repo.saveBodyMetric({ id: 'b1', date: '2026-10-20', photos: [{ pose: 'front', photoId: 'p1' }] });
    await cloud.connect();
    await cloud.photosSettled();
    expect([...photos.remote.keys()]).toEqual(['cloud-p1']);
    expect(cloud.state.photos).toBeNull();

    // 已經在雲端的不會再傳一次
    await cloud.uploadNow();
    await cloud.photosSettled();
    expect(photos.deps.upload).toHaveBeenCalledTimes(1);
  });

  it('刪掉紀錄後，雲端的照片也跟著刪掉', async () => {
    vi.useFakeTimers();
    const { cloud, repo, photos } = await setup([workout('a')]);
    photos.local.set('p1', jpeg(1));
    await repo.saveFoodEntry(meal('f1', 'p1'));
    await cloud.connect();
    await cloud.photosSettled();
    expect(photos.remote.size).toBe(1);

    await repo.deleteFoodEntry('f1');
    await vi.advanceTimersByTimeAsync(5000);
    await cloud.photosSettled();
    expect(photos.remote.size).toBe(0);
  });

  it('新手機從雲端還原：照片也下載回來', async () => {
    const { cloud, repo, drive, photos } = await setup();
    photos.remote.set('cloud-p1', jpeg(1));
    photos.remote.set('cloud-p2', jpeg(2));
    drive.putFromOtherDevice(
      JSON.stringify({ ...createEmptyData(), foodEntries: [meal('f1', 'p1')], bodyMetrics: [{ id: 'b', date: '2026-10-19', photos: [{ pose: 'side', photoId: 'p2' }] }] }),
    );
    await cloud.connect();
    await cloud.resolve('useCloud');
    await cloud.photosSettled();
    expect(repo.getData().foodEntries).toHaveLength(1);
    expect([...photos.local.keys()].sort()).toEqual(['p1', 'p2']);
    expect(photos.deps.remove).not.toHaveBeenCalled();
  });

  it('啟動時只補傳、補下載，不刪雲端的照片（雲端可能有別台的新紀錄）', async () => {
    storage.store.set('fitlog:cloud', JSON.stringify({ enabled: true, dirty: false, token: 'tok', tokenExpiresAt: Date.now() + 3_600_000 }));
    const repo = new Repository(new LocalStorageAdapter());
    await repo.init();
    await repo.saveFoodEntry(meal('f1', 'p1'));
    const photos = fakePhotos();
    photos.local.set('p1', jpeg(1));
    photos.remote.set('cloud-other', jpeg(5));
    const drive = fakeDrive();
    const cloud = new CloudBackup({
      repo,
      requestToken: vi.fn(),
      revoke: vi.fn(),
      ...drive,
      confirmRestore: vi.fn(),
      photos: photos.deps,
      storage: localStorage,
    });
    cloud.start();
    await cloud.photosSettled();
    expect([...photos.remote.keys()].sort()).toEqual(['cloud-other', 'cloud-p1']);
  });

  it('照片上傳失敗：記下原因，紀錄的備份不受影響；下次成功就清掉', async () => {
    const { cloud, repo, photos, drive } = await setup([workout('a')]);
    photos.local.set('p1', jpeg(1));
    await repo.saveFoodEntry(meal('f1', 'p1'));
    vi.mocked(photos.deps.upload).mockRejectedValueOnce(new Error('Google Drive 空間已滿'));
    await cloud.connect();
    await cloud.photosSettled();
    expect(drive.file).not.toBeNull();
    expect(cloud.state.meta.dirty).toBe(false);
    expect(cloud.state.photoError).toBe('Google Drive 空間已滿');

    await cloud.uploadNow();
    await cloud.photosSettled();
    expect(cloud.state.photoError).toBeNull();
    expect(photos.remote.size).toBe(1);
  });

  it('照片同步時授權過期：清掉權杖，不顯示錯誤（下次按按鈕再繼續）', async () => {
    const { cloud, repo, photos } = await setup([workout('a')]);
    photos.local.set('p1', jpeg(1));
    await repo.saveFoodEntry(meal('f1', 'p1'));
    vi.mocked(photos.deps.list).mockRejectedValueOnce(new DriveAuthError());
    await cloud.connect();
    await cloud.photosSettled();
    expect(cloud.state.meta.token).toBeUndefined();
    expect(cloud.state.photoError).toBeNull();
  });
});
