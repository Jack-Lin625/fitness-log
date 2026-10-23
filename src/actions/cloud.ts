/**
 * App 共用的雲端備份實例（接上真正的 Google 授權、Drive API 與確認對話框）
 */
import { confirmDialog } from '../components/Dialog';
import { repo } from '../data';
import { formatDateLabel } from '../lib/date';
import { requestAccessToken, revokeAccess } from '../lib/googleAuth';
import { downloadBackup, findBackup, uploadBackup } from '../lib/googleDrive';
import { CloudBackup } from './cloudBackup';

/** 雲端備份時間的顯示文字，例如「10月23日 週五 14:05」 */
export function cloudTimeLabel(time: number | string): string {
  const d = new Date(time);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${formatDateLabel(date)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const cloud = new CloudBackup({
  repo,
  requestToken: requestAccessToken,
  revoke: revokeAccess,
  findBackup,
  uploadBackup,
  downloadBackup,
  confirmRestore: (file, incoming) => {
    const d = repo.getData();
    return confirmDialog({
      title: '用 Google Drive 的備份取代這支手機的資料？',
      body:
        `雲端備份（${cloudTimeLabel(file.modifiedTime)}）：訓練 ${incoming.sessions.length} 筆、` +
        `體態 ${incoming.bodyMetrics.length} 筆、飲食 ${incoming.foodEntries.length} 筆、菜單範本 ${incoming.templates.length} 個。` +
        `這支手機目前：訓練 ${d.sessions.length} 筆、體態 ${d.bodyMetrics.length} 筆、飲食 ${d.foodEntries.length} 筆。` +
        '取代前會在手機裡另存一份目前的資料。',
      confirmText: '取代',
      danger: true,
    });
  },
  // 用到時才碰 localStorage（被瀏覽器封鎖時存取會丟例外，由 CloudBackup 接住）
  storage: {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
  },
});
