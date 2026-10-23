/**
 * Google Drive 自動雲端備份
 *
 * - 資料一有變更（訓練、飲食、體態、設定…）就標記「有變更未上傳」，幾秒後自動上傳。
 * - 存取權杖約 1 小時有效；過期時不能在背景自動重新取得（Google 的視窗必須由使用者按按鈕開啟），
 *   這時紀錄頁會顯示「上傳到 Google Drive」按鈕，按一下就好。
 * - 上傳前一定先檢查雲端的檔案（規則見 lib/cloudSync.ts），不會用空白資料或舊資料蓋掉雲端備份。
 * - 照片（飲食、體態）每張存成一個檔案，資料上傳後在背景同步：新照片上傳、別台的照片下載、
 *   紀錄已經用不到的照片從雲端刪除。照片同步不擋其他操作。
 */
import type { Repository } from '../data/repository';
import { migrate } from '../data/migrations';
import {
  decideSync,
  EMPTY_META,
  hasValidToken,
  parseMeta,
  planPhotoSync,
  referencedPhotoIds,
  type CloudMeta,
  type SyncDecision,
} from '../lib/cloudSync';
import { errorMessage } from '../lib/errors';
import { toBackupJson } from '../lib/exporters';
import type { AccessToken } from '../lib/googleAuth';
import { DriveAuthError, type CloudFile } from '../lib/googleDrive';
import { createStore, type Store } from '../lib/store';
import type { AppData } from '../types/models';

const META_KEY = 'fitlog:cloud';
/** 資料變更後等這麼久才上傳，連續操作只上傳一次 */
const UPLOAD_DELAY = 3000;

export interface CloudState {
  meta: CloudMeta;
  busy: 'connect' | 'upload' | 'restore' | null;
  /** 需要使用者決定：從雲端還原，或雲端與這台的資料不同 */
  decision: Extract<SyncDecision, { kind: 'restore' | 'conflict' }> | null;
  /** 上一次失敗的原因 */
  error: string | null;
  /** 照片同步的進度（同步中才有） */
  photos: { done: number; total: number } | null;
  /** 上一次照片同步失敗的原因 */
  photoError: string | null;
}

/** 照片的讀寫：雲端（Google Drive）與這台裝置（IndexedDB） */
export interface PhotoDeps {
  list: (token: string) => Promise<Map<string, string>>;
  upload: (token: string, id: string, blob: Blob) => Promise<void>;
  download: (token: string, fileId: string) => Promise<Blob>;
  remove: (token: string, fileId: string) => Promise<void>;
  localIds: () => Promise<Set<string>>;
  getLocal: (id: string) => Promise<Blob | undefined>;
  saveLocal: (id: string, blob: Blob) => Promise<void>;
}

export interface CloudDeps {
  repo: Repository;
  requestToken: (firstTime: boolean) => Promise<AccessToken>;
  /** 先在背景載入授權程式（讓之後按按鈕時能立刻開啟登入視窗） */
  preloadAuth?: () => void;
  revoke: (token: string) => Promise<void>;
  findBackup: (token: string) => Promise<CloudFile | null>;
  uploadBackup: (token: string, json: string, fileId?: string) => Promise<CloudFile>;
  downloadBackup: (token: string, fileId: string) => Promise<string>;
  /** 還原前確認（會取代這台裝置的資料） */
  confirmRestore: (cloud: CloudFile, incoming: AppData) => Promise<boolean>;
  /** 照片同步；沒有就只備份紀錄 */
  photos?: PhotoDeps;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

/** 有沒有值得備份的資料（只有預設設定的全新 App 不算） */
export function hasUserData(d: Readonly<AppData>): boolean {
  return (
    d.sessions.length + d.bodyMetrics.length + d.customExercises.length + d.foodEntries.length + d.templates.length > 0
  );
}

/** 會寫進備份檔的欄位（草稿不備份，草稿變動不算資料變更） */
const BACKED_UP: (keyof AppData)[] = [
  'customExercises',
  'sessions',
  'bodyMetrics',
  'settings',
  'nutritionProfile',
  'foodEntries',
  'templates',
  'foodFavorites',
];

export class CloudBackup {
  readonly store: Store<CloudState>;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private snapshot: unknown[] = [];
  private photoTask: Promise<void> | null = null;
  /** 排隊中的照片同步（值為是否刪除雲端用不到的照片）；null 表示沒有排隊 */
  private photoQueued: boolean | null = null;

