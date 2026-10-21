import type { BodyPart, Exercise, SessionExercise, WorkoutSession, WorkoutSet } from '../types/models';
import { BODY_PARTS } from '../types/models';

/**
 * 訓練容量 = 重量 × 次數（逐組加總，等同「重量 × 次數 × 組數」）
 * - 熱身組不計入
 * - 自體重量動作只計算額外負重（徒手 = 0）
 */

export function setVolume(set: WorkoutSet): number {
  return set.isWarmup ? 0 : set.weight * set.reps;
}

export function exerciseVolume(exercise: SessionExercise): number {
  return exercise.sets.reduce((sum, s) => sum + setVolume(s), 0);
}

export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
}

/** 日期區間 [start, end) 內所有訓練的總容量 */
export function volumeBetween(sessions: WorkoutSession[], start: string, end: string): number {
  return sessions
    .filter((s) => s.date >= start && s.date < end)
    .reduce((sum, s) => sum + sessionVolume(s), 0);
}

/** 依部位拆分容量（第 4 階段的部位長條圖會用到） */
export function volumeByBodyPart(
  sessions: WorkoutSession[],
  getExercise: (id: string) => Exercise | undefined,
): Record<BodyPart, number> {
  const result = Object.fromEntries(BODY_PARTS.map((p) => [p, 0])) as Record<BodyPart, number>;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const part = getExercise(ex.exerciseId)?.bodyPart;
      if (part) result[part] += exerciseVolume(ex);
    }
  }
  return result;
}

/** 容量顯示：12450 → "12,450" */
export function formatVolume(kg: number): string {
  return Math.round(kg).toLocaleString('en-US');
}
