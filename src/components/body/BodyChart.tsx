import { ChartCanvas } from '../ChartCanvas';
import { longDate, shortDate, toTime } from '../../lib/chart';
import type { MetricDef } from '../../lib/bodyMetrics';
import { formatNumber } from '../../lib/number';
import type { DatedValue } from '../../lib/movingAverage';

interface Props {
  def: MetricDef;
  points: DatedValue[];
  average: DatedValue[] | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 體態趨勢圖：每次測量的點，加上（可選的）7 日移動平均線 */
export function BodyChart({ def, points, average }: Props) {
  const showAvg = average !== null;

  return (
    <ChartCanvas
      label={`${def.label}趨勢圖，共 ${points.length} 筆${showAvg ? '，含 7 日移動平均' : ''}`}
      deps={[def.key, showAvg, points.map((p) => `${p.date}:${p.value}`).join()]}
      build={(t) => ({
        type: 'line',
        data: {
          datasets: [
            ...(showAvg
              ? [
                  {
                    label: '7 日平均',
                    data: average.map((p) => ({ x: toTime(p.date), y: round1(p.value) })),
                    borderColor: t.accent,
                    backgroundColor: t.accent,
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0.3,
                  },
                ]
              : []),
            {
              label: '每次測量',
              data: points.map((p) => ({ x: toTime(p.date), y: round1(p.value) })),
              // 有平均線時，原始資料變淡，重點放在平均
              borderColor: showAvg ? t.line : t.accent,
              backgroundColor: showAvg ? t.muted : t.accent,
              borderWidth: showAvg ? 1 : 3,
              pointRadius: points.length > 60 ? 2 : 3.5,
              pointHoverRadius: 6,
              tension: 0.2,
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
              ...(points.length === 1
                ? { min: toTime(points[0]!.date) - 7 * 864e5, max: toTime(points[0]!.date) + 7 * 864e5 }
                : { min: toTime(points[0]!.date), max: toTime(points[points.length - 1]!.date) }),
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
                callback: (v) => formatNumber(Number(v)),
              },
              grid: { color: t.line },
              border: { display: false },
            },
          },
          plugins: {
            legend: {
              display: showAvg,
              position: 'bottom',
              labels: { color: t.ink, boxWidth: 14, boxHeight: 3, font: { family: t.fontBody, size: 13 } },
            },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const x = items[0]?.parsed.x;
                  return x === undefined || x === null ? '' : longDate(x);
                },
                label: (item) => ` ${item.dataset.label}：${item.parsed.y} ${def.unit}`,
              },
            },
          },
        },
      })}
    />
  );
}
