/**
 * 單一動作的完整歷史：每次做這個動作的日期、每一組、備註，以及那次是否破了當時的紀錄。
 */
import type { WorkoutSession, WorkoutSet } from '../types/models';
import { chronological, computeRecords, setE1rm, setRecordKinds, type RecordKind } from './records';
import { exerciseVolume } from './volume';

export interface HistoryEntry {
  sessionId: string;
  date: string;
  sets: WorkoutSet[];
  note?: string;
  /** 最重的正式組（同重量時次數多者） */
  topSet: WorkoutSet | null;
  /** 這次最佳的估算 1RM（沒有 1–10 下的正式組時為 null） */
  bestE1rm: number | null;
  /** 正式組數 */
  workingSets: number;
  /** 訓練容量（不含熱身組） */
  volume: number;
  /** 這次打破的紀錄（和這次之前的所有紀錄比較；第一次做不算） */
  records: RecordKind[];
}

function topSetOf(sets: WorkoutSet[]): WorkoutSet | null {
  let top: WorkoutSet | null = null;
  for (const s of sets) {
    if (s.isWarmup) continue;
    if (!top || s.weight > top.weight || (s.weight === top.weight && s.reps > top.reps)) top = s;
  }
  return top;
}

/** 某動作的所有紀錄，新到舊 */
export function exerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string,
  traits: { bodyweight: boolean; assisted: boolean },
): HistoryEntry[] {
  const has = (s: WorkoutSession) => s.exercises.some((e) => e.exerciseId === exerciseId && e.sets.length > 0);
  const ordered = chronological(sessions).filter(has);
  const entries: HistoryEntry[] = [];
  ordered.forEach((session, i) => {
    // 這次之前的最佳紀錄
    const prior = computeRecords(ordered.slice(0, i)).get(exerciseId);
    // 同一次訓練可能做了兩次同一個動作（例如前後各做一次），合併計算
    const parts = session.exercises.filter((e) => e.exerciseId === exerciseId);
    const sets = parts.flatMap((e) => e.sets);
    const records = new Set<RecordKind>();
    for (const set of sets) for (const kind of setRecordKinds(set, prior, traits)) records.add(kind);
    const e1rms = sets.map(setE1rm).filter((v): v is number => v !== null);
    const note = parts.map((e) => e.note).find(Boolean);
    const entry: HistoryEntry = {
      sessionId: session.id,
      date: session.date,
      sets,
      topSet: topSetOf(sets),
      bestE1rm: e1rms.length > 0 ? Math.max(...e1rms) : null,
      workingSets: sets.filter((s) => !s.isWarmup).length,
      volume: traits.assisted ? 0 : parts.reduce((n, e) => n + exerciseVolume(e), 0),
      records: [...records],
    };
    if (note) entry.note = note;
    entries.push(entry);
  });
  return entries.reverse();
}
