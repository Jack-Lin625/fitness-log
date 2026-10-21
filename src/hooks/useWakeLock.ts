import { useEffect } from 'preact/hooks';

/**
 * 訓練進行中保持螢幕常亮，避免組間休息時手機自動鎖屏。
 * 不支援的瀏覽器會直接略過；切到別的 App 再回來會自動重新要求。
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      } catch {
        // 省電模式等情況會被拒絕，忽略即可
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
