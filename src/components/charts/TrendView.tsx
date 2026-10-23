import { BigStat } from '../BigStat';
import { ChartCanvas } from '../ChartCanvas';
import { EmptyState } from '../EmptyState';
import { navigate } from '../../hooks/useHashRoute';
import { useRepository } from '../../hooks/useRepository';
import { longDate, shortDate, toTime } from '../../lib/chart';
import { addDays, formatDateLabel, todayString } from '../../lib/date';
import { computeRecords, e1rmTrend } from '../../lib/records';
import { bestRelative, formatRatio, relativeTrend, weighIns } from '../../lib/relativeStrength';
import { formatNumber } from '../../lib/number';
import { formatWeight, toDisplay, unitLabel } from '../../lib/units';
import { BODY_PARTS, BODY_PART_LABELS, type Exercise } from '../../types/models';
import { useState } from 'preact/hooks';

type Range = '3m' | '6m' | '1y' | 'all';
const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: '3m', label: '3 個月', days: 91 },
  { id: '6m', label: '半年', days: 182 },
  { id: '1y', label: '1 年', days: 365 },
  { id: 'all', label: '全部', days: null },
];

/** 看重量，或看「1RM 是體重的幾倍」 */
type Mode = 'weight' | 'relative';

/** 單一動作的估算 1RM 趨勢 */
export function TrendView({ exerciseId }: { exerciseId: string | undefined }) {
  const repo = useRepository();
  const sessions = repo.getSessions();
  const [range, setRange] = useState<Range>('6m');
  const [mode, setMode] = useState<Mode>('weight');
  const unit = repo.getWeightUnit();
  const u = unitLabel(unit);
  /** 圖表上的數值：換成目前單位，取到 0.1 */
  const chartValue = (kg: number) => Math.round(toDisplay(kg, unit) * 10) / 10;

  // 只列出「有可估算 1RM 的紀錄」且非自體重量的動作
  const records = computeRecords(sessions);
  const options = [...records.values()]
    .filter((r) => r.bestE1rm)
    .map((r) => repo.getExercise(r.exerciseId))
    .filter((e): e is Exercise => !!e && !e.isBodyweight);

  if (options.length === 0) {
    return (
      <EmptyState
        title="還沒有可以畫趨勢的紀錄"
        body={`記錄 1 到 10 下的正式組（例如深蹲 100 ${u} × 5）後，這裡會畫出估算 1RM 的變化。`}
      />
    );
  }

  // 預設選最近練過的動作
  const recentId = repo.getRecentExerciseIds(50).find((id) => options.some((o) => o.id === id));
  const selected = options.find((o) => o.id === exerciseId) ?? options.find((o) => o.id === recentId) ?? options[0]!;

  const allPoints = e1rmTrend(sessions, selected.id);
  const days = RANGES.find((r) => r.id === range)?.days ?? null;
  const cutoff = days === null ? '' : addDays(todayString(), -days);
  const record = records.get(selected.id);
  // 相對力量：每次的估算 1RM ÷ 當時的體重（需要體態頁的體重紀錄）
  const allRelative = relativeTrend(allPoints, weighIns(repo.getBodyMetrics()));
  const relative = mode === 'relative' && allRelative.length > 0;
  const bestRel = bestRelative(allRelative);
  const latestRel = allRelative[allRelative.length - 1];
  const weightPoints = allPoints.filter((p) => p.date >= cutoff);
  const relativePoints = allRelative.filter((p) => p.date >= cutoff);
  const count = relative ? relativePoints.length : weightPoints.length;
  const firstDate = (relative ? relativePoints[0]?.date : weightPoints[0]?.date) ?? '';
  const lastDate = (relative ? relativePoints[count - 1]?.date : weightPoints[count - 1]?.date) ?? '';

  return (
    <div class="tool">
      <label class="field">
        <span class="field-label">動作</span>
        <select
          class="input select"
          value={selected.id}
          onChange={(e) => navigate(`/charts/trend/${encodeURIComponent(e.currentTarget.value)}`)}
        >
          {BODY_PARTS.map((part) => {
            const list = options.filter((o) => o.bodyPart === part);
            return list.length ? (
              <optgroup key={part} label={BODY_PART_LABELS[part]}>
                {list.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>

      {relative ? (
        <div class="stat-row">
          <BigStat
            value={bestRel ? formatRatio(bestRel.ratio) : '–'}
            unit="倍"
            label="最佳相對力量"
            {...(bestRel
              ? { hint: `體重 ${formatNumber(bestRel.bodyweight)} kg，${formatDateLabel(bestRel.date)}` }
              : {})}
          />
          <BigStat
            value={latestRel ? formatRatio(latestRel.ratio) : '–'}
            unit="倍"
            label="最近一次"
            {...(latestRel
              ? { hint: `體重 ${formatNumber(latestRel.bodyweight)} kg，${formatDateLabel(latestRel.date)}` }
              : {})}
          />
        </div>
      ) : (
        <div class="stat-row">
          <BigStat
            value={record?.bestE1rm ? formatWeight(Math.round(record.bestE1rm.value * 10) / 10, unit) : '–'}
            unit={u}
            label="最佳估算 1RM"
            {...(record?.bestE1rm ? { hint: formatDateLabel(record.bestE1rm.date) } : {})}
          />
          <BigStat
            value={record?.bestWeight ? formatWeight(record.bestWeight.set.weight, unit) : '–'}
            unit={u}
            label="最大重量"
            {...(record?.bestWeight
              ? { hint: `× ${record.bestWeight.set.reps} 下，${formatDateLabel(record.bestWeight.date)}` }
              : {})}
          />
        </div>
      )}

      {allRelative.length > 0 && (
        <div class="segmented" role="radiogroup" aria-label="顯示方式">
          {(['weight', 'relative'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              class={mode === m ? 'segment is-active' : 'segment'}
              onClick={() => setMode(m)}
            >
              {m === 'weight' ? '重量' : '體重的幾倍'}
            </button>
          ))}
        </div>
      )}

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

      {count === 0 ? (
        <p class="note">這段期間沒有 {selected.name} 的紀錄，試試看更長的時間範圍。</p>
      ) : (
        <ChartCanvas
          label={
            relative
              ? `${selected.name} 相對力量趨勢（估算 1RM 是體重的幾倍），共 ${count} 次紀錄`
              : `${selected.name} 估算 1RM 趨勢，共 ${count} 次紀錄`
          }
          deps={[
            selected.id,
            range,
            unit,
            mode,
            count,
            relative ? relativePoints.map((p) => p.ratio).join() : weightPoints.map((p) => p.e1rm).join(),
          ]}
          build={(t) => ({
            type: 'line',
            data: {
              datasets: relative
                ? [
                    {
                      label: '估算 1RM ÷ 體重',
                      data: relativePoints.map((p) => ({
                        x: toTime(p.date),
                        y: Math.round(p.ratio * 100) / 100,
                      })),
                      borderColor: t.accent,
                      backgroundColor: t.accent,
                      borderWidth: 3,
                      pointRadius: count > 30 ? 0 : 4,
                      pointHoverRadius: 6,
                      tension: 0.25,
                    },
                  ]
                : [
                    {
                      label: '估算 1RM',
                      data: weightPoints.map((p) => ({
                        x: toTime(p.date),
                        y: chartValue(p.e1rm),
                      })),
                      borderColor: t.accent,
                      backgroundColor: t.accent,
                      borderWidth: 3,
                      pointRadius: count > 30 ? 0 : 4,
                      pointHoverRadius: 6,
                      tension: 0.25,
                    },
                    {
                      label: '當次最大重量',
                      data: weightPoints.map((p) => ({
                        x: toTime(p.date),
                        y: chartValue(p.topWeight),
                      })),
                      borderColor: t.muted,
                      backgroundColor: t.muted,
                      borderWidth: 2,
                      borderDash: [6, 4],
                      pointRadius: count > 30 ? 0 : 3,
                      tension: 0.25,
                    },
                  ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              layout: { padding: { left: 4, right: 12 } },
              interaction: { mode: 'index', intersect: false },
              scales: {
                x: {
                  type: 'linear',
                  // 只有一筆時左右各留一週，點才不會貼邊
                  ...(count === 1
                    ? {
                        min: toTime(firstDate) - 7 * 864e5,
                        max: toTime(firstDate) + 7 * 864e5,
                      }
                    : { min: toTime(firstDate), max: toTime(lastDate) }),
                  offset: false,
                  ticks: {
                    color: t.muted,
                    maxTicksLimit: 5,
                    font: { family: t.fontNum, size: 14 },
                    callback: (v) => shortDate(Number(v)),
                  },
                  grid: { display: false },
                  border: { color: t.line },
                },
                y: {
                  ticks: {
                    color: t.muted,
                    font: { family: t.fontNum, size: 14 },
                    maxTicksLimit: 6,
                  },
                  grid: { color: t.line },
                  border: { display: false },
                },
              },
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    color: t.ink,
                    boxWidth: 14,
                    boxHeight: 3,
                    font: { family: t.fontBody, size: 13 },
                  },
                },
                tooltip: {
                  callbacks: {
                    title: (items) => {
                      const x = items[0]?.parsed.x;
                      if (x === undefined || x === null) return '';
                      return longDate(x);
                    },
                    label: (item) =>
                      relative
                        ? ` 體重的 ${formatRatio(item.parsed.y ?? 0)} 倍（體重 ${formatNumber(relativePoints[item.dataIndex]?.bodyweight ?? 0)} kg）`
                        : ` ${item.dataset.label}：${item.parsed.y} ${u}`,
                  },
                },
              },
            },
          })}
        />
      )}

      <a href={`#/charts/exercise/${encodeURIComponent(selected.id)}`} class="btn btn-secondary btn-block btn-link">
        看{selected.name}的每一次紀錄
      </a>

      <p class="note">
        估算 1RM 使用 Epley 公式，只採計 1–10 下的正式組。自體重量動作請看 PR 牆的次數紀錄。
        {allRelative.length > 0
          ? '「體重的幾倍」用訓練那天前後最接近的體重紀錄計算（相差 30 天以內）；減脂期體重下降、重量持平，倍數上升也是進步。'
          : '在體態頁記錄體重後，還可以看估算 1RM 是體重的幾倍（相對力量）。'}
      </p>
    </div>
  );
}
