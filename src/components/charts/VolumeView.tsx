import { useState } from 'preact/hooks';
import { ChartCanvas } from '../ChartCanvas';
import { EmptyState } from '../EmptyState';
import { useRepository } from '../../hooks/useRepository';
import { addDays, startOfWeek } from '../../lib/date';
import { formatVolume, setsByBodyPart, volumeByBodyPart } from '../../lib/volume';
import { SetTargetList, SetTargetSheet } from './SetTargets';
import { toDisplay, unitLabel } from '../../lib/units';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '../../types/models';

type Metric = 'volume' | 'sets';

/** 每週各部位訓練量長條圖 */
export function VolumeView() {
  const repo = useRepository();
  const sessions = repo.getSessions();
  const [weeks, setWeeks] = useState(8);
  const [metric, setMetric] = useState<Metric>('volume');
  const [editingTargets, setEditingTargets] = useState(false);
  const weightUnit = repo.getWeightUnit();

  if (sessions.length === 0) {
    return <EmptyState title="還沒有訓練紀錄" body="完成幾次訓練後，這裡會顯示每週各部位的訓練量。" />;
  }

  // 從本週往前推 N 週
  const thisWeek = startOfWeek();
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, (i - weeks + 1) * 7));
  const getEx = (id: string) => repo.getExercise(id);
  const data = weekStarts.map((start) => {
    const inWeek = sessions.filter((s) => s.date >= start && s.date < addDays(start, 7));
    if (metric === 'sets') return setsByBodyPart(inWeek, getEx);
    // 容量換成目前的重量單位
    const kg = volumeByBodyPart(inWeek, getEx);
    return Object.fromEntries(BODY_PARTS.map((p) => [p, toDisplay(kg[p], weightUnit)])) as Record<BodyPart, number>;
  });
  // 本週還沒練就顯示上週，避免一整排 0
  const sum = (d: Record<BodyPart, number>) => BODY_PARTS.reduce((n, p) => n + d[p], 0);
  const thisWeekData = data[data.length - 1]!;
  const showLastWeek = sum(thisWeekData) === 0 && data.length > 1;
  const current = showLastWeek ? data[data.length - 2]! : thisWeekData;
  const labels = weekStarts.map((d) => {
    const [, m, day] = d.split('-').map(Number);
    return `${m}/${day}`;
  });
  const unit = metric === 'volume' ? unitLabel(weightUnit) : '組';
  // 組數目標一律看本週（週一開始）
  const thisWeekSets = setsByBodyPart(
    sessions.filter((s) => s.date >= thisWeek),
    getEx,
  );

  return (
    <div class="tool">
      <div class="chip-bar">
        <div class="chips" role="group" aria-label="指標">
          <button
            type="button"
            class={metric === 'volume' ? 'chip is-active' : 'chip'}
            aria-pressed={metric === 'volume'}
            onClick={() => setMetric('volume')}
          >
            容量
          </button>
          <button
            type="button"
            class={metric === 'sets' ? 'chip is-active' : 'chip'}
            aria-pressed={metric === 'sets'}
            onClick={() => setMetric('sets')}
          >
            組數
          </button>
        </div>
        <div class="chips" role="group" aria-label="週數">
          {[4, 8, 12].map((n) => (
            <button
              key={n}
              type="button"
              class={weeks === n ? 'chip is-active' : 'chip'}
              aria-pressed={weeks === n}
              onClick={() => setWeeks(n)}
            >
              {n} 週
            </button>
          ))}
        </div>
      </div>

      <ChartCanvas
        height={300}
        label={`近 ${weeks} 週各部位${metric === 'volume' ? '訓練容量' : '組數'}長條圖`}
        deps={[weeks, metric, weightUnit, sessions.length, JSON.stringify(data)]}
        build={(t) => ({
          type: 'bar',
          data: {
            labels,
            datasets: BODY_PARTS.map((part) => ({
              label: BODY_PART_LABELS[part],
              data: data.map((d) => Math.round(d[part])),
              backgroundColor: t.parts[part],
              // 手臂是白色，加上邊框才看得見
              borderColor: part === 'arms' ? t.muted : t.parts[part],
              borderWidth: part === 'arms' ? 1 : 0,
              stack: 'week',
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
              x: {
                stacked: true,
                ticks: { color: t.muted, font: { family: t.fontNum, size: 13 } },
                grid: { display: false },
                border: { color: t.line },
              },
              y: {
                stacked: true,
                ticks: {
                  color: t.muted,
                  font: { family: t.fontNum, size: 13 },
                  maxTicksLimit: 6,
                  callback: (v) => (metric === 'volume' ? formatVolume(Number(v)) : v),
                },
                grid: { color: t.line },
                border: { display: false },
              },
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: t.ink, boxWidth: 12, boxHeight: 12, font: { family: t.fontBody, size: 13 } },
              },
              tooltip: {
                callbacks: {
                  title: (items) => `${items[0]?.label ?? ''} 那一週`,
                  label: (item) => ` ${item.dataset.label}：${formatVolume(Number(item.raw))} ${unit}`,
                },
              },
            },
          },
        })}
      />

      <section class="section">
        <h2 class="section-title section-title-row">
          <span>本週組數目標</span>
          <button type="button" class="btn-text" onClick={() => setEditingTargets(true)}>
            調整目標
          </button>
        </h2>
        <SetTargetList sets={thisWeekSets} targets={repo.getSetTargets()} />
        <p class="muted small-text">淺色區塊是目標範圍；只算正式組，依動作的主要部位計算。</p>
      </section>

      {metric === 'volume' && (
        <section class="section">
          <h2 class="section-title">{showLastWeek ? '上週各部位（本週還沒有紀錄）' : '本週各部位'}</h2>
          <ul class="part-totals">
            {BODY_PARTS.map((part) => (
              <li key={part}>
                <span class={`part-dot part-${part}`} aria-hidden="true" />
                <span>{BODY_PART_LABELS[part]}</span>
                <span class="part-total-value">
                  <span class="num">{formatVolume(current[part])}</span> {unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p class="note">
        {metric === 'volume'
          ? '容量不含熱身組；自體重量動作只計算額外負重，所以引體向上等動作的訓練量可以切換到「組數」查看。'
          : '組數只計算正式組，不含熱身組。'}
      </p>
      {editingTargets && <SetTargetSheet onClose={() => setEditingTargets(false)} />}
    </div>
  );
}
