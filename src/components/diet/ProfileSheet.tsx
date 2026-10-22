import { useEffect, useState } from 'preact/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formatDateLabel, todayString } from '../../lib/date';
import { errorMessage } from '../../lib/errors';
import { createId } from '../../lib/id';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, latestBody, nutritionPlan } from '../../lib/nutrition';
import { formatNumber, parseNumber, sanitizeDecimalInput } from '../../lib/number';
import type { ActivityLevel, NutritionGoal, NutritionProfile, Sex } from '../../types/models';
import { showToast } from '../Toast';

/** 設定 TDEE 的全螢幕表單：個人資料、體重、活動量、目標，邊填邊算 */
export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const repo = useRepository();
  const saved = repo.getNutritionProfile();
  const body = latestBody(repo.getBodyMetrics());

  const [sex, setSex] = useState<Sex>(saved?.sex ?? 'male');
  const [birthYear, setBirthYear] = useState(saved ? String(saved.birthYear) : '');
  const [height, setHeight] = useState(saved ? formatNumber(saved.heightCm) : '');
  const [weight, setWeight] = useState(body ? formatNumber(body.weightKg) : '');
  const [activity, setActivity] = useState<ActivityLevel>(saved?.activity ?? 'moderate');
  const [goal, setGoal] = useState<NutritionGoal>(saved?.goal ?? 'maintain');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const thisYear = new Date().getFullYear();
  const by = parseNumber(birthYear);
  const h = parseNumber(height);
  const w = parseNumber(weight);
  const errors = [
    by === null || by < thisYear - 100 || by > thisYear - 10 ? `出生年請輸入 ${thisYear - 100}–${thisYear - 10}` : null,
    h === null || h < 100 || h > 250 ? '身高請輸入 100–250 cm' : null,
    w === null || w < 20 || w > 300 ? '體重請輸入 20–300 kg' : null,
  ].filter((e): e is string => e !== null);

  const profile: NutritionProfile | null =
    errors.length === 0 ? { sex, birthYear: by!, heightCm: h!, activity, goal } : null;
  // 體重改了就不沿用舊的體脂率（體脂率是相對於當時的體重）
  const sameWeight = body !== null && w === body.weightKg;
  const preview =
    profile && w !== null
      ? nutritionPlan(profile, {
          weightKg: w,
          weightDate: todayString(),
          ...(sameWeight && body?.bodyFatPct !== undefined ? { bodyFatPct: body.bodyFatPct } : {}),
        })
      : null;

  const save = async () => {
    if (!profile || w === null) return showToast(errors[0] ?? '請完成所有欄位');
    setSaving(true);
    try {
      await repo.saveNutritionProfile(profile);
      // 體重有變：記到今天的體態紀錄（同一天已有紀錄就只更新體重）
      if (!sameWeight) {
        const today = repo.getBodyMetricByDate(todayString());
        await repo.saveBodyMetric(today ? { ...today, weight: w } : { id: createId(), date: todayString(), weight: w });
      }
      showToast('已更新 TDEE 設定');
      onClose();
    } catch (err) {
      showToast(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label="TDEE 設定">
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          取消
        </button>
        <h2>TDEE 設定</h2>
        <button type="button" class="btn-text sheet-save" disabled={saving} onClick={save}>
          儲存
        </button>
      </header>

      <div class="sheet-form">
        <div class="field">
          <span class="field-label">性別</span>
          <div class="chips">
            {(['male', 'female'] as const).map((s) => (
              <button
                key={s}
                type="button"
                class={sex === s ? 'chip is-active' : 'chip'}
                aria-pressed={sex === s}
                onClick={() => setSex(s)}
              >
                {s === 'male' ? '男' : '女'}
              </button>
            ))}
          </div>
        </div>

        <div class="metric-grid metric-grid-3">
          <label class="big-field">
            <span class="field-label">出生年</span>
            <input
              class="big-input big-input-sm num"
              inputMode="numeric"
              placeholder="1998"
              value={birthYear}
              onInput={(e) => setBirthYear(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <label class="big-field">
            <span class="field-label">身高 cm</span>
            <input
              class="big-input big-input-sm num"
              inputMode="decimal"
              placeholder="170"
              value={height}
              onInput={(e) => setHeight(sanitizeDecimalInput(e.currentTarget.value))}
            />
          </label>
          <label class="big-field">
            <span class="field-label">體重 kg</span>
            <input
              class="big-input big-input-sm num"
              inputMode="decimal"
              placeholder="65"
              value={weight}
              onInput={(e) => setWeight(sanitizeDecimalInput(e.currentTarget.value))}
            />
          </label>
        </div>
        <p class="muted small-text">
          {body
            ? `體重預設帶入 ${formatDateLabel(body.weightDate)} 的紀錄；改了會記到今天的體態紀錄。`
            : '體重會記到今天的體態紀錄。'}
        </p>

        <div class="field">
          <span class="field-label">活動量（含訓練）</span>
          <div class="option-list" role="radiogroup" aria-label="活動量">
            {ACTIVITY_OPTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={activity === a.id}
                class={activity === a.id ? 'option-row is-active' : 'option-row'}
                onClick={() => setActivity(a.id)}
              >
                <span class="option-title">{a.label}</span>
                <span class="option-detail">{a.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="field">
          <span class="field-label">目標</span>
          <div class="option-list" role="radiogroup" aria-label="目標">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={goal === g.id}
                class={goal === g.id ? 'option-row is-active' : 'option-row'}
                onClick={() => setGoal(g.id)}
              >
                <span class="option-title">{g.label}</span>
                <span class="option-detail">{g.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {preview ? (
          <div class="stat-row">
            <div class="big-stat">
              <div class="big-stat-value">
                <span class="num">{preview.tdee.toLocaleString('en-US')}</span>
                <span class="big-stat-unit">kcal</span>
              </div>
              <div class="big-stat-label">TDEE（每日消耗）</div>
            </div>
            <div class="big-stat">
              <div class="big-stat-value">
                <span class="num">{preview.target.toLocaleString('en-US')}</span>
                <span class="big-stat-unit">kcal</span>
              </div>
              <div class="big-stat-label">每日目標</div>
            </div>
          </div>
        ) : (
          <p class="note">{errors[0]}</p>
        )}

        <button type="button" class="btn btn-primary btn-block" disabled={saving} onClick={save}>
          儲存
        </button>
      </div>
    </div>
  );
}