  constructor(private readonly deps: CloudDeps) {
    this.store = createStore<CloudState>({
      meta: this.readMeta(),
      busy: null,
      decision: null,
      error: null,
      photos: null,
      photoError: null,
    });
  }

  get state(): CloudState {
    return this.store.get();
  }

  /** App 啟動後呼叫一次：開始監看資料變更；有未上傳的變更且權杖還有效就上傳 */
  start(): void {
    this.snapshot = this.takeSnapshot();
    this.deps.repo.subscribe(() => this.onDataChanged());
    if (this.state.meta.enabled) this.deps.preloadAuth?.();
    if (this.state.meta.enabled && this.state.meta.dirty) this.scheduleUpload();
    // 補上之前沒同步完的照片（例如上次同步到一半關掉 App）
    if (this.state.meta.enabled && hasValidToken(this.state.meta)) this.queuePhotoSync(false);
  }

  /** 等照片同步全部完成（測試用） */
  async photosSettled(): Promise<void> {
    while (this.photoTask) await this.photoTask;
  }

  /**
   * 使用者按下「完成訓練」這類按鈕時呼叫（必須在按下的當下、任何 await 之前呼叫）。
   * 授權過期時趁這次按鈕重新取得授權（已授權過的帳號視窗會自動關閉），之後的變更就能自動上傳，
   * 不必另外按「上傳」。失敗（被擋、使用者關掉視窗）也不打擾，紀錄頁仍會顯示上傳按鈕。
   */
  refreshOnTap(): void {
    const { meta, busy, decision } = this.state;
    if (!meta.enabled || busy || decision || hasValidToken(meta)) return;
    if (!this.deps.repo.loadStatus.ok) return;
    void this.run('upload', async () => {
      await this.ensureToken();
      if (this.state.meta.dirty) this.scheduleUpload();
      else this.queuePhotoSync(false);
    }).catch(() => undefined);
  }

  // ───────── 使用者操作（都必須由按鈕觸發，因為可能開啟 Google 視窗） ─────────

  /** 連線 Google Drive 並開始自動備份 */
  async connect(): Promise<void> {
    await this.run('connect', async () => {
      const token = await this.deps.requestToken(true);
      this.saveMeta({ ...this.state.meta, enabled: true, dirty: true, token: token.token, tokenExpiresAt: token.expiresAt });
      await this.sync();
    });
  }

  /** 立即上傳（權杖過期時會先重新取得） */
  async uploadNow(): Promise<void> {
    await this.run('upload', async () => {
      await this.ensureToken();
      await this.sync();
    });
  }

  /** 從雲端還原（會先確認） */
  async restoreFromCloud(): Promise<void> {
    await this.run('restore', async () => {
      const token = await this.ensureToken();
      const cloud = await this.deps.findBackup(token);
      if (!cloud) throw new Error('Google Drive 裡還沒有備份');
      await this.restore(token, cloud);
    });
  }

  /** 回應「雲端與這台的資料不同」：用雲端的取代這台，或用這台的覆蓋雲端 */
  async resolve(choice: 'useCloud' | 'useLocal'): Promise<void> {
    const decision = this.state.decision;
    if (!decision) return;
    await this.run(choice === 'useCloud' ? 'restore' : 'upload', async () => {
      const token = await this.ensureToken();
      if (choice === 'useCloud') await this.restore(token, decision.cloud);
      else await this.upload(token, decision.cloud.id);
    });
  }

  /** 暫時不處理雲端的不同（停止自動上傳，直到使用者再按上傳） */
  dismissDecision(): void {
    this.store.set({ ...this.state, decision: null });
  }

