import { useState } from 'preact/hooks';
import { useRepository } from '../hooks/useRepository';
import { estimateTdee } from '../lib/adaptiveTdee';
import { addDays, formatDateLabel, startOfWeek, todayString } from '../lib/date';
import { formatNumber } from '../lib/number';
import { latestBody, nutritionPlan } from '../lib/nutrition';
import { PLATEAU_TIPS } from '../lib/plateau';
import type { RecordKind } from '../lib/records';
import { formatWeight, toDisplay, unitLabel } from '../lib/units';
import { formatVolume } from '../lib/volume';
import { hasReview, weeklyReview, type WeekRecord } from '../lib/weeklyReview';
import { BODY_PART_LABELS } from '../types/models';

/** 收起後記住是哪一週（下週一再出現新的回顧） */
const DISMISS_KEY = 'fitlog:review-dismissed';
const RECORD_LABEL: Record<RecordKind, string> = { weight: '最大重量', e1rm: '估算 1RM', reps: '最多次數' };
/** 破紀錄最多列幾項 */
const MAX_RECORDS = 4;

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** 「+8%」「−3%」；前一週是 0 時不比較 */
function percentChange(now: number, before: number): string | null {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? '持平' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

/** 紀錄頁的「上週回顧」：每週一出現，收起後到下週一才再出現 */
export function WeeklyReviewCard() {
  const repo = useRepository();
  const thisWeek = startOfWeek();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [tipsOpen, setTipsOpen] = useState(false);
  if (dismissed === thisWeek) return null;

  const data = repo.getData();
  const review = weeklyReview({
    sessions: repo.getSessions(),
    bodyMetrics: data.bodyMetrics,
    foodEntries: data.foodEntries,
    weekStart: addDays(thisWeek, -7),
    traitsOf: repo.traitsOf,
    isAssisted: repo.isAssisted,
    getExercise: (id) => repo.getExercise(id),
    targets: repo.getSetTargets(),
  });
  if (!hasReview(review)) return null;

  const unit = repo.getWeightUnit();
  const u = unitLabel(unit);
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, thisWeek);
    } catch {
      // 存不進去就只在這次隱藏
    }
    setDismissed(thisWeek);
  };

  // 飲食目標：和飲食頁一樣的算法
  const profile = repo.getNutritionProfile();
  const metrics = repo.getBodyMetrics();
  const body = latestBody(metrics);
  const measured = estimateTdee(repo.getDailyKcal(), metrics, todayString());
  const plan =
    profile && body ? nutritionPlan(profile, body, new Date(), measured.ok ? measured.tdee : undefined) : null;

  const recordText = (r: WeekRecord) => {
    const name = repo.getExercise(r.exerciseId)?.name ?? '已刪除的動作';
    const value = (v: number) =>
      r.kind === 'reps' ? `${v} 下` : `${formatWeight(Math.round(v * 10) / 10, unit)} ${u}`;
    return `${name} ${RECORD_LABEL[r.kind]} ${value(r.value)}（原本 ${value(r.previous)}）`;
  };
  const volumeChange = percentChange(review.volume, review.prevVolume);
  const weightDiff =
    review.weight?.prevAvg != null ? Math.round((review.weight.avg - review.weight.prevAvg) * 10) / 10 : null;

  return (
    <section class="review-card" aria-labelledby="review-title">
      <header class="review-head">
        <div>
          <h2 id="review-title">上週回顧</h2>
          <span class="muted small-text">
            {formatDateLabel(review.start)} – {formatDateLabel(addDays(review.end, -1))}
          </span>
        </div>
        <button type="button" class="btn-text" onClick={dismiss}>
          收起
        </button>
      </header>
      <dl class="review-list">
        <dt>訓練</dt>
        <dd>
          <span class="num">{review.sessions}</span> 次
          {review.prevSessions > 0 && <span class="muted">（前一週 {review.prevSessions} 次）</span>}
          {review.volume > 0 && (
            <>
              ・<span class="num">{formatVolume(toDisplay(review.volume, unit))}</span> {u}
              {volumeChange && <span class="muted">（{volumeChange}）</span>}
            </>
          )}
        </dd>

        {review.records.length > 0 && (
          <>
            <dt>破紀錄</dt>
            <dd>
              <ul class="review-records">
                {review.records.slice(0, MAX_RECORDS).map((r) => (
                  <li key={`${r.exerciseId}-${r.kind}`}>
                    <span class="tag tag-pr">PR</span> {recordText(r)}
                  </li>
                ))}
              </ul>
              {review.records.length > MAX_RECORDS && (
                <a href="#/charts/pr" class="btn-text">
                  還有 {review.records.length - MAX_RECORDS} 項 ›
                </a>
              )}
            </dd>
          </>
        )}

        {review.weight && (
          <>
            <dt>體重</dt>
            <dd>
              平均 <span class="num">{formatNumber(Math.round(review.weight.avg * 10) / 10)}</span> kg
              {weightDiff !== null && (
                <span class="muted">
                  （
                  {weightDiff === 0
                    ? '和前一週一樣'
                    : `比前一週${weightDiff > 0 ? '多' : '少'} ${formatNumber(Math.abs(weightDiff))} kg`}
                  ）
                </span>
              )}
            </dd>
          </>
        )}

        {review.food && (
          <>
            <dt>飲食</dt>
            <dd>
              記錄 {review.food.days} 天，平均 <span class="num">{formatVolume(review.food.avgKcal)}</span> kcal
              {review.food.avgProtein !== null && (
                <>
                  ・蛋白質 <span class="num">{Math.round(review.food.avgProtein)}</span> g
                </>
              )}
              {plan && <span class="muted">（目標 {formatVolume(plan.target)} kcal）</span>}
            </dd>
          </>
        )}

        {review.lowParts.length > 0 && (
          <>
            <dt>組數不夠</dt>
            <dd>
              {review.lowParts.map((p, i) => (
                <span key={p.part}>
                  {i > 0 && '、'}
                  {BODY_PART_LABELS[p.part]} <span class="num">{p.sets}</span>/{p.min}
                </span>
              ))}
              <span class="muted"> 組</span>
            </dd>
          </>
        )}

        {review.plateaus.length > 0 && (
          <>
            <dt>停滯</dt>
            <dd>
              <ul class="review-records">
                {review.plateaus.slice(0, MAX_RECORDS).map((p) => (
                  <li key={p.exerciseId}>
                    <a href={`#/charts/exercise/${encodeURIComponent(p.exerciseId)}`} class="ex-link">
                      {repo.getExercise(p.exerciseId)?.name ?? '已刪除的動作'}
                    </a>{' '}
                    <span class="num">{p.weeks}</span> 週沒進步
                    <span class="muted">（之後練了 {p.sessionsSince} 次）</span>
                  </li>
                ))}
              </ul>
              {tipsOpen ? (
                <ul class="review-tips">
                  {PLATEAU_TIPS.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : (
                <button type="button" class="btn-text" onClick={() => setTipsOpen(true)}>
                  可以怎麼做 ›
                </button>
              )}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
