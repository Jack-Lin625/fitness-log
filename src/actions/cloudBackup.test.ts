import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter } from '../data/localStorageAdapter';
import { createEmptyData } from '../data/migrations';
import { Repository } from '../data/repository';
import type { CloudFile } from '../lib/googleDrive';
import { DriveAuthError } from '../lib/googleDrive';
import { installMemoryStorage } from '../test/memoryStorage';
import type { WorkoutSession } from '../types/models';
import { CloudBackup, type CloudDeps } from './cloudBackup';

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

async function setup(sessions: WorkoutSession[] = []) {
  const repo = new Repository(new LocalStorageAdapter());
  await repo.init();
  for (const s of sessions) await repo.saveSession(s);
  const drive = fakeDrive();
  const deps: CloudDeps = {
    repo,
    requestToken: vi.fn(async () => ({ token: 'tok', expiresAt: Date.now() + 3_600_000 })),
    revoke: vi.fn(async () => undefined),
    findBackup: drive.findBackup,
    uploadBackup: drive.uploadBackup,
    downloadBackup: drive.downloadBackup,
    confirmRestore: vi.fn(async () => true),
    storage: localStorage,
  };
  const cloud = new CloudBackup(deps);
  cloud.start();
  return { repo, drive, deps, cloud };
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
