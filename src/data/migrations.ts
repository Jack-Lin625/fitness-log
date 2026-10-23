import { STORED_METRICS } from '../lib/bodyMetrics';
import { isValidTarget } from '../lib/setTargets';
import { DEFAULT_MUSCLES, EQUIPMENT_LABELS, MUSCLE_LABELS } from './catalog';
import {
  BODY_PARTS,
  type ActivityLevel,
  type BodyPart,
  CURRENT_DATA_VERSION,
  type AppData,
  type BodyMetric,
  type BodyPhoto,
  BODY_POSES,
  type DraftExercise,
  type DraftSet,
  type Equipment,
  type Exercise,
  type FoodEntry,
  type FoodFavorite,
  MEAL_TYPES,
  type Muscle,
  type NutritionGoal,
  type NutritionProfile,
  type Settings,
  type SessionExercise,
  type Sex,
  type WorkoutDraft,
  type WorkoutSession,
  type WorkoutSet,
  type WorkoutTemplate,
} from '../types/models';
import { createId } from '../lib/id';

/** 預設設定 */
export const DEFAULT_SETTINGS: Settings = {
  defaultRestSeconds: 90,
  barWeight: 20,
  availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
  timerSound: true,
  timerVibrate: true,
};

/** 建立全新的空白資料 */
export function createEmptyData(): AppData {
  return {
    version: CURRENT_DATA_VERSION,
    customExercises: [],
    sessions: [],
    bodyMetrics: [],
    settings: { ...DEFAULT_SETTINGS, availablePlates: [...DEFAULT_SETTINGS.availablePlates] },
    activeDraft: null,
    nutritionProfile: null,
    foodEntries: [],
    templates: [],
    foodFavorites: [],
  };
}

/**
 * 升級函式表：key 為「來源版本」，函式把資料從 v(n) 升到 v(n+1)。
 * 新增版本時只要在這裡加一行，舊資料與舊備份都會自動升級。
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2：新增訓練草稿欄位
  1: (d) => ({ ...d, version: 2, activeDraft: null }),
  // v2 → v3：動作加上器材與肌群（自訂動作依部位給預設值，normalize 會補齊）
  2: (d) => ({ ...d, version: 3 }),
  // v3 → v4：新增飲食（TDEE 個人資料、飲食紀錄）
  3: (d) => ({ ...d, version: 4, nutritionProfile: null, foodEntries: [] }),
  // v4 → v5：新增菜單範本、常吃的食物（動作備註、超級組、訓練時長都是選填欄位）
  4: (d) => ({ ...d, version: 5, templates: [], foodFavorites: [] }),
  // v5 → v6：體態紀錄可以附照片（選填欄位，舊資料不用改）
  5: (d) => ({ ...d, version: 6 }),
};

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 把任意版本的原始資料升級成目前版本的 AppData。
 * 匯入 JSON 備份時也會走這裡，所以舊版備份可以直接匯入。
 */
