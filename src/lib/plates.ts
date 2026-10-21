/**
 * 槓片計算器
 * 給定目標重量、槓重與可用槓片，算出「每邊」要掛的槓片。
 *
 * 使用動態規劃而不是單純「從最大片開始掛」：
 * 當使用者關掉某些槓片時（例如沒有 5 kg），貪婪法可能湊不出來，
 * 動態規劃一定找得到「不超過目標、最接近目標、片數最少」的組合。
 */

export interface PlateResult {
  /** 每邊的槓片，由大到小（靠近槓鈴中心的先列） */
  perSide: number[];
  /** 實際可以湊出的總重量 */
  total: number;
  /** 目標 − 實際（> 0 代表湊不剛好） */
  remainder: number;
  /** 目標比空槓還輕 */
  belowBar: boolean;
}

/** 以 0.01 kg 為單位計算，避免 1.25 這類小數的浮點誤差 */
const toUnits = (kg: number) => Math.round(kg * 100);
const fromUnits = (u: number) => u / 100;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function calculatePlates(target: number, barWeight: number, plates: number[]): PlateResult {
  const sorted = [...new Set(plates)].filter((p) => p > 0).sort((a, b) => b - a);

  if (target <= barWeight || sorted.length === 0) {
    return { perSide: [], total: barWeight, remainder: target - barWeight, belowBar: target < barWeight };
  }

  const plateUnits = sorted.map(toUnits);
  // 縮小問題規模：以所有槓片的最大公因數為一格
  const step = plateUnits.reduce((g, u) => gcd(g, u));
  const sideSteps = Math.floor((toUnits(target) - toUnits(barWeight)) / 2 / step);
  const sizes = plateUnits.map((u) => u / step);

  // minCount[x]：湊出 x 格所需的最少片數；lastPlate[x]：最後放的是哪一片
  const minCount = new Array<number>(sideSteps + 1).fill(Infinity);
  const lastPlate = new Array<number>(sideSteps + 1).fill(-1);
  minCount[0] = 0;
  for (let x = 1; x <= sideSteps; x++) {
    sizes.forEach((size, i) => {
      // 依由大到小的順序，只有「嚴格更少片」才取代，所以平手時偏好大片
      if (size <= x && (minCount[x - size] ?? Infinity) + 1 < (minCount[x] ?? Infinity)) {
        minCount[x] = (minCount[x - size] ?? 0) + 1;
        lastPlate[x] = i;
      }
    });
  }

  // 找最接近目標的可達重量
  let best = sideSteps;
  while (best > 0 && minCount[best] === Infinity) best--;

  const perSide: number[] = [];
  for (let x = best; x > 0; ) {
    const i = lastPlate[x] ?? -1;
    const plate = sorted[i];
    const size = sizes[i];
    if (plate === undefined || size === undefined) break;
    perSide.push(plate);
    x -= size;
  }
  perSide.sort((a, b) => b - a);

  const sideTotal = perSide.reduce((s, p) => s + toUnits(p), 0);
  const total = fromUnits(toUnits(barWeight) + sideTotal * 2);
  return { perSide, total, remainder: fromUnits(toUnits(target) - toUnits(total)), belowBar: false };
}

/** 所有可選擇的槓片規格 */
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] as const;

/** 常見槓鈴重量 */
export const COMMON_BARS = [20, 15, 10] as const;