  /** 中斷連線：撤銷授權、停止自動備份（雲端的備份檔保留） */
  async disconnect(): Promise<void> {
    const token = this.state.meta.token;
    this.photoQueued = null;
    this.saveMeta({ ...EMPTY_META });
    this.store.set({ ...this.state, decision: null, error: null, photoError: null });
    if (token) await this.deps.revoke(token).catch(() => undefined);
  }

  // ───────── 內部流程 ─────────

  private onDataChanged(): void {
    const next = this.takeSnapshot();
    const changed = next.some((v, i) => v !== this.snapshot[i]);
    this.snapshot = next;
    if (!changed || !this.state.meta.enabled) return;
    if (!this.state.meta.dirty) this.saveMeta({ ...this.state.meta, dirty: true });
    this.scheduleUpload();
  }

  private scheduleUpload(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.autoUpload(), UPLOAD_DELAY);
  }

  /** 背景自動上傳：只有權杖有效、沒有待決定的事、資料正常載入時才上傳；失敗不打擾，留在畫面上提示 */
  private async autoUpload(): Promise<void> {
    const { meta, busy, decision } = this.state;
    if (!meta.enabled || !meta.dirty || busy || decision || !hasValidToken(meta)) return;
    // 資料讀取失敗、以空白資料啟動時，絕不上傳
    if (!this.deps.repo.loadStatus.ok) return;
    // 背景上傳失敗不跳錯誤訊息：錯誤記在狀態裡，畫面上會顯示，使用者可以再按上傳
    await this.run('upload', () => this.sync()).catch(() => undefined);
  }

  /** 檢查雲端狀態並決定要上傳還是讓使用者選擇 */
  private async sync(): Promise<void> {
    const token = this.state.meta.token;
    if (!token) throw new DriveAuthError();
    const cloud = await this.deps.findBackup(token);
    const decision = decideSync({
      localHasData: hasUserData(this.deps.repo.getData()) && this.deps.repo.loadStatus.ok,
      cloud,
      lastUploadedModified: this.state.meta.lastUploadedModified,
    });
    if (decision.kind === 'upload') return this.upload(token, cloud?.id);
    if (decision.kind === 'nothing') return this.saveMeta({ ...this.state.meta, dirty: false });
    this.store.set({ ...this.state, decision });
  }

  private async upload(token: string, fileId: string | undefined): Promise<void> {
    const file = await this.deps.uploadBackup(token, toBackupJson(this.deps.repo.exportData()), fileId);
    this.store.set({ ...this.state, decision: null });
    this.saveMeta({
      ...this.state.meta,
      fileId: file.id,
      lastUploadAt: Date.now(),
      lastUploadedModified: file.modifiedTime,
      dirty: false,
    });
    // 雲端的紀錄現在和這台一致，可以順便清掉雲端用不到的照片
    this.queuePhotoSync(true);
  }

  private async restore(token: string, cloud: CloudFile): Promise<void> {
    const text = await this.deps.downloadBackup(token, cloud.id);
    let incoming: AppData;
    try {
      incoming = migrate(JSON.parse(text) as unknown);
    } catch (err) {
      throw new Error(`雲端的備份無法讀取：${errorMessage(err)}`);
    }
    if (!(await this.deps.confirmRestore(cloud, incoming))) return;
    await this.deps.repo.replaceAll(incoming);
    // 還原後兩邊一致：記下雲端的版本，之後這台的變更可以直接覆蓋它
    this.snapshot = this.takeSnapshot();
    this.store.set({ ...this.state, decision: null });
    this.saveMeta({ ...this.state.meta, fileId: cloud.id, lastUploadedModified: cloud.modifiedTime, dirty: false });
    this.queuePhotoSync(true);
  }

  // ───────── 照片 ─────────

  private queuePhotoSync(prune: boolean): void {
    if (!this.deps.photos) return;
    this.photoQueued = (this.photoQueued ?? false) || prune;
    this.photoTask ??= this.photoLoop().finally(() => {
      this.photoTask = null;
      // 剛結束時又有人排隊：再跑一次
      if (this.photoQueued !== null) this.queuePhotoSync(this.photoQueued);
    });
  }

