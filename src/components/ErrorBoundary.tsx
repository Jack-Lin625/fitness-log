import type { ComponentChildren } from 'preact';
import { useEffect, useErrorBoundary } from 'preact/hooks';
import { repo } from '../data';
import { navigate } from '../hooks/useHashRoute';
import { errorMessage } from '../lib/errors';
import { datedName, downloadFile, toBackupJson } from '../lib/exporters';

/**
 * 畫面出錯時的保護網：只把出錯的頁面換成說明，底部導覽仍可使用，
 * 並提供下載備份——資料只存在這支手機，一定要讓使用者有辦法把資料帶走。
 */
export function ErrorBoundary({ children, resetKey }: { children: ComponentChildren; resetKey: string }) {
  const [error, reset] = useErrorBoundary((err) => console.error(err));

  // 換到別的網址就離開錯誤畫面（不用 key 重建，避免換頁參數時頁面狀態被清掉）
  useEffect(() => {
    if (error) reset();
  }, [resetKey]);

  if (!error) return <>{children}</>;

  const backup = () =>
    void downloadFile(datedName('fitlog-backup', 'json'), toBackupJson(repo.exportData()), 'application/json');

  return (
    <section class="empty-state" role="alert">
      <h2>這個畫面發生錯誤</h2>
      <p>訓練資料仍然存在這支手機裡。可以先下載備份，再回到紀錄頁或重新整理。</p>
      <p class="muted small-text">{errorMessage(error)}</p>
      <div class="action-stack">
        <button type="button" class="btn btn-primary btn-block" onClick={backup}>
          下載完整備份
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-block"
          onClick={() => {
            reset();
            navigate('/log');
          }}
        >
          回到紀錄頁
        </button>
      </div>
    </section>
  );
}
