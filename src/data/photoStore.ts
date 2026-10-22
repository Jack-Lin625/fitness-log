/**
 * 飲食照片的儲存（IndexedDB）
 * localStorage 只有約 5MB，放不下照片，所以照片獨立存在 IndexedDB，
 * 飲食紀錄只記照片的 id。照片以 ArrayBuffer 存放（舊版 Safari 存 Blob 有問題）。
 */
import { createId } from '../lib/id';

const DB_NAME = 'fitlog-photos';
const STORE = 'photos';

interface PhotoRecord {
  type: string;
  data: ArrayBuffer;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('無法開啟照片儲存空間'));
  }).catch((err: unknown) => {
    dbPromise = null; // 下次再試
    throw err;
  });
  return dbPromise;
}

/** 在一個交易裡執行請求，交易完成才算成功 */
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => {
      const quota = tx.error?.name === 'QuotaExceededError';
      reject(new Error(quota ? '手機儲存空間不足，照片存不進去' : '照片儲存失敗'));
    };
    tx.onabort = tx.onerror;
  });
}

const toBlob = (r: PhotoRecord) => new Blob([r.data], { type: r.type });

/** 存一張照片，回傳 id；給 id 時用指定的 id（匯入備份用） */
export async function savePhoto(blob: Blob, id: string = createId()): Promise<string> {
  const record: PhotoRecord = { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer(), createdAt: Date.now() };
  await run('readwrite', (s) => s.put(record, id));
  return id;
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  const record = await run<PhotoRecord | undefined>('readonly', (s) => s.get(id));
  return record ? toBlob(record) : undefined;
}

export async function deletePhoto(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

export async function clearPhotos(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}

/** 所有照片的 id 與內容（備份用） */
export async function getAllPhotos(): Promise<{ id: string; blob: Blob }[]> {
  const [ids, records] = await Promise.all([
    run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()),
    run<PhotoRecord[]>('readonly', (s) => s.getAll()),
  ]);
  return records.map((r, i) => ({ id: String(ids[i]), blob: toBlob(r) }));
}

/** 照片張數與總大小（位元組） */
export async function photoUsage(): Promise<{ count: number; bytes: number }> {
  const records = await run<PhotoRecord[]>('readonly', (s) => s.getAll());
  return { count: records.length, bytes: records.reduce((n, r) => n + r.data.byteLength, 0) };
}
