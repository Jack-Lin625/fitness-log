/**
 * 1RM（一次最大反覆重量）估算
 * 兩個公式在 1–10 下時都相當接近；超過 10 下誤差會明顯變大。
 */

/** 公式在這個次數以內較可信 */
export const RELIABLE_MAX_REPS = 10;
/** 計算器允許輸入的最大次數 */
export const MAX_REPS = 30;

/** Epley：重量 × (1 + 次數 / 30) */
export function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki：重量 × 36 / (37 − 次數) */
export function brzycki(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0 || reps >= 37) return 0;
  if (reps === 1) return weight;
  return (weight * 36) / (37 - reps);
}

/** 兩個公式的平均，用於百分比表 */
export function averageOneRepMax(weight: number, reps: number): number {
  return (epley(weight, reps) + brzycki(weight, reps)) / 2;
}

/** 取整到最接近的 step（預設 2.5 kg，一對 1.25 kg 槓片） */
export function roundTo(value: number, step = 2.5): number {
  return Math.round(value / step) * step;
}

/** 常用訓練強度（%1RM） */
export const PERCENTAGES = [95, 90, 85, 80, 75, 70, 65, 60] as const;
