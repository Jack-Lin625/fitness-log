import { useState } from 'preact/hooks';
import { BigStat } from '../components/BigStat';
import { FoodEntrySheet } from '../components/diet/FoodEntrySheet';
import { PhotoThumb } from '../components/diet/PhotoThumb';
import { ProfileSheet } from '../components/diet/ProfileSheet';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useRepository } from '../hooks/useRepository';
import { addDays, formatDateLabel, todayString } from '../lib/date';
import { formatNumber } from '../lib/number';
import { estimateTdee, MIN_FOOD_DAYS, MIN_WEIGH_INS, WINDOW_DAYS, type AdaptiveTdee } from '../lib/adaptiveTdee';
import { errorMessage } from '../lib/errors';
import { GOAL_OPTIONS, latestBody, nutritionPlan, type NutritionPlan } from '../lib/nutrition';
import { showToast } from '../components/Toast';
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type NutritionProfile } from '../types/models';

const kcalText = (v: number) => Math.round(v).toLocaleString('en-US');

/** 飲食：每日目標、今天吃了什麼、近 7 天 */
export function DietPage() {
  const repo = useRepository();
  const today = todayString();
  const [date, setDate] = useState(today);
  /** undefined = 關閉；null = 新增；FoodEntry = 修改 */
  const [entrySheet, setEntrySheet] = useState<FoodEntry | null | undefined>(undefined);
  const [profileOpen, setProfileOpen] = useState(false);

  const profile = repo.getNutritionProfile();
  const metrics = repo.getBodyMetrics();
  const body = latestBody(metrics);
  // 用近 4 週的飲食與體重推算實際 TDEE（資料不夠時 ok 為 false）
  const measured = estimateTdee(repo.getDailyKcal(), metrics, today);
  const plan = profile && body ? nutritionPlan(profile, body, new Date(), measured.ok ? measured.tdee : undefined) : null;
  const entries = repo.getFoodEntries(date);
  const eaten = entries.reduce((n, e) => n + e.kcal, 0);
  const macroEaten = (key: 'protein' | 'carbs' | 'fat') => entries.reduce((n, e) => n + (e[key] ?? 0), 0);

  const sheets = (
    <>
      {entrySheet !== undefined && (
        <FoodEntrySheet initial={entrySheet ?? undefined} date={date} onClose={() => setEntrySheet(undefined)} />
      )}
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}
    </>
  );

  return (
    <>
      <PageHeader
        title="飲食"
        subtitle={date === today ? `今天 ${formatDateLabel(date)}` : formatDateLabel(date)}
        action={
          <button type="button" class="btn btn-primary btn-sm" onClick={() => setEntrySheet(null)}>
            ＋ 記錄
          </button>
        }
      />

      <div class="date-nav">
        <button type="button" class="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))}>
          ‹ 前一天
        </button>
        {date !== today && (
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => setDate(today)}>
            回到今天
          </button>
        )}
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={date >= today}
          onClick={() => setDate(addDays(date, 1))}
        >
          後一天 ›
        </button>
      </div>

      {plan ? (
        <>
          <div class="stat-row">
            <BigStat value={kcalText(eaten)} unit="kcal" label="已攝取" hint={`目標 ${kcalText(plan.target)} kcal`} />
            <BigStat
              value={kcalText(Math.abs(plan.target - eaten))}
              unit="kcal"
              label={eaten > plan.target ? '超過目標' : '還可以吃'}
            />
          </div>
          <div
            class={eaten > plan.target ? 'kcal-bar is-over' : 'kcal-bar'}
            role="progressbar"
            aria-label="今日熱量進度"
            aria-valuemin={0}
            aria-valuemax={plan.target}
            aria-valuenow={Math.round(eaten)}
          >
            <div style={{ width: `${Math.min(100, (eaten / plan.target) * 100)}%` }} />
          </div>
          <ul class="macro-row">
            {(
              [
                ['protein', '蛋白質', plan.protein],
                ['carbs', '碳水', plan.carbs],
                ['fat', '脂肪', plan.fat],
              ] as const
            ).map(([key, label, target]) => (
              <li key={key}>
                <span class="muted">{label}</span>
                <span>
                  <span class="num">{formatNumber(Math.round(macroEaten(key)))}</span>
                  <span class="muted"> / {target} g</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <button type="button" class="resume-card" onClick={() => setProfileOpen(true)}>
          <span class="resume-title">設定 TDEE，算出每天該吃多少</span>
          <span class="resume-sub">填身高、出生年和活動量，依減脂、維持或增肌給你每日熱量與三大營養素</span>
        </button>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title={date === today ? '今天還沒有紀錄' : '這天沒有紀錄'}
          body="每一餐拍張照、填上熱量，就能看出離目標還差多少。"
        />
      ) : (
        MEAL_TYPES.map((meal) => {
          const list = entries.filter((e) => e.meal === meal);
          if (list.length === 0) return null;
          return (
            <section key={meal} class="section">
              <h2 class="section-title meal-title">
                <span>{MEAL_LABELS[meal]}</span>
                <span class="num">{kcalText(list.reduce((n, e) => n + e.kcal, 0))} kcal</span>
              </h2>
              <ul class="session-list">
                {list.map((e) => (
                  <li key={e.id}>
                    <button type="button" class="food-row" onClick={() => setEntrySheet(e)}>
                      <PhotoThumb photoId={e.photoId} />
                      <span class="food-main">
                        <span class="food-name">{e.name}</span>
                        {(e.protein ?? e.carbs ?? e.fat) !== undefined && (
                          <span class="muted small-text">
                            {[
                              e.protein !== undefined ? `蛋白質 ${formatNumber(e.protein)}g` : '',
                              e.carbs !== undefined ? `碳水 ${formatNumber(e.carbs)}g` : '',
                              e.fat !== undefined ? `脂肪 ${formatNumber(e.fat)}g` : '',
                            ]
                              .filter(Boolean)
                              .join('・')}
                          </span>
                        )}
                      </span>
                      <span class="food-kcal">
                        <span class="num">{kcalText(e.kcal)}</span> kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {plan && profile && body && (
        <section class="section">
          <h2 class="section-title">我的目標</h2>
          <div class="settings-card plan-card">
            <dl class="kv kv-plain">
              <dt>目標</dt>
              <dd>{GOAL_OPTIONS.find((g) => g.id === profile.goal)?.label}</dd>
              <dt>TDEE（每日消耗）{plan.tdeeSource === 'measured' && <small class="muted">・實際推算</small>}</dt>
              <dd>
                <span class="num">{kcalText(plan.tdee)}</span> kcal
              </dd>
              <dt>基礎代謝</dt>
              <dd>
                <span class="num">{kcalText(plan.bmr)}</span> kcal
              </dd>
              <dt>每日目標</dt>
              <dd>
                <span class="num">{kcalText(plan.target)}</span> kcal
              </dd>
              {plan.weeklyChangeKg !== 0 && (
                <>
                  <dt>預估每週體重</dt>
                  <dd>
                    <span class="num">
                      {plan.weeklyChangeKg > 0 ? '+' : '−'}
                      {formatNumber(Math.abs(plan.weeklyChangeKg))}
                    </span>{' '}
                    kg
                  </dd>
                </>
              )}
            </dl>
            <p class="muted small-text">
              以 {formatNumber(body.weightKg)} kg（{formatDateLabel(body.weightDate)}）計算，
              {plan.formula === 'katch'
                ? `並用體脂率 ${formatNumber(body.bodyFatPct ?? 0)}% 以 Katch-McArdle 公式估算基礎代謝。`
                : '以 Mifflin-St Jeor 公式估算基礎代謝；記錄體脂率會改用更準的公式。'}
              {plan.raisedToBmr && '減脂目標已拉高到基礎代謝，避免吃太少。'}
            </p>
            <button type="button" class="btn btn-secondary btn-block" onClick={() => setProfileOpen(true)}>
              修改 TDEE 設定
            </button>
          </div>
          <MeasuredTdeeCard estimate={measured} plan={plan} profile={profile} />
        </section>
      )}

      <WeekSummary target={plan?.target ?? null} today={today} onPick={setDate} selected={date} />

      <p class="note">
        熱量與 TDEE 都是估算值，個人差異可能有 10% 以上。照目標吃 2–3 週後，看體重的 7 日平均有沒有照預期變化，再往上或往下調整約 100–200 kcal。
      </p>

      {sheets}
    </>
  );
}

/** 由實際紀錄推算的 TDEE：資料夠時顯示結果並可以採用，不夠時顯示還缺什麼 */
function MeasuredTdeeCard(props: { estimate: AdaptiveTdee; plan: NutritionPlan; profile: NutritionProfile }) {
  const repo = useRepository();
  const { estimate: e, plan, profile } = props;
  const using = profile.useMeasuredTdee === true;

  const toggle = async (on: boolean) => {
    const { useMeasuredTdee: _, ...rest } = profile;
    try {
      await repo.saveNutritionProfile(on ? { ...rest, useMeasuredTdee: true } : rest);
      showToast(on ? '已改用實際推算的 TDEE 設定目標' : '已改回公式估計的 TDEE');
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  if (!e.ok) {
    return (
      <div class="settings-card measured-card">
        <strong>用你的紀錄推算真正的 TDEE</strong>
        <p class="muted small-text">
          公式估計的 TDEE 個人誤差常有 10–20%。累積 {WINDOW_DAYS} 天內至少 {MIN_FOOD_DAYS} 天的完整飲食紀錄、{MIN_WEIGH_INS} 次以上的體重，
          就能用「吃了多少」和「體重實際變化」算出你真正的維持熱量。
        </p>
        <div class="measured-progress">
          <span>
            飲食 <span class="num">{Math.min(e.foodDays, MIN_FOOD_DAYS)}</span>/{MIN_FOOD_DAYS} 天
          </span>
          <span>
            體重 <span class="num">{Math.min(e.weighIns, MIN_WEIGH_INS)}</span>/{MIN_WEIGH_INS} 次
          </span>
        </div>
        <p class="small-text">還需要：{e.missing.join('、')}</p>
      </div>
    );
  }

  const diff = e.tdee - plan.formulaTdee;
  const change = e.weeklyChangeKg;
  return (
    <div class="settings-card measured-card">
      <strong>
        依你的紀錄，實際維持熱量約 <span class="num">{kcalText(e.tdee)}</span> kcal
      </strong>
      <p class="muted small-text">
        {formatDateLabel(e.from)}～{formatDateLabel(e.to)}：記錄了 {e.foodDays} 天飲食、平均每天 {kcalText(e.avgIntake)} kcal；
        量了 {e.weighIns} 次體重，趨勢{change === 0 ? '持平' : `每週${change > 0 ? '增加' : '減少'} ${formatNumber(Math.abs(change))} kg`}。
        公式估計是 {kcalText(plan.formulaTdee)} kcal（相差 {diff > 0 ? '+' : diff < 0 ? '−' : ''}{kcalText(Math.abs(diff))}）。
      </p>
      <label class="switch-row">
        <span>用這個數字設定每日目標</span>
        <input type="checkbox" role="switch" class="switch" checked={using} onChange={(ev) => void toggle(ev.currentTarget.checked)} />
      </label>
      <p class="muted small-text">沒記到的零食、飲料或熱量估太低，都會讓推算值偏低；請盡量把吃的都記下來。數字每天會隨新紀錄更新。</p>
    </div>
  );
}

/** 近 7 天每日熱量（點一下跳到那天） */
function WeekSummary(props: { target: number | null; today: string; selected: string; onPick: (date: string) => void }) {
  const repo = useRepository();
  const totals = repo.getDailyKcal();
  const days = Array.from({ length: 7 }, (_, i) => addDays(props.today, i - 6)).reverse();
  if (days.every((d) => !totals.has(d))) return null;
  const max = Math.max(props.target ?? 0, ...days.map((d) => totals.get(d) ?? 0), 1);

  return (
    <section class="section">
      <h2 class="section-title">近 7 天</h2>
      <ul class="session-list week-list">
        {days.map((d) => {
          const kcal = totals.get(d) ?? 0;
          const over = props.target !== null && kcal > props.target;
          return (
            <li key={d}>
              <button
                type="button"
                class={d === props.selected ? 'week-row is-selected' : 'week-row'}
                onClick={() => props.onPick(d)}
              >
                <span class="week-date">{formatDateLabel(d)}</span>
                <span class="week-bar" aria-hidden="true">
                  <span class={over ? 'is-over' : ''} style={{ width: `${(kcal / max) * 100}%` }} />
                  {props.target !== null && <i style={{ left: `${(props.target / max) * 100}%` }} />}
                </span>
                <span class="week-kcal num">{kcal > 0 ? kcalText(kcal) : '–'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