  private async photoLoop(): Promise<void> {
    while (this.photoQueued !== null) {
      const prune = this.photoQueued;
      this.photoQueued = null;
      try {
        await this.syncPhotos(prune);
        if (this.state.photoError) this.store.set({ ...this.state, photoError: null });
      } catch (err) {
        if (err instanceof DriveAuthError) {
          // 授權過期：下次按按鈕重新取得授權後會再同步，不另外提示
          const { token: _t, tokenExpiresAt: _e, ...rest } = this.state.meta;
          if (this.state.meta.enabled) this.saveMeta(rest);
        } else {
          this.store.set({ ...this.state, photoError: errorMessage(err) });
        }
        return;
      } finally {
        this.store.set({ ...this.state, photos: null });
      }
    }
  }

  /** 比對兩邊的照片並上傳、下載、刪除；照片內容不會變，比對 id 就夠了 */
  private async syncPhotos(prune: boolean): Promise<void> {
    const photos = this.deps.photos!;
    const meta = this.state.meta;
    if (!meta.enabled || !meta.token || !hasValidToken(meta) || !this.deps.repo.loadStatus.ok) return;
    const token = meta.token;
    const [remote, local] = await Promise.all([photos.list(token), photos.localIds()]);
    const plan = planPhotoSync({ referenced: referencedPhotoIds(this.deps.repo.getData()), local, remote, prune });
    const total = plan.upload.length + plan.download.length + plan.remove.length;
    let done = 0;
    const progress = () => this.store.set({ ...this.state, photos: { done, total } });
    /** 中斷連線後就停 */
    const stopped = () => !this.state.meta.enabled;
    if (total > 0) progress();
    for (const id of plan.upload) {
      if (stopped()) return;
      const blob = await photos.getLocal(id);
      if (blob) await photos.upload(token, id, blob);
      done++;
      progress();
    }
    for (const { id, fileId } of plan.download) {
      if (stopped()) return;
      await photos.saveLocal(id, await photos.download(token, fileId));
      done++;
      progress();
    }
    for (const fileId of plan.remove) {
      if (stopped()) return;
      await photos.remove(token, fileId);
      done++;
      progress();
    }
  }

  private async ensureToken(): Promise<string> {
    const meta = this.state.meta;
    if (meta.token && hasValidToken(meta)) return meta.token;
    const token = await this.deps.requestToken(!meta.enabled);
    this.saveMeta({ ...this.state.meta, enabled: true, token: token.token, tokenExpiresAt: token.expiresAt });
    return token.token;
  }

  /** 執行一個步驟：標示忙碌、記下錯誤；授權過期時清掉權杖，畫面改顯示重新連線 */
  private async run(busy: NonNullable<CloudState['busy']>, fn: () => Promise<void>): Promise<void> {
    if (this.state.busy) return;
    this.store.set({ ...this.state, busy, error: null });
    try {
      await fn();
    } catch (err) {
      if (err instanceof DriveAuthError) {
        const { token: _t, tokenExpiresAt: _e, ...rest } = this.state.meta;
        this.saveMeta(rest);
      }
      this.store.set({ ...this.state, error: errorMessage(err) });
      throw err;
    } finally {
      this.store.set({ ...this.state, busy: null });
    }
  }

  private takeSnapshot(): unknown[] {
    const data = this.deps.repo.getData();
    return BACKED_UP.map((k) => data[k]);
  }

  private readMeta(): CloudMeta {
    try {
      return parseMeta(this.deps.storage.getItem(META_KEY));
    } catch {
      return { ...EMPTY_META };
    }
  }

  private saveMeta(meta: CloudMeta): void {
    try {
      if (meta.enabled) this.deps.storage.setItem(META_KEY, JSON.stringify(meta));
      else this.deps.storage.removeItem(META_KEY);
    } catch {
      // 存不進去只影響下次開啟時的狀態，不中斷備份
    }
    this.store.set({ ...this.state, meta });
  }
}
