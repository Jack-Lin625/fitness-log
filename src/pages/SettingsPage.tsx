import { confirmDialog } from '../components/Dialog';
import { PageHeader } from '../components/PageHeader';
import { CloudBackupSection } from '../components/CloudBackup';
import { ClearDataSection, DataManagement } from '../components/DataManagement';
import { showToast } from '../components/Toast';
import { useRepository } from '../hooks/useRepository';
import { errorMessage } from '../lib/errors';
import { convertDraftUnit } from '../lib/draft';
import { formatDuration } from '../lib/number';
import { BODY_PARTS, BODY_PART_LABELS, type Exercise, type Settings, type WeightUnit } from '../types/models';

const REST_STEP = 15;
const REST_MIN = 15;
const REST_MAX = 600;

export function SettingsPage() {
  const repo = useRepository();
  const status = repo.loadStatus;
  const settings = repo.getSettings();
  const data = repo.getData();
  const exercises = repo.getExercises();
  const sizeKb = (JSON.stringify(data).length / 1024).toFixed(1);

  const update = (patch: Partial<Settings>) =>
    repo.updateSettings(patch).catch((err) => showToast(errorMessage(err)));

  const unit = repo.getWeightUnit();
  /** 切換單位：資料都以公斤儲存不必改；進行中的訓練草稿裡已輸入的重量要換算 */
  const changeUnit = async (next: WeightUnit) => {
    if (next === unit) return;
    try {
      const draft = repo.getDraft();
      if (draft) await repo.saveDraft(convertDraftUnit(draft, unit, next));
      await repo.updateSettings({ weightUnit: next });
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const customRests = Object.entries(settings.restByExercise ?? {})
    .map(([id, sec]) => ({ id, sec, name: repo.getExercise(id)?.name ?? '已刪除的動作' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  const changeRest = (delta: number) => {
    const next = Math.min(REST_MAX, Math.max(REST_MIN, settings.defaultRestSeconds + delta));
    void update({ defaultRestSeconds: next });
  };

  const removeCustom = async (exercise: Exercise) => {
    const ok = await confirmDialog({
      title: `刪除「${exercise.name}」？`,
      body: '以前的紀錄仍會保留這個動作，只是之後不會出現在動作清單中。',
      confirmText: '刪除',
      danger: true,
    });
    if (!ok) return;
    try {
      await repo.archiveCustomExercise(exercise.id);
      showToast(`已刪除「${exercise.name}」`);
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="設定" />

      {!status.ok && (
        <div class="alert" role="alert">
          <strong>讀取資料失敗：</strong>
          {status.message}
          {status.backupKey ? '。原始資料已另存備份，目前以空白資料啟動。' : '。目前以空白資料啟動。'}
        </div>
      )}

      <section class="section">
        <h2 class="section-title">重量單位</h2>
        <div class="segmented" role="radiogroup" aria-label="重量單位">
          {(['kg', 'lb'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              class={unit === u ? 'segment is-active' : 'segment'}
              onClick={() => void changeUnit(u)}
            >
              {u === 'kg' ? '公斤 kg' : '磅 lb'}
            </button>
          ))}
        </div>
        <p class="muted small-text">
          只影響訓練重量的輸入與顯示，已存的紀錄不會改變，隨時可以切換回來。體重與飲食仍以公斤計算。
        </p>
      </section>

      <section class="section">
        <h2 class="section-title">組間休息</h2>
        <div class="settings-card">
          <div class="stepper-row">
            <span>預設休息時間</span>
            <div class="stepper">
              <button
                type="button"
                class="stepper-btn"
                aria-label="減少 15 秒"
                disabled={settings.defaultRestSeconds <= REST_MIN}
                onClick={() => changeRest(-REST_STEP)}
              >
                −
              </button>
              <span class="num stepper-value">{formatDuration(settings.defaultRestSeconds)}</span>
              <button
                type="button"
                class="stepper-btn"
                aria-label="增加 15 秒"
                disabled={settings.defaultRestSeconds >= REST_MAX}
                onClick={() => changeRest(REST_STEP)}
              >
                ＋
              </button>
            </div>
          </div>
          {customRests.length > 0 && (
            <div class="rest-overrides">
              <span class="muted small-text">個別動作的休息時間（在訓練畫面動作的「⋯」裡設定）</span>
              {customRests.map((r) => (
                <div key={r.id} class="custom-row">
                  <span>
                    {r.name} <span class="num muted">{formatDuration(r.sec)}</span>
                  </span>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    onClick={() => repo.setExerciseRest(r.id, null).catch((err) => showToast(errorMessage(err)))}
                  >
                    改回預設
                  </button>
                </div>
              ))}
            </div>
          )}
          <label class="switch-row">
            <span>結束時播放提示音</span>
            <input
              type="checkbox"
              role="switch"
              class="switch"
              checked={settings.timerSound}
              onChange={(e) => update({ timerSound: e.currentTarget.checked })}
            />
          </label>
          <label class="switch-row">
            <span>
              結束時震動
              <small class="muted">iPhone 的瀏覽器不支援震動</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              class="switch"
              checked={settings.timerVibrate}
              onChange={(e) => update({ timerVibrate: e.currentTarget.checked })}
            />
          </label>
        </div>
      </section>

      <CloudBackupSection />

      <DataManagement />

      <section class="section">
        <details class="exercise-list">
          <summary>
            動作清單 <span class="num muted">{exercises.length}</span>
          </summary>
          {BODY_PARTS.map((part) => {
            const list = exercises.filter((e) => e.bodyPart === part);
            const builtIn = list.filter((e) => !e.isCustom);
            const custom = list.filter((e) => e.isCustom);
            return (
              <div key={part} class="part-group">
                <h3>
                  <span class={`part-dot part-${part}`} aria-hidden="true" />
                  {BODY_PART_LABELS[part]}
                </h3>
                <p>{builtIn.map((e) => e.name).join('、')}</p>
                {custom.map((e) => (
                  <div key={e.id} class="custom-row">
                    <span>
                      {e.name} <span class="tag">自訂</span>
                    </span>
                    <button type="button" class="btn btn-danger-text btn-sm" onClick={() => removeCustom(e)}>
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </details>
      </section>

      <section class="section">
        <h2 class="section-title">資料狀態</h2>
        <dl class="kv">
          <dt>資料格式版本</dt>
          <dd class="num">v{data.version}</dd>
          <dt>訓練紀錄</dt>
          <dd>
            <span class="num">{data.sessions.length}</span> 筆
          </dd>
          <dt>體態紀錄</dt>
          <dd>
            <span class="num">{data.bodyMetrics.length}</span> 筆
          </dd>
          <dt>飲食紀錄</dt>
          <dd>
            <span class="num">{data.foodEntries.length}</span> 筆
          </dd>
          <dt>菜單範本</dt>
          <dd>
            <span class="num">{data.templates.length}</span> 個
          </dd>
          <dt>自訂動作</dt>
          <dd>
            <span class="num">{data.customExercises.filter((e) => !e.archived).length}</span> 個
          </dd>
          <dt>使用空間</dt>
          <dd>
            <span class="num">{sizeKb}</span> KB
          </dd>
        </dl>
      </section>

      <ClearDataSection />
    </>
  );
}
