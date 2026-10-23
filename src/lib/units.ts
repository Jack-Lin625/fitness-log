/**
 * 訓練重量的單位換算
 * 資料一律以公斤儲存；選了磅時，只在輸入與顯示時換算，切換單位不會改動任何紀錄。
 */
import type { WeightUnit } from '../types/models';
import { formatNumber } from './number';

export const KG_PER_LB = 0.45359237;

/** 磅的標準槓與槓片（磅制健身房常見規格） */
export const LB_BAR = 45;
export const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

/** 公斤 → 顯示單位 */
export function toDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

/** 顯示單位 → 公斤 */
export function fromDisplay(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

/**
 * 公斤 → 顯示用文字。
 * 磅取到 0.1（存的是換算後的公斤，換回磅會有極小的誤差，例如 99.99999）。
 */
export function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === 'kg') return formatNumber(kg);
  return formatNumber(Math.round(toDisplay(kg, unit) * 10) / 10);
}

/** 單位文字 */
export function unitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'lb' : 'kg';
}

/** 單位中文名稱（無障礙標籤用） */
export function unitName(unit: WeightUnit): string {
  return unit === 'lb' ? '磅' : '公斤';
}
