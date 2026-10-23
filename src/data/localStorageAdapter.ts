import type { AppData, WorkoutDraft } from '../types/models';
import { StorageReadError, StorageWriteError, type StorageAdapter } from './storageAdapter';

const DATA_KEY = 'fitlog:data';
const BACKUP_PREFIX = 'fitlog:backup:';
/** 本機備份最多保留幾份：每份都是完整資料，無限累積會塞滿儲存空間，導致新的訓練存不進去 */
const MAX_BACKUPS = 3;

/** 所有本機備份的 key，由舊到新（key 含 ISO 時間，字串排序即時間排序） */
function backupKeys(): string[] {
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(BACKUP_PREFIX))
    .sort();
}

function writeError(err: unknown): StorageWriteError {
  const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError';
  return new StorageWriteError(isQuota ? '儲存空間已滿，請先匯出備份並清理舊資料' : '無法寫入本機儲存空間', err);
}

/**
 * 以 localStorage 實作的儲存後端。
 * 目前只在瀏覽器不能用 IndexedDB 時使用，以及讀取舊版存在 localStorage 的資料。
 * 草稿存在獨立的 key（`<key>:draft`），訓練中暫存不必重寫全部資料。
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly draftKey: string;

  constructor(private readonly key: string = DATA_KEY) {
    this.draftKey = `${key}:draft`;
  }

  async load(): Promise<unknown> {
    let raw: string | null;
    try {
      raw = localStorage.getItem(this.key);
    } catch (err) {
      // Safari 無痕模式或瀏覽器停用儲存時會丟例外
      throw new StorageReadError('瀏覽器不允許讀取本機儲存空間', err);
    }
    if (raw === null) return null;

    let data: unknown;
    try {
      data = JSON.parse(raw) as unknown;
    } catch (err) {
      throw new StorageReadError('儲存的資料格式損毀，無法解析', err);
    }
    // 舊版的草稿存在主資料裡；有獨立的草稿 key 時以它為準（損毀就當作沒有草稿）
    const draftRaw = localStorage.getItem(this.draftKey);
    if (draftRaw !== null && typeof data === 'object' && data !== null) {
      let draft: unknown = null;
      try {
        draft = JSON.parse(draftRaw);
      } catch {
        // 草稿壞掉不影響其他資料
      }
      data = { ...data, activeDraft: draft };
    }
    return data;
  }

  async save(data: AppData): Promise<void> {
    // 先寫主資料再寫草稿：完成訓練時若第二步失敗，紀錄已經存好，只是草稿還在（再按一次完成會覆蓋同一筆）
    try {
      localStorage.setItem(this.key, JSON.stringify({ ...data, activeDraft: null }));
    } catch (err) {
      throw writeError(err);
    }
    await this.saveDraft(data.activeDraft);
  }

  async saveDraft(draft: WorkoutDraft | null): Promise<void> {
    try {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
    } catch (err) {
      throw writeError(err);
    }
  }

  async backupRaw(reason: string): Promise<string | null> {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw === null) return null;
      const existing = backupKeys();
      // 內容相同的備份已經存在就不重複存（例如資料損毀時，每次開啟 App 都會走到這裡）
      const same = existing.find((k) => localStorage.getItem(k) === raw);
      if (same) return same;
      // 先刪最舊的，騰出空間再寫入新的
      existing.slice(0, Math.max(0, existing.length - (MAX_BACKUPS - 1))).forEach((k) => localStorage.removeItem(k));
      const backupKey = `${BACKUP_PREFIX}${new Date().toISOString()}:${reason}`;
      localStorage.setItem(backupKey, raw);
      return backupKey;
    } catch {
      // 備份失敗時不中斷流程，由呼叫端決定如何處理
      return null;
    }
  }

  /** 刪除主資料與所有本機備份 */
  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
      localStorage.removeItem(this.draftKey);
      backupKeys().forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      throw new StorageWriteError('無法清除本機儲存空間', err);
    }
  }
}
