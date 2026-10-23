/**
 * 雲端備份的判斷規則（純函式，方便測試）
 *
 * 最重要的原則：不能用空白或別台裝置不知道的資料蓋掉雲端的備份。
 * - 雲端沒有備份 → 上傳
 * - 雲端的備份就是這台裝置上次上傳的（修改時間相同）→ 覆蓋
 * - 這台裝置沒有資料（新手機）→ 問要不要從雲端還原，絕不上傳空白資料
 * - 雲端的備份是別台裝置（或這台重新安裝前）上傳的 → 問使用者要用哪一份
 */
import type { CloudFile } from './googleDrive';

export type SyncDecision =
  /** 可以上傳（覆蓋或新建） */
  | { kind: 'upload' }
  /** 這台裝置沒有資料可上傳，雲端也沒有：什麼都不做 */
  | { kind: 'nothing' }
  /** 這台裝置沒有資料、雲端有：建議從雲端還原 */
  | { kind: 'restore'; cloud: CloudFile }
  /** 兩邊都有資料，而且雲端的不是這台裝置上次上傳的：讓使用者選 */
  | { kind: 'conflict'; cloud: CloudFile };

export function decideSync(input: {
  localHasData: boolean;
  cloud: CloudFile | null;
  /** 這台裝置上次上傳後，雲端檔案的修改時間 */
  lastUploadedModified: string | undefined;
}): SyncDecision {
  const { localHasData, cloud, lastUploadedModified } = input;
  if (!cloud) return localHasData ? { kind: 'upload' } : { kind: 'nothing' };
  if (!localHasData) return { kind: 'restore', cloud };
  if (lastUploadedModified !== undefined && cloud.modifiedTime === lastUploadedModified) return { kind: 'upload' };
  return { kind: 'conflict', cloud };
}

/** 這台裝置的雲端備份狀態（存在 localStorage，不放進備份檔：每台裝置各自的） */
export interface CloudMeta {
  /** 使用者開啟了雲端備份 */
  enabled: boolean;
  /** 雲端備份檔的 id */
  fileId?: string;
  /** 上次上傳成功的時間 */
  lastUploadAt?: number;
  /** 上次上傳後雲端檔案的修改時間，用來判斷雲端有沒有被別台裝置改過 */
  lastUploadedModified?: string;
  /** 有還沒上傳的變更（關掉 App 再開也記得） */
  dirty: boolean;
  /** 存取權杖與到期時間（約 1 小時，只能存取 App 專用資料夾） */
  token?: string;
  tokenExpiresAt?: number;
}

export const EMPTY_META: CloudMeta = { enabled: false, dirty: false };

/** 讀取存起來的狀態；格式不對就當作沒開啟 */
export function parseMeta(raw: string | null): CloudMeta {
  if (!raw) return { ...EMPTY_META };
  try {
    const v = JSON.parse(raw) as Partial<CloudMeta> | null;
    if (!v || typeof v !== 'object' || v.enabled !== true) return { ...EMPTY_META };
    const meta: CloudMeta = { enabled: true, dirty: v.dirty === true };
    if (typeof v.fileId === 'string') meta.fileId = v.fileId;
    if (typeof v.lastUploadAt === 'number') meta.lastUploadAt = v.lastUploadAt;
    if (typeof v.lastUploadedModified === 'string') meta.lastUploadedModified = v.lastUploadedModified;
    if (typeof v.token === 'string' && typeof v.tokenExpiresAt === 'number') {
      meta.token = v.token;
      meta.tokenExpiresAt = v.tokenExpiresAt;
    }
    return meta;
  } catch {
    return { ...EMPTY_META };
  }
}

/** 權杖還能用嗎 */
export function hasValidToken(meta: CloudMeta, now = Date.now()): boolean {
  return Boolean(meta.token && meta.tokenExpiresAt && meta.tokenExpiresAt > now);
}
