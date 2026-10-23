/**
 * 每週各部位的正式組數目標
 *
 * 預設值參考常見的增肌建議：每個肌群每週約 10–20 個正式組。
 * 手臂在推、拉的動作裡已經出力，核心在深蹲、硬舉時也會出力，所以起點較低。
 * 每個部位可以自訂；下限設 0 代表這個部位不設目標。
 */
import type { BodyPart } from '../types/models';

export interface SetTarget {
  min: number;
  max: number;
}

export const DEFAULT_SET_TARGETS: Record<BodyPart, SetTarget> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  legs: { min: 10, max: 20 },
  shoulders: { min: 10, max: 20 },
  arms: { min: 6, max: 14 },
  core: { min: 4, max: 12 },
};

/** 組數上限（輸入用） */
export const MAX_WEEKLY_SETS = 40;

export type TargetStatus =
  /** 沒有設目標 */
  | 'none'
  /** 還沒達到下限 */
  | 'low'
  /** 在範圍內 */
  | 'ok'
  /** 超過上限：太多組可能恢復不過來 */
  | 'high';

export function targetStatus(sets: number, target: SetTarget): TargetStatus {
  if (target.min <= 0) return 'none';
  if (sets < target.min) return 'low';
  if (sets > target.max) return 'high';
  return 'ok';
}

/** 狀態的短文字，例如「還差 4 組」「達標」「多了 3 組」 */
export function targetText(sets: number, target: SetTarget): string {
  switch (targetStatus(sets, target)) {
    case 'none':
      return '沒有設目標';
    case 'low':
      return `還差 ${target.min - sets} 組`;
    case 'ok':
      return '達標';
    case 'high':
      return `超過 ${sets - target.max} 組`;
  }
}

/** 合併使用者設定與預設值；不合理的設定（下限大於上限等）改用預設 */
export function resolveTargets(custom: Partial<Record<BodyPart, SetTarget>> | undefined): Record<BodyPart, SetTarget> {
  const result = { ...DEFAULT_SET_TARGETS };
  for (const [part, t] of Object.entries(custom ?? {}) as [BodyPart, SetTarget][]) {
    if (part in DEFAULT_SET_TARGETS && isValidTarget(t)) result[part] = { min: t.min, max: t.max };
  }
  return result;
}

export function isValidTarget(t: unknown): t is SetTarget {
  if (typeof t !== 'object' || t === null) return false;
  const { min, max } = t as Record<string, unknown>;
  return (
    typeof min === 'number' &&
    typeof max === 'number' &&
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    max <= MAX_WEEKLY_SETS &&
    (min === 0 || min <= max)
  );
}
