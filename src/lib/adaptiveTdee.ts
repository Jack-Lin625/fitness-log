/**
 * 用實際紀錄推算 TDEE（每日維持熱量）
 *
 * 原理：能量守恆。這段期間平均每天吃的熱量 − 體重變化換算的熱量 = 平均每天消耗的熱量。
 *   TDEE ≈ 平均每日攝取 − 體重每日變化(kg) × 7,700 kcal
 * 例如每天吃 2,000 kcal、每週瘦 0.5 kg（每天 −0.071 kg）→ TDEE ≈ 2,000 + 550 = 2,550 kcal。
 *
 * - 期間：到昨天為止的 28 天（今天還沒吃完，不算）。
 * - 體重用線性回歸算趨勢，抵銷每天水分造成的上下波動。
 * - 只用有記錄飲食的日子算平均（假設沒記的日子吃得差不多），所以要求記錄夠完整。
 * 這仍是估計：沒記到的零食、熱量估錯都會讓結果偏高。
 */
import type { BodyMetric } from '../types/models';
import { addDays } from './date';

/** 約 7,700 kcal ≈ 1 kg 體重 */
const KCAL_PER_KG = 7700;
/** 回推的天數 */
export const WINDOW_DAYS = 28;
/** 至少要記錄幾天的飲食（約每週 5 天） */
export const MIN_FOOD_DAYS = 20;
/** 至少要量幾次體重 */
export const MIN_WEIGH_INS = 6;
/** 第一次與最後一次量體重至少相隔幾天 */
export const MIN_WEIGHT_SPAN = 14;
/** 一天記錄的熱量低於這個值，多半是只記了一部分，不採用 */
const MIN_DAY_KCAL = 800;

export type AdaptiveTdee =
  | {
      ok: true;
      tdee: number;
      avgIntake: number;
      /** 體重趨勢（kg／週，負數為下降） */
      weeklyChangeKg: number;
      foodDays: number;
      weighIns: number;
      from: string;
      to: string;
    }
  | {
      ok: false;
      /** 還缺什麼（給使用者看的文字） */
      missing: string[];
      foodDays: number;
      weighIns: number;
    };

/** 最小平方法的斜率（每天的變化量） */
function slope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 864e5);

export function estimateTdee(dailyKcal: Map<string, number>, metrics: BodyMetric[], today: string): AdaptiveTdee {
  const to = addDays(today, -1);
  const from = addDays(today, -WINDOW_DAYS);
  const inWindow = (d: string) => d >= from && d <= to;

  const intakes = [...dailyKcal].filter(([d, kcal]) => inWindow(d) && kcal >= MIN_DAY_KCAL).map(([, kcal]) => kcal);
  const weights = metrics
    .filter((m) => m.weight !== undefined && inWindow(m.date))
    .map((m) => ({ x: dayIndex(m.date), y: m.weight! }));
  const span = weights.length > 0 ? Math.max(...weights.map((w) => w.x)) - Math.min(...weights.map((w) => w.x)) : 0;

  const missing: string[] = [];
  if (intakes.length < MIN_FOOD_DAYS) missing.push(`再記錄 ${MIN_FOOD_DAYS - intakes.length} 天完整的飲食`);
  if (weights.length < MIN_WEIGH_INS) missing.push(`再量 ${MIN_WEIGH_INS - weights.length} 次體重`);
  else if (span < MIN_WEIGHT_SPAN) missing.push(`體重紀錄要跨越至少 ${MIN_WEIGHT_SPAN} 天`);
  if (missing.length > 0) return { ok: false, missing, foodDays: intakes.length, weighIns: weights.length };

  const avgIntake = intakes.reduce((s, v) => s + v, 0) / intakes.length;
  const perDay = slope(weights);
  const tdee = avgIntake - perDay * KCAL_PER_KG;
  // 算出不合理的數字（記錄有缺漏或打錯）就不顯示
  if (tdee < 1000 || tdee > 6000) {
    return { ok: false, missing: ['紀錄的數字不太一致，請確認飲食是否都有記到'], foodDays: intakes.length, weighIns: weights.length };
  }
  return {
    ok: true,
    tdee: Math.round(tdee / 10) * 10,
    avgIntake: Math.round(avgIntake),
    weeklyChangeKg: Math.round(perDay * 7 * 100) / 100,
    foodDays: intakes.length,
    weighIns: weights.length,
    from,
    to,
  };
}
