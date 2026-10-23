import { useEffect, useRef, useState } from 'preact/hooks';
import { confirmDialog } from './Dialog';
import { showToast } from './Toast';
import { migrate } from '../data/migrations';
import { clearPhotos, photoUsage } from '../data/photoStore';
import { useRepository } from '../hooks/useRepository';
import { errorMessage } from '../lib/errors';
import { BACKUP_REMIND_DAYS, daysSinceBackup as getDaysSinceBackup, downloadBackup } from '../actions/backup';
import { bodyMetricsToCsv, datedName, downloadFile, foodEntriesToCsv, readFileText, sessionsToCsv } from '../lib/exporters';
import { exportPhotosJson, formatBytes, importPhotosJson } from '../lib/photos';
import { stopRest } from '../lib/restTimer';

/** 設定頁的資料管理：備份、匯入、CSV、清除 */
export function DataManagement() {
  const repo = useRepository();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const data = repo.getData();
  const lastBackupAt = data.settings.lastBackupAt;
  const daysSinceBackup = getDaysSinceBackup();
  const hasData =
    data.sessions.length + data.bodyMetrics.length + data.customExercises.length + data.foodEntries.length > 0;

  const exportSessionsCsv = () => {
    if (data.sessions.length === 0) return showToast('還沒有訓練紀錄');
    void downloadFile(datedName('fitlog-workouts', 'csv'), sessionsToCsv(data.sessions, (id) => repo.getExercise(id)), 'text/csv');
  };

  const exportBodyCsv = () => {
    if (data.bodyMetrics.length === 0) return showToast('還沒有體態紀錄');
    void downloadFile(datedName('fitlog-body', 'csv'), bodyMetricsToCsv(data.bodyMetrics), 'text/csv');
  };

  const exportFoodCsv = () => {
    if (data.foodEntries.length === 0) return showToast('還沒有飲食紀錄');
    void downloadFile(datedName('fitlog-food', 'csv'), foodEntriesToCsv(data.foodEntries), 'text/csv');
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
          `飲食 ${incoming.foodEntries.length} 筆、自訂動作 ${incoming.customExercises.length} 個、` +
          `菜單範本 ${incoming.templates.length} 個。` +
          `目前 App 裡的資料會被取代（訓練 ${data.sessions.length} 筆、體態 ${data.bodyMetrics.length} 筆、` +
          `飲食 ${data.foodEntries.length} 筆）。飲食照片另外備份，不受影響。`,
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

        {hasData && (daysSinceBackup === null || daysSinceBackup >= BACKUP_REMIND_DAYS) && (
          <p class="note note-warn">
            {daysSinceBackup === null ? '還沒有備份過。' : `已經 ${daysSinceBackup} 天沒有備份了。`}
            資料只存在這支手機的瀏覽器裡，換手機、清除瀏覽器資料或手機故障都會遺失，建議定期下載備份。
          </p>
        )}

        <div class="action-stack">
          <button type="button" class="btn btn-primary btn-block btn-two-line" onClick={() => void downloadBackup()}>
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
        <div class="button-trio">
          <button type="button" class="btn btn-secondary" onClick={exportSessionsCsv}>
            訓練
          </button>
          <button type="button" class="btn btn-secondary" onClick={exportBodyCsv}>
            體態
          </button>
          <button type="button" class="btn btn-secondary" onClick={exportFoodCsv}>
            飲食
          </button>
        </div>
        <p class="muted small-text">可以用 Excel 或 Google 試算表開啟。CSV 只能匯出，不能匯入回 App。</p>
      </section>

      <PhotoBackupSection />
    </>
  );
}

/**
 * 飲食照片的備份：照片很大，不放進「完整備份」，另外下載成一個檔案。
 * 換手機時先匯入完整備份，再匯入照片備份。
 */
function PhotoBackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const refresh = () =>
    photoUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  useEffect(() => void refresh(), []);

  const exportPhotos = async () => {
    setBusy('export');
    try {
      const { json, count } = await exportPhotosJson();
      if (count === 0) return showToast('還沒有飲食照片');
      if (await downloadFile(datedName('fitlog-photos', 'json'), json, 'application/json')) {
        showToast(`已下載 ${count} 張照片`);
      }
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const importPhotos = async (file: File | undefined) => {
    if (!file) return;
    setBusy('import');
    try {
      const count = await importPhotosJson(await readFileText(file));
      showToast(`已匯入 ${count} 張照片`);
      void refresh();
    } catch (err) {
      showToast(errorMessage(err), 4000);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section class="section">
      <h2 class="section-title">飲食照片</h2>
      <p class="muted small-text">
        {usage && (usage.count === 0 ? '目前沒有照片。' : `目前 ${usage.count} 張，約 ${formatBytes(usage.bytes)}。`)}
        照片不在「完整備份」裡，換手機時請另外下載照片備份，在新手機先匯入完整備份、再匯入照片。
      </p>
      <div class="button-pair">
        <button type="button" class="btn btn-secondary" disabled={busy !== null} onClick={exportPhotos}>
          {busy === 'export' ? '打包中…' : '下載所有照片'}
        </button>
        <button type="button" class="btn btn-secondary" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          {busy === 'import' ? '匯入中…' : '匯入照片備份'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void importPhotos(e.currentTarget.files?.[0])}
      />
    </section>
  );
}

/** 清除所有資料（放在設定頁最下方） */
export function ClearDataSection() {
  const repo = useRepository();
  /** 清除所有資料：需要確認兩次 */
  const clearAll = async () => {
    const first = await confirmDialog({
      title: '清除所有資料？',
      body: '訓練、體態、飲食紀錄與照片、自訂動作和設定都會刪除。建議先下載備份。',
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
      await clearPhotos().catch(() => undefined);
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
