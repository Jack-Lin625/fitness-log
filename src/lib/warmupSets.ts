import type { Equipment, WeightUnit } from '../types/models';
import { LB_BAR } from './units';
import { calculatePlates } from './plates';

/**
 * 熱身組階梯
 * 依正式組重量，產生由輕到重的熱身組：空槓 × 10 → 約 40% × 5 → 60% × 3 → 80% × 2。
 * 重量取整到器材實際能調整的間距，太接近前一組或正式組的會略過。
 */
export interface WarmupSetPlan {
  weight: number;
  reps: number;
}

const STEPS: { pct: number; reps: number }[] = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
];

/** 各器材的重量間距與起始重量 */
export function warmupConfig(equipment: Equipment, barWeight: number): { step: number; bar: number } | null {
  switch (equipment) {
    case 'barbell':
    case 'trapbar':
      return { step: 2.5, bar: barWeight };
    case 'ezbar':
    case 'smith':
    case 'tbar':
      return { step: 2.5, bar: 0 };
    case 'dumbbell':
    case 'kettlebell':
      return { step: 2, bar: 0 };
    case 'bodyweight':
    case 'band':
    case 'assisted-machine':
    case 'pullup-bar':
    case 'dip-station':
    case 'ab-wheel':
    case 'box':
    case 'back-extension':
      return null;
    default:
      // 各種機器、纜繩：配重片通常 5 kg 一格
      return { step: 5, bar: 0 };
  }
}

/**
 * 依單位的器材設定（重量都是該單位的數字）。
 * 磅制：槓鈴 45 lb、每次加 5 lb（兩邊各 2.5 lb）；啞鈴 5 lb 一跳；機器配重片多為 10 lb 一格。
 */
export function warmupConfigFor(
  equipment: Equipment,
  barWeightKg: number,
  unit: WeightUnit,
): { step: number; bar: number } | null {
  const kg = warmupConfig(equipment, barWeightKg);
  if (!kg || unit === 'kg') return kg;
  const bar = kg.bar > 0 ? LB_BAR : 0;
  return { step: kg.step === 5 ? 10 : 5, bar };
}

export function warmupLadder(work: number, step: number, bar: number): WarmupSetPlan[] {
  if (work <= 0) return [];
  // 槓鈴：正式組就是空槓（或更輕）時不需要熱身組，也不可能比空槓輕
  if (bar > 0 && work <= bar) return [];
  const round = (v: number) => Math.round(v / step) * step;
  const plan: WarmupSetPlan[] = [];
  let last = 0;
  if (bar > 0 && work > bar) {
    plan.push({ weight: bar, reps: 10 });
    last = bar;
  }
  for (const { pct, reps } of STEPS) {
    const weight = round(work * pct);
    // 至少比上一組重半格、比正式組輕半格才有意義
    if (weight <= last + step / 2 || weight >= work - step / 2 || weight <= 0 || weight < bar) continue;
    plan.push({ weight, reps });
    last = weight;
  }
  return plan;
}

/** 槓鈴每邊槓片的簡短文字，例如「每邊 20、5」「空槓」 */
export function plateText(weight: number, bar: number, plates: number[]): string | null {
  if (bar <= 0) return null;
  if (weight <= bar) return weight === bar ? '空槓' : null;
  const r = calculatePlates(weight, bar, plates);
  if (r.perSide.length === 0) return null;
  return `每邊 ${r.perSide.join('、')}${r.remainder > 0.001 ? `（差 ${Math.round(r.remainder * 100) / 100}）` : ''}`;
}
