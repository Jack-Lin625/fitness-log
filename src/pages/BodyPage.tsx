import { useState } from 'preact/hooks';
import { BigStat } from '../components/BigStat';
import { BodyChart } from '../components/body/BodyChart';
import { BodyMetricSheet } from '../components/body/BodyMetricSheet';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useRepository } from '../hooks/useRepository';
import { ALL_METRICS, metricSeries, STORED_METRICS, type MetricKey } from '../lib/bodyMetrics';
import { addDays, formatDateLabel, todayString } from '../lib/date';
import { movingAverage } from '../lib/movingAverage';
import { formatNumber } from '../lib/number';
import type { BodyMetric } from '../types/models';

type Range = '1m' | '3m' | '6m' | 'all';
const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: '1m', label: '1 個月', days: 31 },
  { id: '3m', label: '3 個月', days: 91 },
  { id: '6m', label: '半年', days: 182 },
  { id: 'all', label: '全部', days: null },
];

/** 比較「目前 7 日平均」與「30 天前的 7 日平均」 */
const CHANGE_DAYS = 30;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 歷史紀錄一次顯示的筆數 */
const HISTORY_PAGE = 20;

export function BodyPage() {
  const repo = useRepository();
  const metrics = repo.getBodyMetrics();
  const [metricKey, setMetricKey] = useState<MetricKey>('weight');
  const [range, setRange] = useState<Range>('3m');
  const [showAvg, setShowAvg] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  /** undefined = 關閉；null = 新增；BodyMetric = 修改 */
  const [sheet, setSheet] = useState<BodyMetric | null | undefined>(undefined);

  const sheetEl =
    sheet !== undefined ? <BodyMetricSheet initial={sheet ?? undefined} onClose={() => setSheet(undefined)} /> : null;

  const addButton = (
    <button type="button" class="btn btn-primary btn-sm" onClick={() => setSheet(null)}>
      ＋ 記錄
    </button>
  );

  if (metrics.length === 0) {
    return (
      <>
        <PageHeader title="體態追蹤" />
        <EmptyState
          title="還沒有體態紀錄"
          body="記下體重、體脂率和各部位圍度，每項都可以留白。累積幾筆之後，這裡會畫出長期趨勢。"
        />
        <button type="button" class="btn btn-primary btn-block" onClick={() => setSheet(null)}>
          記錄今天的體態
        </button>
        {sheetEl}
      </>
    );
  }

  // 只顯示有資料的項目
  const available = ALL_METRICS.filter((d) => metricSeries(metrics, d.key).length > 0);
  const def = available.find((d) => d.key === metricKey) ?? available[0]!;
  const allPoints = metricSeries(metrics, def.key);
  const allAvg = movingAverage(allPoints, 7);

  const days = RANGES.find((r) => r.id === range)?.days ?? null;
  const cutoff = days === null ? '' : addDays(todayString(), -days);
  const points = allPoints.filter((p) => p.date >= cutoff);
  const avg = allAvg.filter((p) => p.date >= cutoff);

  // 最新值與 30 天變化（以 7 日平均比較，降低每天波動的影響）
  const latest = allPoints[allPoints.length - 1]!;
  const latestAvg = allAvg[allAvg.length - 1]!;
  const pastCutoff = addDays(latestAvg.date, -CHANGE_DAYS);
  const past = [...allAvg].reverse().find((p) => p.date <= pastCutoff);
  const change = past ? round1(latestAvg.value - past.value) : null;

  return (
    <>
      <PageHeader title="體態追蹤" action={addButton} />

      <div class="chips" role="tablist" aria-label="項目">
        {available.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={d.key === def.key}
            class={d.key === def.key ? 'chip is-active' : 'chip'}
            onClick={() => setMetricKey(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div class="stat-row">
        <BigStat
          value={formatNumber(round1(latest.value))}
          unit={def.unit}
          label={`最新${def.label}`}
          hint={formatDateLabel(latest.date)}
        />
        <BigStat
          value={change === null ? '–' : `${change > 0 ? '+' : change < 0 ? '−' : '±'}${formatNumber(Math.abs(change))}`}
          unit={def.unit}
          label={`近 ${CHANGE_DAYS} 天變化`}
          hint={change === null ? `需要 ${CHANGE_DAYS} 天以上的紀錄` : '以 7 日平均比較'}
        />
      </div>

      <div class="chips" role="group" aria-label="時間範圍">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            class={range === r.id ? 'chip is-active' : 'chip'}
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <p class="note">這段期間沒有{def.label}的紀錄，試試看更長的時間範圍。</p>
      ) : (
        <BodyChart def={def} points={points} average={showAvg ? avg : null} />
      )}

      <label class="switch-row settings-card">
        <span>
          顯示 7 日移動平均
          <small class="muted">把每天的波動抹平，比較容易看出長期是增還是減</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          checked={showAvg}
          onChange={(e) => setShowAvg(e.currentTarget.checked)}
        />
      </label>

      {def.key === 'leanMass' && (
        <p class="note">去脂體重 = 體重 × (1 − 體脂率)，只有同一天同時記錄體重和體脂率才算得出來。體脂計的誤差會直接影響這個數字。</p>
      )}

      <p class="note">每次在相同條件下測量（例如早上起床、如廁後、進食前）比較準確。</p>

      <section class="section">
        <h2 class="section-title">歷史紀錄（{metrics.length} 筆）</h2>
        <ul class="session-list">
          {[...metrics].reverse().slice(0, historyLimit).map((m) => (
            <li key={m.id}>
              <button type="button" class="body-row" onClick={() => setSheet(m)}>
                <span class="session-date">{formatDateLabel(m.date)}</span>
                <span class="body-values">
                  {STORED_METRICS.filter((d) => m[d.key] !== undefined).map((d) => (
                    <span key={d.key} class="body-value">
                      <span class="muted">{d.short}</span>
                      <span class="num">{formatNumber(m[d.key]!)}</span>
                      <span class="muted">{d.unit}</span>
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {metrics.length > historyLimit && (
          <button type="button" class="btn btn-ghost btn-block" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}>
            顯示更多（還有 {metrics.length - historyLimit} 筆）
          </button>
        )}
      </section>

      {sheetEl}
    </>
  );
}
