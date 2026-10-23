/**
 * Google Drive 的備份檔讀寫（REST API，直接用 fetch）
 *
 * 備份放在 App 專用的隱藏資料夾（appDataFolder）：
 * 只有這個 App 讀寫得到，不會出現在使用者的 Drive 檔案清單裡，也看不到使用者其他檔案
 * （授權範圍 drive.appdata）。
 */

export const BACKUP_FILE_NAME = 'fitlog-backup.json';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** 雲端備份檔的資訊 */
export interface CloudFile {
  id: string;
  /** 最後修改時間（ISO） */
  modifiedTime: string;
  /** 位元組 */
  size: number;
}

/** 授權過期或被撤銷，需要重新連線 */
export class DriveAuthError extends Error {
  constructor() {
    super('Google 帳號的授權已過期，請重新連線');
    this.name = 'DriveAuthError';
  }
}

/** 檔案不存在 */
class DriveNotFoundError extends Error {}

async function request(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error('連不上 Google Drive，請確認網路');
  }
  if (res.status === 401) throw new DriveAuthError();
  if (res.status === 403) {
    const quota = (await res.text().catch(() => '')).includes('storageQuotaExceeded');
    throw new Error(quota ? 'Google Drive 空間已滿' : 'Google Drive 拒絕存取，請重新連線');
  }
  if (res.status === 404) throw new DriveNotFoundError('Google Drive 找不到這個檔案');
  if (!res.ok) throw new Error(`Google Drive 發生錯誤（${res.status}），請稍後再試`);
  return res;
}

/** 找出雲端的備份檔；沒有回傳 null */
export async function findBackup(token: string): Promise<CloudFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${BACKUP_FILE_NAME}' and trashed = false`,
    fields: 'files(id,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '1',
  });
  const res = await request(token, `${API}?${params}`);
  const body = (await res.json()) as { files?: { id: string; modifiedTime: string; size?: string }[] };
  const file = body.files?.[0];
  return file ? { id: file.id, modifiedTime: file.modifiedTime, size: Number(file.size ?? 0) } : null;
}

/** 上傳備份：有 fileId 就覆蓋，沒有就建立新檔 */
export async function uploadBackup(token: string, json: string, fileId?: string): Promise<CloudFile> {
  const fields = 'id,modifiedTime,size';
  let res: Response;
  if (fileId) {
    res = await request(token, `${UPLOAD}/${encodeURIComponent(fileId)}?uploadType=media&fields=${fields}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
  } else {
    // 建立新檔：中繼資料（檔名、放在 appDataFolder）與內容一起送
    const boundary = `fitlog-${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    res = await request(token, `${UPLOAD}?uploadType=multipart&fields=${fields}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }
  const file = (await res.json()) as { id: string; modifiedTime: string; size?: string };
  return { id: file.id, modifiedTime: file.modifiedTime, size: Number(file.size ?? 0) };
}

/** 下載備份檔的內容（JSON 文字） */
export async function downloadBackup(token: string, fileId: string): Promise<string> {
  const res = await request(token, `${API}/${encodeURIComponent(fileId)}?alt=media`);
  return res.text();
}

// ───────── 照片：每張照片一個檔案（檔名 photo-<照片 id>），內容不會變，只需新增與刪除 ─────────

const PHOTO_PREFIX = 'photo-';

/** 雲端所有照片：照片 id → 雲端檔案 id */
export async function listPhotos(token: string): Promise<Map<string, string>> {
  const photos = new Map<string, string>();
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name contains '${PHOTO_PREFIX}' and trashed = false`,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await request(token, `${API}?${params}`);
    const body = (await res.json()) as { nextPageToken?: string; files?: { id: string; name: string }[] };
    for (const f of body.files ?? []) {
      if (f.name.startsWith(PHOTO_PREFIX)) photos.set(f.name.slice(PHOTO_PREFIX.length), f.id);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return photos;
}

/** 上傳一張照片 */
export async function uploadPhoto(token: string, id: string, blob: Blob): Promise<void> {
  const boundary = `fitlog-${Math.random().toString(36).slice(2)}`;
  const type = blob.type || 'image/jpeg';
  const metadata = JSON.stringify({ name: PHOTO_PREFIX + id, parents: ['appDataFolder'], mimeType: type });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  await request(token, `${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** 下載一張照片 */
export async function downloadPhoto(token: string, fileId: string): Promise<Blob> {
  const res = await request(token, `${API}/${encodeURIComponent(fileId)}?alt=media`);
  return res.blob();
}

/** 刪除雲端的一張照片（已經不在也算成功） */
export async function deletePhotoFile(token: string, fileId: string): Promise<void> {
  try {
    await request(token, `${API}/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  } catch (err) {
    if (!(err instanceof DriveNotFoundError)) throw err;
  }
}
