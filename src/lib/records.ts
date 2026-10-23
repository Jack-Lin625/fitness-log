/**
 * 個人紀錄（PR）與進步趨勢的計算
 *
 * 估算 1RM 統一使用 Epley 公式，並且只採計 1–10 下的正式組
 * （超過 10 下誤差太大，熱身組不算）。
 * PR 不另外儲存，每次都從訓練紀錄即時算出，所以修改或刪除舊紀錄後一定正確。
 */
import type { WorkoutSession, WorkoutSet } from '../types/models';
import { epley, RELIABLE_MAX_REPS } from './oneRepMax';

const EPSILON = 1e-9;

/** 一組的估算 1RM；不適合估算時回傳 null */
export function setE1rm(set: WorkoutSet): number | null {
  if (set.isWarmup || set.weight <= 0 || set.reps < 1 || set.reps > RELIABLE_MAX_REPS) return null;
  return epley(set.weight, set.reps);
}

/** 由舊到新排序（同一天依建立時間） */
export function chronological(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/** 指向某次訓練中的某一組 */
export interface SetRef {
  sessionId: string;
  date: string;
  set: WorkoutSet;
}

/** 單一動作的最佳紀錄 */
export interface ExerciseRecord {
  exerciseId: string;
  /** 最大重量（同重量時次數多者勝） */
  bestWeight: SetRef | null;
  /** 最佳估算 1RM */
  bestE1rm: (SetRef & { value: number }) | null;
  /** 最多次數（自體重量動作使用） */
  bestReps: SetRef | null;
}

/** 計算所有動作的最佳紀錄 */
export function computeRecords(sessions: WorkoutSession[]): Map<string, ExerciseRecord> {
  const records = new Map<string, ExerciseRecord>();

  for (const session of chronological(sessions)) {
    for (const ex of session.exercises) {
      let rec = records.get(ex.exerciseId);
      if (!rec) {
        rec = { exerciseId: ex.exerciseId, bestWeight: null, bestE1rm: null, bestReps: null };
        records.set(ex.exerciseId, rec);
      }
      for (const set of ex.sets) {
        if (set.isWarmup) continue;
        const ref: SetRef = { sessionId: session.id, date: session.date, set };

        const bw = rec.bestWeight?.set;
        if (!bw || set.weight > bw.weight + EPSILON || (Math.abs(set.weight - bw.weight) < EPSILON && set.reps > bw.reps)) {
          rec.bestWeight = ref;
        }
        const e = setE1rm(set);
        if (e !== null && (!rec.bestE1rm || e > rec.bestE1rm.value + EPSILON)) {
          rec.bestE1rm = { ...ref, value: e };
        }
        if (!rec.bestReps || set.reps > rec.bestReps.set.reps) rec.bestReps = ref;
      }
    }
  }
  return records;
}

export type RecordKind = 'weight' | 'e1rm' | 'reps';

/** 某次訓練打破的紀錄 */
export interface NewRecord {
  exerciseId: string;
  kind: RecordKind;
  /** 在 session.exercises 與 sets 中的位置，用來在畫面上標示是哪一組 */
  exerciseIndex: number;
  setIndex: number;
  set: WorkoutSet;
  value: number;
  previous: number;
}

/**
 * 找出某次訓練打破的紀錄（和「這次之前」的所有訓練比較）。
 * 第一次做的動作不算破紀錄，否則每個新動作都會跳提示。
 */
export function findNewRecords(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
  traitsOf: (exerciseId: string) => { bodyweight: boolean; assisted: boolean },
): NewRecord[] {
  const ordered = chronological(allSessions.filter((s) => s.id !== session.id));
  const before = ordered.filter(
    (s) => s.date < session.date || (s.date === session.date && s.createdAt < session.createdAt),
  );
  const prior = computeRecords(before);
  const result: NewRecord[] = [];

  session.exercises.forEach((ex, exerciseIndex) => {
    const prev = prior.get(ex.exerciseId);
    if (!prev) return;
    const { bodyweight, assisted } = traitsOf(ex.exerciseId);

    // 這次各項目的最佳組
    let topWeight = -1, topWeightIdx = -1;
    let topE1rm = -1, topE1rmIdx = -1;
    let topReps = -1, topRepsIdx = -1;
    ex.sets.forEach((set, i) => {
      if (set.isWarmup) return;
      if (set.weight > topWeight) [topWeight, topWeightIdx] = [set.weight, i];
      const e = setE1rm(set);
      if (e !== null && e > topE1rm) [topE1rm, topE1rmIdx] = [e, i];
      if (set.reps > topReps) [topReps, topRepsIdx] = [set.reps, i];
    });

    const push = (kind: RecordKind, setIndex: number, value: number, previous: number) => {
      const set = ex.sets[setIndex];
      if (set) result.push({ exerciseId: ex.exerciseId, kind, exerciseIndex, setIndex, set, value, previous });
    };

    const prevWeight = prev.bestWeight?.set.weight ?? 0;
    // 輔助機器的重量越重越輕鬆，不算重量紀錄
    if (!assisted && topWeightIdx >= 0 && topWeight > 0 && topWeight > prevWeight + EPSILON) {
      push('weight', topWeightIdx, topWeight, prevWeight);
    }
    if (bodyweight) {
      const prevReps = prev.bestReps?.set.reps ?? 0;
      if (topRepsIdx >= 0 && topReps > prevReps) push('reps', topRepsIdx, topReps, prevReps);
    } else if (topE1rmIdx >= 0 && prev.bestE1rm && topE1rm > prev.bestE1rm.value + EPSILON) {
      push('e1rm', topE1rmIdx, topE1rm, prev.bestE1rm.value);
    }
  });

  return result;
}

/** 趨勢圖的一個點：某次訓練中該動作的最佳估算 1RM 與最大重量 */
export interface TrendPoint {
  date: string;
  e1rm: number;
  topWeight: number;
}

export function e1rmTrend(sessions: WorkoutSession[], exerciseId: string): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const session of chronological(sessions)) {
    let best = 0;
    let top = 0;
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        const e = setE1rm(set);
        if (e !== null && e > best) best = e;
        if (!set.isWarmup && set.weight > top) top = set.weight;
      }
    }
    if (best > 0) points.push({ date: session.date, e1rm: best, topWeight: top });
  }
  return points;
}

/**
 * 訓練進行中：這一組是否打破「之前」的紀錄（勾選完成時即時提示）。
 * 規則與 findNewRecords 相同：第一次做的動作不算、輔助機器不算重量紀錄、
 * 自體重量動作比次數、其他動作比估算 1RM。
 */
export function setRecordKinds(
  set: WorkoutSet,
  prior: ExerciseRecord | undefined,
  traits: { bodyweight: boolean; assisted: boolean },
): RecordKind[] {
  if (!prior || set.isWarmup || set.reps <= 0) return [];
  const kinds: RecordKind[] = [];
  const prevWeight = prior.bestWeight?.set.weight ?? 0;
  if (!traits.assisted && set.weight > 0 && set.weight > prevWeight + EPSILON) kinds.push('weight');
  if (traits.bodyweight) {
    if (set.reps > (prior.bestReps?.set.reps ?? 0)) kinds.push('reps');
  } else {
    const e = setE1rm(set);
    if (e !== null && prior.bestE1rm && e > prior.bestE1rm.value + EPSILON) kinds.push('e1rm');
  }
  return kinds;
}
