import type {
  DraftExercise,
  DraftSet,
  WorkoutDraft,
  WorkoutSession,
  WorkoutSet,
} from '../types/models';
import { todayString } from './date';
import { createId } from './id';
import { formatNumber, parseNumber } from './number';

/** 空白的一組；有傳入上一組時沿用它的重量與次數（方便連續做同重量） */
export function emptyDraftSet(prev?: DraftSet): DraftSet {
  return {
    weight: prev?.weight ?? '',
    reps: prev?.reps ?? '',
    rpe: '',
    isWarmup: false,
    completed: false,
  };
}

/** 新的動作（預設一組空白） */
export function newDraftExercise(exerciseId: string): DraftExercise {
  return { key: createId(), exerciseId, sets: [emptyDraftSet()] };
}

/** 全新、空白的訓練 */
export function createEmptyDraft(): WorkoutDraft {
  return { id: createId(), date: todayString(), exercises: [], note: '', startedAt: Date.now() };
}

/**
 * 由既有紀錄建立草稿
 * - 'edit'：修改那筆紀錄，保留日期、RPE、備註
 * - 'template'：當作今天的菜單範本，日期改為今天，清掉 RPE 與備註
 */
export function draftFromSession(session: WorkoutSession, mode: 'edit' | 'template'): WorkoutDraft {
  const isEdit = mode === 'edit';
  const draft: WorkoutDraft = {
    id: isEdit ? session.id : createId(),
    date: isEdit ? session.date : todayString(),
    note: isEdit ? (session.note ?? '') : '',
    startedAt: Date.now(),
    exercises: session.exercises.map((ex) => ({
      key: createId(),
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => ({
        weight: formatNumber(s.weight),
        reps: String(s.reps),
        rpe: isEdit && s.rpe !== undefined ? formatNumber(s.rpe) : '',
        isWarmup: s.isWarmup ?? false,
        // 修改舊紀錄時視為已完成；當範本時要重新做
        completed: isEdit,
      })),
    })),
  };
  if (isEdit) draft.editingSessionId = session.id;
  return draft;
}

export interface DraftConversion {
  /** null 代表沒有任何有效的組數，不能儲存 */
  session: WorkoutSession | null;
  /** 因為沒填次數而略過的組數 */
  skippedSets: number;
}

/**
 * 草稿 → 正式紀錄
 * 規則：次數必須 > 0 才算有效；重量空白視為 0；RPE 不在 1–10 之間就忽略；
 * 沒有任何有效組數的動作會被移除。
 */
export function draftToSession(draft: WorkoutDraft, existing?: WorkoutSession): DraftConversion {
  let skippedSets = 0;

  const exercises = draft.exercises
    .map((ex) => {
      const sets: WorkoutSet[] = [];
      for (const s of ex.sets) {
        const reps = parseNumber(s.reps);
        if (reps === null || reps <= 0) {
          // 完全空白的組不算「略過」，只有填了重量卻沒填次數才提醒
          if (s.weight.trim() !== '') skippedSets++;
          continue;
        }
        const set: WorkoutSet = { weight: parseNumber(s.weight) ?? 0, reps: Math.round(reps) };
        const rpe = parseNumber(s.rpe);
        if (rpe !== null && rpe >= 1 && rpe <= 10) set.rpe = rpe;
        if (s.isWarmup) set.isWarmup = true;
        sets.push(set);
      }
      return { exerciseId: ex.exerciseId, sets };
    })
    .filter((ex) => ex.sets.length > 0);

  if (exercises.length === 0) return { session: null, skippedSets };

  const now = Date.now();
  const session: WorkoutSession = {
    id: draft.editingSessionId ?? draft.id,
    date: draft.date,
    exercises,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const note = draft.note.trim();
  if (note) session.note = note;
  return { session, skippedSets };
}

/** 一組的簡短文字，如「80×5」「+10×8」「×12」 */
export function formatSetShort(set: WorkoutSet, isBodyweight: boolean): string {
  if (isBodyweight) return set.weight > 0 ? `+${formatNumber(set.weight)}×${set.reps}` : `×${set.reps}`;
  return `${formatNumber(set.weight)}×${set.reps}`;
}
