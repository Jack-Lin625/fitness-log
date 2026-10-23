/**
 * 下載完整備份（設定頁與紀錄頁的備份提醒共用）
 */
import { showToast } from '../components/Toast';
import { repo } from '../data';
import { datedName, downloadFile, toBackupJson } from '../lib/exporters';

/** 超過這麼多天沒備份就提醒 */
export const BACKUP_REMIND_DAYS = 14;

/** 距離上次備份幾天；從沒備份過為 null */
export function daysSinceBackup(): number | null {
  const at = repo.getSettings().lastBackupAt;
  return at ? Math.floor((Date.now() - at) / 864e5) : null;
}

/** 有資料、而且從沒備份或超過提醒天數 */
export function backupOverdue(): boolean {
  const d = repo.getData();
  const hasData = d.sessions.length + d.bodyMetrics.length + d.customExercises.length + d.foodEntries.length > 0;
  const days = daysSinceBackup();
  return hasData && (days === null || days >= BACKUP_REMIND_DAYS);
}

export async function downloadBackup(): Promise<void> {
  const saved = await downloadFile(datedName('fitlog-backup', 'json'), toBackupJson(repo.exportData()), 'application/json');
  if (!saved) return; // 在分享選單按了取消，不算備份過
  await repo.updateSettings({ lastBackupAt: Date.now() }).catch(() => undefined);
  showToast('已下載備份檔');
}
