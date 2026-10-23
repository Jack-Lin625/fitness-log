/**
 * 漸進超負荷建議
 * 看上次這個動作的正式組，建議這次加重、維持或多做幾下：
 * - 上次每組次數都沒有掉（都做到第一組的次數），而且不是做到力竭（RPE 都 ≤ 9，或沒填 RPE）→ 加一格重量
 * - 有一組 RPE ≥ 9.5，或後面的組次數掉了 → 維持重量，目標把次數補齊
 * - 徒手動作 → 每組多做 1 下
 * - 輔助機器 → 每組都完成的話減少一格輔助
 * 只是建議，不會自動改動輸入。
 */
import type { WorkoutSet } from '../types/models';

export type SuggestionKind = 'increase' | 'hold' | 'reps' | 'lessAssist';

export interface Suggestion {
  kind: SuggestionKind;
  /** 建議重量（公斤）；徒手動作為 0 */
  weight: number;
  /** 建議每組次數 */
  reps: number;
}

/** RPE 到這裡以上視為接近力竭，不建議加重 */
const HARD_RPE = 9.5;

export function suggestNext(
  lastSets: WorkoutSet[],
  traits: { bodyweight: boolean; assisted: boolean },
  /** 這個器材一次能加的重量（公斤） */
  step: number,
): Suggestion | null {
  const working = lastSets.filter((s) => !s.isWarmup && s.reps > 0);
  if (working.length === 0) return null;

  const top = Math.max(...working.map((s) => s.weight));
  const topSets = working.filter((s) => Math.abs(s.weight - top) < 1e-6);
  const target = topSets[0]!.reps;
  const allHit = topSets.every((s) => s.reps >= target);
  const tooHard = working.some((s) => s.rpe !== undefined && s.rpe >= HARD_RPE);

  if (traits.assisted) {
    if (!allHit || tooHard || top <= 0) return { kind: 'hold', weight: top, reps: target };
    return { kind: 'lessAssist', weight: Math.max(0, top - step), reps: target };
  }
  if (traits.bodyweight && top <= 0) {
    return tooHard || !allHit ? { kind: 'hold', weight: 0, reps: target } : { kind: 'reps', weight: 0, reps: target + 1 };
  }
  if (!allHit || tooHard) return { kind: 'hold', weight: top, reps: target };
  return { kind: 'increase', weight: top + step, reps: target };
}
