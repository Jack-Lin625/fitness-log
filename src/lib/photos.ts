/**
 * 照片處理：拍照後壓縮、照片備份檔的匯出與匯入
 */
import { getAllPhotos, savePhoto } from '../data/photoStore';

/** 長邊最多這麼多像素，手機看餐點已經夠清楚，一張約 150–300 KB */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;

/**
 * 縮小並轉成 JPEG。
 * 用 <img> 解碼：現代瀏覽器會自動套用照片的旋轉資訊（EXIF），直拍的照片不會躺著。
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('無法讀取這張照片');
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法處理照片');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('無法處理照片');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 照片備份檔的格式 */
const BACKUP_KIND = 'fitlog-photos';

interface PhotoBackup {
  kind: typeof BACKUP_KIND;
  version: 1;
  photos: { id: string; type: string; data: string }[];
}

/** ArrayBuffer ↔ base64（分段處理，避免大檔案超過函式參數上限） */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 所有照片打包成一個 JSON 字串 */
export async function exportPhotosJson(): Promise<{ json: string; count: number }> {
  const photos = await getAllPhotos();
  const backup: PhotoBackup = {
    kind: BACKUP_KIND,
    version: 1,
    photos: await Promise.all(
      photos.map(async ({ id, blob }) => ({ id, type: blob.type, data: toBase64(await blob.arrayBuffer()) })),
    ),
  };
  return { json: JSON.stringify(backup), count: photos.length };
}

/** 讀入照片備份檔；同 id 的照片會被覆蓋。回傳匯入張數 */
export async function importPhotosJson(text: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('這不是有效的照片備份檔（JSON 格式錯誤）');
  }
  const backup = parsed as Partial<PhotoBackup> | null;
  if (!backup || backup.kind !== BACKUP_KIND || !Array.isArray(backup.photos)) {
    throw new Error('這不是照片備份檔；訓練資料請用「從備份檔匯入」');
  }
  let count = 0;
  for (const p of backup.photos) {
    if (typeof p?.id !== 'string' || typeof p.data !== 'string') continue;
    await savePhoto(new Blob([fromBase64(p.data)], { type: typeof p.type === 'string' ? p.type : 'image/jpeg' }), p.id);
    count++;
  }
  return count;
}

/** 位元組 → 「1.2 MB」 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
