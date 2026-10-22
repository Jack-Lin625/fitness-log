import type { AppData } from '../types/models';
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

/** 以 localStorage 實作的儲存後端 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly key: string = DATA_KEY) {}

  async load(): Promise<unknown> {
    let raw: string | null;
    try {
      raw = localStorage.getItem(this.key);
    } catch (err) {
      // Safari 無痕模式或瀏覽器停用儲存時會丟例外
      throw new StorageReadError('瀏覽器不允許讀取本機儲存空間', err);
    }
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as unknown;
    } catch (err) {
      throw new StorageReadError('儲存的資料格式損毀，無法解析', err);
    }
  }

  async save(data: AppData): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (err) {
      const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError';
      throw new StorageWriteError(
        isQuota ? '儲存空間已滿，請先匯出備份並清理舊資料' : '無法寫入本機儲存空間',
        err,
      );
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
      backupKeys().forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      throw new StorageWriteError('無法清除本機儲存空間', err);
    }
  }
}
