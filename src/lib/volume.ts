import type { BodyPart, Exercise, SessionExercise, WorkoutSession, WorkoutSet } from '../types/models';
import { BODY_PARTS } from '../types/models';

/**
 * 訓練容量 = 重量 × 次數（逐組加總，等同「重量 × 次數 × 組數」）
 * - 熱身組不計入
 * - 自體重量動作只計算額外負重（徒手 = 0）
 * - 輔助機器動作的重量是「輔助」，不計入（傳入 isAssisted 判斷）
 */

/** 判斷某動作是否為輔助機器 */
export type IsAssisted = (exerciseId: string) => boolean;

export function setVolume(set: WorkoutSet): number {
  return set.isWarmup ? 0 : set.weight * set.reps;
}

export function exerciseVolume(exercise: SessionExercise, isAssisted?: IsAssisted): number {
  if (isAssisted?.(exercise.exerciseId)) return 0;
  return exercise.sets.reduce((sum, s) => sum + setVolume(s), 0);
}

export function sessionVolume(session: WorkoutSession, isAssisted?: IsAssisted): number {
  return session.exercises.reduce((sum, e) => sum + exerciseVolume(e, isAssisted), 0);
}

/** 日期區間 [start, end) 內所有訓練的總容量 */
export function volumeBetween(sessions: WorkoutSession[], start: string, end: string, isAssisted?: IsAssisted): number {
  return sessions
    .filter((s) => s.date >= start && s.date < end)
    .reduce((sum, s) => sum + sessionVolume(s, isAssisted), 0);
}

/** 依部位拆分容量（第 4 階段的部位長條圖會用到） */
export function volumeByBodyPart(
  sessions: WorkoutSession[],
  getExercise: (id: string) => Exercise | undefined,
): Record<BodyPart, number> {
  const result = Object.fromEntries(BODY_PARTS.map((p) => [p, 0])) as Record<BodyPart, number>;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const e = getExercise(ex.exerciseId);
      if (e && !e.assisted) result[e.bodyPart] += exerciseVolume(ex);
    }
  }
  return result;
}

/** 容量顯示：12450 → "12,450" */
export function formatVolume(kg: number): string {
  return Math.round(kg).toLocaleString('en-US');
}
