import { useRef, useState } from 'preact/hooks';
import { confirmDialog } from './Dialog';
import { showToast } from './Toast';
import { migrate } from '../data/migrations';
import { useRepository } from '../hooks/useRepository';
import { errorMessage } from '../lib/errors';
import {
  bodyMetricsToCsv,
  datedName,
  downloadFile,
  readFileText,
  sessionsToCsv,
  toBackupJson,
} from '../lib/exporters';
import { stopRest } from '../lib/restTimer';

/** 超過這麼多天沒備份就提醒 */
const REMIND_DAYS = 14;

/** 設定頁的資料管理：備份、匯入、CSV、清除 */
export function DataManagement() {
  const repo = useRepository();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const data = repo.exportData();
  const lastBackupAt = data.settings.lastBackupAt;
  const daysSinceBackup = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / 864e5) : null;
  const hasData = data.sessions.length + data.bodyMetrics.length + data.customExercises.length > 0;

  const exportJson = async () => {
    downloadFile(datedName('fitlog-backup', 'json'), toBackupJson(repo.exportData()), 'application/json');
    await repo.updateSettings({ lastBackupAt: Date.now() }).catch(() => undefined);
    showToast('已下載備份檔');
  };

  const exportSessionsCsv = () => {
    if (data.sessions.length === 0) return showToast('還沒有訓練紀錄');
    downloadFile(datedName('fitlog-workouts', 'csv'), sessionsToCsv(data.sessions, (id) => repo.getExercise(id)), 'text/csv');
  };

  const exportBodyCsv = () => {
    if (data.bodyMetrics.length === 0) return showToast('還沒有體態紀錄');
    downloadFile(datedName('fitlog-body', 'csv'), bodyMetricsToCsv(data.bodyMetrics), 'text/csv');
  };

  /** 選好檔案後：讀取 → 檢查格式 → 顯示內容並確認 → 取代 */
  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await readFileText(file);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('這不是有效的備份檔（JSON 格式錯誤）');
      }
      const incoming = migrate(parsed);

      const ok = await confirmDialog({
        title: '用備份取代目前的資料？',
        body:
          `備份內容：訓練 ${incoming.sessions.length} 筆、體態 ${incoming.bodyMetrics.length} 筆、` +
          `自訂動作 ${incoming.customExercises.length} 個。` +
          `目前 App 裡的資料會被取代（訓練 ${data.sessions.length} 筆、體態 ${data.bodyMetrics.length} 筆）。`,
        confirmText: '取代',
        danger: true,
      });
      if (!ok) return;

      await repo.replaceAll(incoming);
      stopRest();
      showToast('已匯入備份');
    } catch (err) {
      showToast(errorMessage(err), 4000);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = ''; // 讓同一個檔案可以再選一次
    }
  };

  return (
    <>
      <section class="section">
        <h2 class="section-title">資料備份</h2>

        {hasData && (daysSinceBackup === null || daysSinceBackup >= REMIND_DAYS) && (
          <p class="note note-warn">
            {daysSinceBackup === null ? '還沒有備份過。' : `已經 ${daysSinceBackup} 天沒有備份了。`}
            資料只存在這支手機的瀏覽器裡，換手機、清除瀏覽器資料或手機故障都會遺失，建議定期下載備份。
          </p>
        )}

        <div class="action-stack">
          <button type="button" class="btn btn-primary btn-block btn-two-line" onClick={exportJson}>
            <span>下載完整備份</span>
            <small class="on-primary">
              {lastBackupAt ? `上次備份：${new Date(lastBackupAt).toLocaleDateString('zh-TW')}` : 'JSON 檔，可以再匯入回來'}
            </small>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-block"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            從備份檔匯入
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void onFileChosen(e.currentTarget.files?.[0])}
          />
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">匯出成試算表（CSV）</h2>
        <div class="button-pair">
          <button type="button" class="btn btn-secondary" onClick={exportSessionsCsv}>
            訓練紀錄
          </button>
          <button type="button" class="btn btn-secondary" onClick={exportBodyCsv}>
            體態紀錄
          </button>
        </div>
        <p class="muted small-text">可以用 Excel 或 Google 試算表開啟。CSV 只能匯出，不能匯入回 App。</p>
      </section>

    </>
  );
}

/** 清除所有資料（放在設定頁最下方） */
export function ClearDataSection() {
  const repo = useRepository();
  /** 清除所有資料：需要確認兩次 */
  const clearAll = async () => {
    const first = await confirmDialog({
      title: '清除所有資料？',
      body: '訓練紀錄、體態紀錄、自訂動作和設定都會刪除。建議先下載備份。',
      confirmText: '繼續',
      danger: true,
    });
    if (!first) return;
    const second = await confirmDialog({
      title: '確定要永久刪除嗎？',
      body: '這個動作無法復原。',
      confirmText: '永久刪除',
      cancelText: '不要刪除',
      danger: true,
    });
    if (!second) return;
    try {
      await repo.clearAll();
      stopRest();
      showToast('已清除所有資料');
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  return (
    <section class="section danger-zone">
      <h2 class="section-title">危險操作</h2>
      <button type="button" class="btn btn-danger-outline btn-block" onClick={clearAll}>
        清除所有資料
      </button>
    </section>
  );
}
