import type { AppData } from '../types/models';
import { StorageReadError, StorageWriteError, type StorageAdapter } from './storageAdapter';

const DATA_KEY = 'fitlog:data';
const BACKUP_PREFIX = 'fitlog:backup:';

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
      Object.keys(localStorage)
        .filter((k) => k.startsWith(BACKUP_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      throw new StorageWriteError('無法清除本機儲存空間', err);
    }
  }
}