export function migrate(raw: unknown): AppData {
  if (!isRecord(raw) || typeof raw.version !== 'number') {
    throw new MigrationError('資料缺少版本號，不是有效的訓練紀錄資料');
  }
  if (raw.version > CURRENT_DATA_VERSION) {
    throw new MigrationError(
      `資料版本 v${raw.version} 比目前 App 支援的 v${CURRENT_DATA_VERSION} 新，請先更新 App`,
    );
  }

  let data: Record<string, unknown> = raw;
  while ((data.version as number) < CURRENT_DATA_VERSION) {
    const from = data.version as number;
    const step = MIGRATIONS[from];
    if (!step) throw new MigrationError(`找不到從 v${from} 升級的方法`);
    data = step(data);
  }

  return normalize(data);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function isValidExerciseList(v: unknown): v is SessionExercise[] {
  return (
    Array.isArray(v) &&
    v.every(
      (ex) =>
        isRecord(ex) &&
        isStr(ex.exerciseId) &&
        Array.isArray(ex.sets) &&
        ex.sets.every((s) => isRecord(s) && isNum(s.weight) && isNum(s.reps)),
    )
  );
}

function isValidSession(v: unknown): v is WorkoutSession {
  if (!isRecord(v) || !isStr(v.id) || typeof v.date !== 'string' || !DATE_RE.test(v.date)) return false;
  return isValidExerciseList(v.exercises);
}

/** 動作的備註、超級組只留有效的字串 */
function normalizeSessionExercise(ex: SessionExercise): SessionExercise {
  const result: SessionExercise = { exerciseId: ex.exerciseId, sets: ex.sets.map((s: WorkoutSet) => ({ ...s })) };
  if (isStr(ex.note)) result.note = ex.note;
  if (isStr(ex.supersetId)) result.supersetId = ex.supersetId;
  return result;
}

function normalizeSession(s: WorkoutSession): WorkoutSession {
  const { durationSec, ...rest } = s;
  const session: WorkoutSession = {
    ...rest,
    exercises: s.exercises.map(normalizeSessionExercise),
    // 舊資料可能缺 createdAt/updatedAt，補上 0 讓排序正常
    createdAt: isNum(s.createdAt) ? s.createdAt : 0,
    updatedAt: isNum(s.updatedAt) ? s.updatedAt : 0,
  };
  if (isNum(durationSec) && durationSec > 0) session.durationSec = durationSec;
  return session;
}

function normalizeTemplate(v: unknown): WorkoutTemplate | null {
  if (!isRecord(v) || !isStr(v.id) || !isStr(v.name) || !isValidExerciseList(v.exercises)) return null;
  if (v.exercises.length === 0) return null;
  return {
    id: v.id,
    name: v.name,
    exercises: v.exercises.map(normalizeSessionExercise),
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
}

function normalizeFoodFavorite(v: unknown): FoodFavorite | null {
  if (!isRecord(v) || !isStr(v.id) || !isStr(v.name) || !isNum(v.kcal) || v.kcal < 0) return null;
  const fav: FoodFavorite = { id: v.id, name: v.name, kcal: v.kcal };
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const g = v[key];
    if (isNum(g) && g >= 0) fav[key] = g;
  }
  return fav;
}

function isValidExercise(v: unknown): v is Exercise {
  return (
    isRecord(v) && isStr(v.id) && isStr(v.name) && (BODY_PARTS as readonly unknown[]).includes(v.bodyPart)
  );
}

const isEquipment = (v: unknown): v is Equipment => typeof v === 'string' && v in EQUIPMENT_LABELS;
const isMuscle = (v: unknown): v is Muscle => typeof v === 'string' && v in MUSCLE_LABELS;
/** 只留下認得的肌群（畫面會用肌群查中文名稱） */
const knownMuscles = (v: unknown): Muscle[] => (Array.isArray(v) ? v.filter(isMuscle) : []);

/**
 * 舊版自訂動作沒有器材與肌群：補上「其他」與部位預設肌群。
 * 認不得的器材、肌群（例如手動改過的備份檔）也一樣處理，避免畫面查不到名稱而出錯。
 */
function withExerciseDefaults(e: Exercise): Exercise {
  const part = e.bodyPart as BodyPart;
  const primary = knownMuscles(e.primaryMuscles);
  return {
    ...e,
    equipment: isEquipment(e.equipment) ? e.equipment : 'other',
    primaryMuscles: primary.length ? primary : [...DEFAULT_MUSCLES[part]],
    secondaryMuscles: knownMuscles(e.secondaryMuscles),
    isBodyweight: e.isBodyweight === true,
    isCustom: true,
  };
}

function isValidBodyMetric(v: unknown): v is BodyMetric {
  return isRecord(v) && isStr(v.id) && typeof v.date === 'string' && DATE_RE.test(v.date);
}

/** 體態數值只保留有效的數字；照片只留角度正確、每個角度一張 */
function withValidMetrics(m: BodyMetric): BodyMetric {
  const result: BodyMetric = { id: m.id, date: m.date };
  for (const { key } of STORED_METRICS) {
    const v: unknown = m[key];
    if (isNum(v)) result[key] = v;
  }
  if (Array.isArray(m.photos)) {
    const photos: BodyPhoto[] = [];
    for (const p of m.photos as unknown[]) {
      if (!isRecord(p) || !oneOf(BODY_POSES, p.pose) || !isStr(p.photoId)) continue;
      if (photos.some((x) => x.pose === p.pose)) continue;
      photos.push({ pose: p.pose, photoId: p.photoId });
    }
    if (photos.length > 0) result.photos = photos;
  }
  return result;
}

const SEXES: readonly Sex[] = ['male', 'female'];
const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];
const GOALS: readonly NutritionGoal[] = ['cut', 'maintain', 'bulk'];
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** TDEE 個人資料：任何一項不合理就當作沒設定，讓使用者重新填 */
function normalizeProfile(v: unknown): NutritionProfile | null {
  if (!isRecord(v)) return null;
  const { sex, birthYear, heightCm, activity, goal } = v;
  if (!oneOf(SEXES, sex) || !oneOf(ACTIVITY_LEVELS, activity) || !oneOf(GOALS, goal)) return null;
  if (!isNum(birthYear) || birthYear < 1900 || birthYear > 2100) return null;
  if (!isNum(heightCm) || heightCm < 100 || heightCm > 250) return null;
  return { sex, birthYear, heightCm, activity, goal };
}

/** 飲食紀錄：日期、名稱、熱量必須有效；營養素與照片只留有效值 */
function normalizeFoodEntry(v: unknown): FoodEntry | null {
  if (!isRecord(v) || !isStr(v.id) || typeof v.date !== 'string' || !DATE_RE.test(v.date)) return null;
  if (!isStr(v.name) || !isNum(v.kcal) || v.kcal < 0) return null;
  const entry: FoodEntry = {
    id: v.id,
    date: v.date,
    meal: oneOf(MEAL_TYPES, v.meal) ? v.meal : 'snack',
    name: v.name,
    kcal: v.kcal,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const g = v[key];
    if (isNum(g) && g >= 0) entry[key] = g;
  }
  if (isStr(v.photoId)) entry.photoId = v.photoId;
  return entry;
}

