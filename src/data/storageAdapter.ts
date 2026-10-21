import type { AppData } from '../types/models';

/**
 * 儲存後端的抽象介面。
 * 目前實作為 localStorage；未來換成 IndexedDB 或後端 API 時，
 * 只要提供新的實作並在建立 repository 時傳入即可，UI 不需改動。
 * 方法全部回傳 Promise，讓非同步的後端也能直接套用。
 */
export interface StorageAdapter {
  /** 讀取原始資料；尚無資料回傳 null；資料損毀則丟出 StorageReadError */
  load(): Promise<unknown>;
  /** 寫入完整資料 */
  save(data: AppData): Promise<void>;
  /** 把目前的原始內容另存成備份（升級失敗或資料損毀時使用），回傳備份名稱 */
  backupRaw(reason: string): Promise<string | null>;
  /** 刪除主資料 */
  clear(): Promise<void>;
}

/** 讀取失敗（例如 JSON 損毀） */
export class StorageReadError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'StorageReadError';
  }
}

/** 寫入失敗（例如容量已滿、無痕模式限制） */
export class StorageWriteError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'StorageWriteError';
  }
}
