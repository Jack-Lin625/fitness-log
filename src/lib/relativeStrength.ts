/**
 * 相對力量：估算 1RM ÷ 當時的體重
 *
 * 減脂期體重下降、重量持平，其實是變強了；只看重量看不出來，除以體重就看得出來。
 * 「當時的體重」取那天前後最接近的一次體重紀錄，相差超過 MAX_GAP_DAYS 天就不算（不知道當時多重）。
 */
import type { BodyMetric, WorkoutSession } from '../types/models';
import { dayNumber } from './movingAverage';
import { e1rmTrend, type TrendPoint } from './records';

/** 訓練日和體重紀錄最多可以差幾天 */
export const MAX_GAP_DAYS = 30;

export interface WeighIn {
  /** 天數序號 */
  day: number;
  /** kg */
  weight: number;
}

/** 體態紀錄裡有體重的那些，依日期由舊到新 */
export function weighIns(metrics: BodyMetric[]): WeighIn[] {
  return metrics
    .filter((m) => m.weight !== undefined && m.weight > 0)
    .map((m) => ({ day: dayNumber(m.date), weight: m.weight! }))
    .sort((a, b) => a.day - b.day);
}

/** 某天的體重：取最接近的一次紀錄（一樣近時取之前的）；太遠就回傳 null */
export function weightOn(list: WeighIn[], date: string): number | null {
  const day = dayNumber(date);
  // 二分搜尋第一筆 > day 的位置
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.day <= day) lo = mid + 1;
    else hi = mid;
  }
  const before = list[lo - 1];
  const after = list[lo];
  const best = !before ? after : !after ? before : after.day - day < day - before.day ? after : before;
  if (!best || Math.abs(best.day - day) > MAX_GAP_DAYS) return null;
  return best.weight;
}

export interface RelativePoint {
  date: string;
  /** 估算 1RM 是體重的幾倍 */
  ratio: number;
  /** 當時的體重 kg */
  bodyweight: number;
}

/** 每次訓練的相對力量；找不到當時體重的那幾次略過 */
export function relativeTrend(points: TrendPoint[], list: WeighIn[]): RelativePoint[] {
  const result: RelativePoint[] = [];
  for (const p of points) {
    const bw = weightOn(list, p.date);
    if (bw !== null) result.push({ date: p.date, ratio: p.e1rm / bw, bodyweight: bw });
  }
  return result;
}

/** 相對力量最好的一次 */
export function bestRelative(points: RelativePoint[]): RelativePoint | null {
  let best: RelativePoint | null = null;
  for (const p of points) if (!best || p.ratio > best.ratio) best = p;
  return best;
}

/** 某個動作相對力量最好的一次 */
export function bestRelativeOf(sessions: WorkoutSession[], exerciseId: string, list: WeighIn[]): RelativePoint | null {
  return list.length ? bestRelative(relativeTrend(e1rmTrend(sessions, exerciseId), list)) : null;
}

/** 1.523 → 「1.52」 */
export function formatRatio(ratio: number): string {
  return ratio.toFixed(2);
}