/** 設定逐項檢查型別，不對的用預設值（設定值錯誤會讓計時器、槓片計算算出錯的結果） */
function normalizeSettings(v: unknown): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, availablePlates: [...DEFAULT_SETTINGS.availablePlates] };
  if (!isRecord(v)) return s;
  const positive = (x: unknown): x is number => isNum(x) && x > 0;
  if (positive(v.defaultRestSeconds)) s.defaultRestSeconds = v.defaultRestSeconds;
  if (isNum(v.barWeight) && v.barWeight >= 0) s.barWeight = v.barWeight;
  if (Array.isArray(v.availablePlates)) {
    const plates = v.availablePlates.filter(positive);
    if (plates.length > 0) s.availablePlates = plates;
  }
  if (typeof v.timerSound === 'boolean') s.timerSound = v.timerSound;
  if (typeof v.timerVibrate === 'boolean') s.timerVibrate = v.timerVibrate;
  if (isNum(v.lastBackupAt)) s.lastBackupAt = v.lastBackupAt;
  if (positive(v.stretchSeconds)) s.stretchSeconds = v.stretchSeconds;
  if (typeof v.stretchRoller === 'boolean') s.stretchRoller = v.stretchRoller;
  if (v.weightUnit === 'kg' || v.weightUnit === 'lb') s.weightUnit = v.weightUnit;
  if (isRecord(v.restByExercise)) {
    const rest: Record<string, number> = {};
    for (const [id, sec] of Object.entries(v.restByExercise)) if (positive(sec)) rest[id] = sec;
    if (Object.keys(rest).length > 0) s.restByExercise = rest;
  }
  if (isRecord(v.setTargets)) {
    const targets: NonNullable<Settings['setTargets']> = {};
    for (const part of BODY_PARTS) {
      const t = v.setTargets[part];
      if (isValidTarget(t)) targets[part] = { min: t.min, max: t.max };
    }
    if (Object.keys(targets).length > 0) s.setTargets = targets;
  }
  return s;
}

/**
 * 進行中的草稿：結構不對就捨棄。
 * 草稿壞掉時紀錄頁和訓練畫面都會出錯，捨棄一份草稿比整個 App 打不開好。
 */
function normalizeDraft(v: unknown): WorkoutDraft | null {
  if (!isRecord(v) || !isStr(v.id) || typeof v.date !== 'string' || !DATE_RE.test(v.date)) return null;
  if (!Array.isArray(v.exercises)) return null;
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const exercises: DraftExercise[] = [];
  for (const ex of v.exercises) {
    if (!isRecord(ex) || !isStr(ex.key) || !isStr(ex.exerciseId) || !Array.isArray(ex.sets)) return null;
    const sets: DraftSet[] = [];
    for (const s of ex.sets) {
      if (!isRecord(s)) return null;
      sets.push({
        key: isStr(s.key) ? s.key : createId(),
        weight: str(s.weight),
        reps: str(s.reps),
        rpe: str(s.rpe),
        isWarmup: s.isWarmup === true,
        completed: s.completed === true,
      });
    }
    const exercise: DraftExercise = { key: ex.key, exerciseId: ex.exerciseId, sets };
    if (typeof ex.note === 'string' && ex.note) exercise.note = ex.note;
    if (isStr(ex.supersetId)) exercise.supersetId = ex.supersetId;
    exercises.push(exercise);
  }
  const draft: WorkoutDraft = {
    id: v.id,
    date: v.date,
    exercises,
    note: str(v.note),
    startedAt: isNum(v.startedAt) ? v.startedAt : Date.now(),
  };
  if (isStr(v.editingSessionId)) draft.editingSessionId = v.editingSessionId;
  return draft;
}

/**
 * 補齊缺少的欄位，確保結構完整。
 * 陣列欄位若型別錯誤就視為空陣列；設定缺少或型別錯誤的欄位用預設值補上。
 */
function normalize(data: Record<string, unknown>): AppData {
  const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);

  return {
    version: CURRENT_DATA_VERSION,
    customExercises: arr<unknown>(data.customExercises, []).filter(isValidExercise).map(withExerciseDefaults),
    sessions: arr<unknown>(data.sessions, []).filter(isValidSession).map(normalizeSession),
    bodyMetrics: arr<unknown>(data.bodyMetrics, []).filter(isValidBodyMetric).map(withValidMetrics),
    settings: normalizeSettings(data.settings),
    activeDraft: normalizeDraft(data.activeDraft),
    nutritionProfile: normalizeProfile(data.nutritionProfile),
    foodEntries: arr<unknown>(data.foodEntries, []).map(normalizeFoodEntry).filter((e): e is FoodEntry => e !== null),
    templates: arr<unknown>(data.templates, [])
      .map(normalizeTemplate)
      .filter((t): t is WorkoutTemplate => t !== null),
    foodFavorites: arr<unknown>(data.foodFavorites, [])
      .map(normalizeFoodFavorite)
      .filter((f): f is FoodFavorite => f !== null),
  };
}
