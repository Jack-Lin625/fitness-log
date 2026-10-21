import type { BodyMetric } from '../types/models';
import type { DatedValue } from './movingAverage';

/** 使用者會輸入的欄位 */
export type StoredMetricKey = 'weight' | 'bodyFat' | 'waist' | 'chest' | 'arm';
/** 圖表可以顯示的項目（含由體重 × 體脂率推算的去脂體重） */
export type MetricKey = StoredMetricKey | 'leanMass';

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** 圖表與清單用的短名稱 */
  short: string;
  unit: string;
  /** 合理範圍，用來擋掉打錯的數字 */
  min: number;
  max: number;
}

export const STORED_METRICS: readonly (MetricDef & { key: StoredMetricKey })[] = [
  { key: 'weight', label: '體重', short: '體重', unit: 'kg', min: 20, max: 300 },
  { key: 'bodyFat', label: '體脂率', short: '體脂', unit: '%', min: 2, max: 70 },
  { key: 'waist', label: '腰圍', short: '腰', unit: 'cm', min: 30, max: 250 },
  { key: 'chest', label: '胸圍', short: '胸', unit: 'cm', min: 30, max: 250 },
  { key: 'arm', label: '手臂圍', short: '臂', unit: 'cm', min: 10, max: 100 },
];

export const LEAN_MASS: MetricDef = { key: 'leanMass', label: '去脂體重', short: '去脂', unit: 'kg', min: 0, max: 300 };

export const ALL_METRICS: readonly MetricDef[] = [...STORED_METRICS, LEAN_MASS];

/** 取出某項目的時間序列（由舊到新） */
export function metricSeries(metrics: BodyMetric[], key: MetricKey): DatedValue[] {
  const points: DatedValue[] = [];
  for (const m of metrics) {
    if (key === 'leanMass') {
      // 去脂體重 = 體重 × (1 − 體脂率)；同一天兩項都有才算得出來
      if (m.weight !== undefined && m.bodyFat !== undefined) {
        points.push({ date: m.date, value: m.weight * (1 - m.bodyFat / 100) });
      }
    } else {
      const v = m[key];
      if (v !== undefined) points.push({ date: m.date, value: v });
    }
  }
  return points;
}
