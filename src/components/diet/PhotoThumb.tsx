import { useEffect, useState } from 'preact/hooks';
import { getPhoto } from '../../data/photoStore';

/** 由 Blob 產生暫時網址，元件移除或 Blob 改變時釋放記憶體 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** 從照片庫讀出照片；找不到（例如換手機後沒匯入照片）時回傳 null */
export function useStoredPhoto(photoId: string | undefined): Blob | null {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBlob(null);
    if (photoId) {
      getPhoto(photoId)
        .then((b) => !cancelled && setBlob(b ?? null))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [photoId]);
  return blob;
}

/** 飲食紀錄的縮圖；沒有照片時顯示餐盤圖示 */
export function PhotoThumb({ photoId, size = 56 }: { photoId: string | undefined; size?: number }) {
  const url = useObjectUrl(useStoredPhoto(photoId));
  const style = { width: `${size}px`, height: `${size}px` };
  if (url) return <img class="food-thumb" src={url} alt="" style={style} />;
  return (
    <span class="food-thumb food-thumb-empty" style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    </span>
  );
}
