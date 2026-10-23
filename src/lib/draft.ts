import type {
  DraftExercise,
  DraftSet,
  SessionExercise,
  WeightUnit,
  WorkoutDraft,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from '../types/models';
import { todayString } from './date';
import { createId } from './id';
import { formatNumber, parseNumber } from './number';
import { formatWeight, fromDisplay } from './units';

/** 訓練時長超過這麼久就不記（多半是開了訓練忘記按完成，記下來反而誤導） */
const MAX_DURATION_SEC = 5 * 60 * 60;
/** 不到一分鐘多半是補登，不記時長 */
const MIN_DURATION_SEC = 60;

/** 空白的一組；有傳入上一組時沿用它的重量與次數（方便連續做同重量） */
export function emptyDraftSet(prev?: DraftSet): DraftSet {
  return {
    key: createId(),
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

/** 動作的備註與超級組（草稿與紀錄之間互相轉換時共用） */
function extrasOf(ex: { note?: string | undefined; supersetId?: string | undefined }) {
  const extras: { note?: string; supersetId?: string } = {};
  const note = ex.note?.trim();
  if (note) extras.note = note;
  if (ex.supersetId) extras.supersetId = ex.supersetId;
  return extras;
}

/**
 * 由既有紀錄建立草稿
 * - 'edit'：修改那筆紀錄，保留日期、RPE、備註
 * - 'template'：當作今天的菜單範本，日期改為今天，清掉 RPE 與備註
 * 重量依目前的單位顯示。動作備註（器材設定）與超級組兩種模式都保留。
 */
export function draftFromSession(session: WorkoutSession, mode: 'edit' | 'template', unit: WeightUnit = 'kg'): WorkoutDraft {
  const isEdit = mode === 'edit';
  const draft: WorkoutDraft = {
    id: isEdit ? session.id : createId(),
    date: isEdit ? session.date : todayString(),
    note: isEdit ? (session.note ?? '') : '',
    startedAt: Date.now(),
    exercises: session.exercises.map((ex) => ({
      key: createId(),
      exerciseId: ex.exerciseId,
      ...extrasOf(ex),
      sets: ex.sets.map((s) => ({
        key: createId(),
        weight: formatWeight(s.weight, unit),
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

/**
 * 由菜單範本建立今天的草稿
 * 組數、熱身組、備註、超級組照範本；重量與次數：
 * 這個動作做過的話留白（輸入框會以灰字顯示上次的成績，勾選完成時自動帶入），
 * 沒做過才填範本裡的數字。這樣範本不會因為越練越重而過時。
 */
export function draftFromTemplate(
  template: WorkoutTemplate,
  hasHistory: (exerciseId: string) => boolean,
  unit: WeightUnit = 'kg',
): WorkoutDraft {
  return {
    id: createId(),
    date: todayString(),
    note: '',
    startedAt: Date.now(),
    exercises: template.exercises.map((ex) => {
      const fill = !hasHistory(ex.exerciseId);
      return {
        key: createId(),
        exerciseId: ex.exerciseId,
        ...extrasOf(ex),
        sets: ex.sets.map((s) => ({
          key: createId(),
          weight: fill ? formatWeight(s.weight, unit) : '',
          reps: fill ? String(s.reps) : '',
          rpe: '',
          isWarmup: s.isWarmup ?? false,
          completed: false,
        })),
      };
    }),
  };
}

/** 把一次訓練存成範本（不含 RPE，那是當天的狀況） */
export function templateFromSession(session: WorkoutSession, name: string): WorkoutTemplate {
  return {
    id: createId(),
    name,
    createdAt: Date.now(),
    exercises: session.exercises.map(
      (ex): SessionExercise => ({
        exerciseId: ex.exerciseId,
        ...extrasOf(ex),
        sets: ex.sets.map(({ weight, reps, isWarmup }) => (isWarmup ? { weight, reps, isWarmup } : { weight, reps })),
      }),
    ),
  };
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
 * 沒有任何有效組數的動作會被移除。重量依 unit 換算成公斤儲存。
 * 新的訓練記下時長（開始到完成，太短或太長視為補登或忘了按完成，不記）；修改紀錄時沿用原本的時長。
 */
export function draftToSession(draft: WorkoutDraft, existing?: WorkoutSession, unit: WeightUnit = 'kg'): DraftConversion {
  let skippedSets = 0;

  const exercises = draft.exercises
    .map((ex): SessionExercise => {
      const sets: WorkoutSet[] = [];
      for (const s of ex.sets) {
        const reps = parseNumber(s.reps);
        if (reps === null || reps <= 0) {
          // 完全空白的組不算「略過」，只有填了重量卻沒填次數才提醒
          if (s.weight.trim() !== '') skippedSets++;
          continue;
        }
        const set: WorkoutSet = { weight: fromDisplay(parseNumber(s.weight) ?? 0, unit), reps: Math.round(reps) };
        const rpe = parseNumber(s.rpe);
        if (rpe !== null && rpe >= 1 && rpe <= 10) set.rpe = rpe;
        if (s.isWarmup) set.isWarmup = true;
        sets.push(set);
      }
      return { exerciseId: ex.exerciseId, sets, ...extrasOf(ex) };
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

  if (draft.editingSessionId) {
    if (existing?.durationSec !== undefined) session.durationSec = existing.durationSec;
  } else if (draft.date === todayString()) {
    const sec = Math.round((now - draft.startedAt) / 1000);
    if (sec >= MIN_DURATION_SEC && sec <= MAX_DURATION_SEC) session.durationSec = sec;
  }
  return { session, skippedSets };
}

/** 一組的簡短文字，如「80×5」「+10×8」「×12」「×8（輔助 20）」 */
export function formatSetShort(set: WorkoutSet, isBodyweight: boolean, assisted = false, unit: WeightUnit = 'kg'): string {
  const w = formatWeight(set.weight, unit);
  if (assisted) return set.weight > 0 ? `×${set.reps}（輔助 ${w}）` : `×${set.reps}`;
  if (isBodyweight) return set.weight > 0 ? `+${w}×${set.reps}` : `×${set.reps}`;
  return `${w}×${set.reps}`;
}

/** 訓練時長的文字，如「52 分」「1 小時 5 分」 */
export function formatSessionDuration(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

/**
 * 超級組的分組：相鄰且 supersetId 相同的動作（至少 2 個）為一組，依序標上 A、B、C…
 * 回傳每個動作所屬的超級組，不在超級組裡的為 null。
 */
export interface SupersetInfo {
  label: string;
  /** 在這個超級組裡的位置 */
  position: number;
  size: number;
}

export function supersetGroups(exercises: { supersetId?: string | undefined }[]): (SupersetInfo | null)[] {
  const result: (SupersetInfo | null)[] = exercises.map(() => null);
  let groupNo = 0;
  let i = 0;
  while (i < exercises.length) {
    const id = exercises[i]?.supersetId;
    let j = i + 1;
    if (id) while (j < exercises.length && exercises[j]?.supersetId === id) j++;
    if (id && j - i >= 2) {
      const label = String.fromCharCode(65 + (groupNo++ % 26));
      for (let k = i; k < j; k++) result[k] = { label, position: k - i, size: j - i };
    }
    i = j;
  }
  return result;
}

/** 切換重量單位時，把草稿裡已經輸入的重量換算過去（避免 100 kg 變成 100 lb） */
export function convertDraftUnit(draft: WorkoutDraft, from: WeightUnit, to: WeightUnit): WorkoutDraft {
  if (from === to) return draft;
  const convert = (v: string) => {
    const n = parseNumber(v);
    return n === null ? v : formatWeight(fromDisplay(n, from), to);
  };
  return {
    ...draft,
    exercises: draft.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, weight: convert(s.weight) })) })),
  };
}
