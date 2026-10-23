/**
 * 以 IndexedDB 實作的儲存後端（預設使用）
 *
 * localStorage 只有約 5 MB，而且主資料加上 3 份本機備份會佔用 4 倍空間，
 * 練了幾年、每天記飲食之後就可能存不進新的訓練。IndexedDB 的上限是手機可用空間的一部分（通常數百 MB 以上），
 * 而且直接存物件，不必每次寫入都轉成 JSON 字串。
 *
 * - 主資料、草稿、本機備份各自一筆，草稿可以單獨寫入。
 * - 第一次啟動時，把舊版存在 localStorage 的資料搬過來，搬完才刪除 localStorage 的資料。
 * - 瀏覽器不能用 IndexedDB 時（少數無痕模式），自動改用 localStorage。
 */
import type { AppData, WorkoutDraft } from '../types/models';
import { LocalStorageAdapter } from './localStorageAdapter';
import { StorageReadError, StorageWriteError, type StorageAdapter } from './storageAdapter';

const STORE = 'kv';
const DATA = 'data';
const DRAFT = 'draft';
const BACKUP_PREFIX = 'backup:';
/** 本機備份最多保留幾份 */
const MAX_BACKUPS = 3;

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('瀏覽器不支援 IndexedDB'));
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('無法開啟 IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB 被其他分頁占用'));
  });
}

function writeError(err: unknown): StorageWriteError {
  const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError';
  return new StorageWriteError(isQuota ? '手機儲存空間不足，請先匯出備份並清理舊資料' : '無法寫入本機儲存空間', err);
}

export class IndexedDbAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(
    /** 舊版資料的來源，也是不能用 IndexedDB 時的替代方案 */
    private readonly legacy: LocalStorageAdapter = new LocalStorageAdapter(),
    private readonly dbName = 'fitlog-data',
  ) {}

  /** 開啟資料庫；不能用時回傳 null（改用 localStorage） */
  private db(): Promise<IDBDatabase | null> {
    this.dbPromise ??= openDb(this.dbName).catch(() => null);
    return this.dbPromise;
  }

  /** 在一個交易裡執行，交易完成才算成功（多筆寫入要嘛全部成功、要嘛全部失敗） */
  private async tx<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => T,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T;
      try {
        result = fn(tx.objectStore(STORE));
      } catch (err) {
        tx.abort();
        reject(mode === 'readwrite' ? writeError(err) : err);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(mode === 'readwrite' ? writeError(tx.error) : tx.error);
      tx.onabort = () => reject(mode === 'readwrite' ? writeError(tx.error) : tx.error);
    });
  }

  private async get(db: IDBDatabase, keys: string[]): Promise<unknown[]> {
    const reqs = await this.tx(db, 'readonly', (s) => keys.map((k) => s.get(k)));
    return reqs.map((r) => r.result as unknown);
  }

  async load(): Promise<unknown> {
    const db = await this.db();
    if (!db) return this.legacy.load();

    let data: unknown;
    let draft: unknown;
    try {
      [data, draft] = await this.get(db, [DATA, DRAFT]);
    } catch (err) {
      throw new StorageReadError('無法讀取本機儲存空間', err);
    }

    if (data === undefined) return this.migrateFromLegacy(db);
    // 草稿沒有單獨存過（剛從舊版搬過來）時，用主資料裡的
    if (draft === undefined || typeof data !== 'object' || data === null) return data;
    return { ...data, activeDraft: draft };
  }

  /** 把 localStorage 的舊資料搬進 IndexedDB；寫入成功才刪掉舊資料 */
  private async migrateFromLegacy(db: IDBDatabase): Promise<unknown> {
    // 舊資料損毀時讀取會丟出錯誤，交給 Repository 處理（backupRaw 會備份 localStorage 裡的原始內容）
    const raw = await this.legacy.load();
    if (raw === null) return null;
    await this.tx(db, 'readwrite', (s) => {
      s.put(raw, DATA);
    });
    await this.legacy.clear().catch(() => undefined);
    return raw;
  }

  async save(data: AppData): Promise<void> {
    const db = await this.db();
    if (!db) return this.legacy.save(data);
    await this.tx(db, 'readwrite', (s) => {
      s.put({ ...data, activeDraft: null }, DATA);
      s.put(data.activeDraft, DRAFT);
    });
  }

  async saveDraft(draft: WorkoutDraft | null): Promise<void> {
    const db = await this.db();
    if (!db) return this.legacy.saveDraft(draft);
    await this.tx(db, 'readwrite', (s) => {
      s.put(draft, DRAFT);
    });
  }

  async backupRaw(reason: string): Promise<string | null> {
    const db = await this.db();
    if (!db) return this.legacy.backupRaw(reason);
    try {
      const [data] = await this.get(db, [DATA]);
      // IndexedDB 還沒有資料：可能是 localStorage 的舊資料損毀、搬不過來，備份那一份
      if (data === undefined) return await this.legacy.backupRaw(reason);

      const keys = (await this.tx(db, 'readonly', (s) => s.getAllKeys())).result
        .map(String)
        .filter((k) => k.startsWith(BACKUP_PREFIX))
        .sort();
      const existing = await this.get(db, keys);
      // 內容相同的備份已經存在就不重複存
      const json = JSON.stringify(data);
      const sameIndex = existing.findIndex((b) => JSON.stringify(b) === json);
      if (sameIndex >= 0) return keys[sameIndex] ?? null;

      const backupKey = `${BACKUP_PREFIX}${new Date().toISOString()}:${reason}`;
      const stale = keys.slice(0, Math.max(0, keys.length - (MAX_BACKUPS - 1)));
      await this.tx(db, 'readwrite', (s) => {
        stale.forEach((k) => s.delete(k));
        s.put(data, backupKey);
      });
      return backupKey;
    } catch {
      // 備份失敗時不中斷流程，由呼叫端決定如何處理
      return null;
    }
  }

  async clear(): Promise<void> {
    const db = await this.db();
    if (!db) return this.legacy.clear();
    await this.tx(db, 'readwrite', (s) => s.clear());
    await this.legacy.clear().catch(() => undefined);
  }
}
