import { DEFAULT_MUSCLES } from './catalog';
import {
  BODY_PARTS,
  type BodyPart,
  CURRENT_DATA_VERSION,
  type AppData,
  type BodyMetric,
  type Exercise,
  type Settings,
  type WorkoutDraft,
  type WorkoutSession,
} from '../types/models';

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

function isValidSession(v: unknown): v is WorkoutSession {
  if (!isRecord(v) || !isStr(v.id) || typeof v.date !== 'string' || !DATE_RE.test(v.date)) return false;
  if (!Array.isArray(v.exercises)) return false;
  return v.exercises.every(
    (ex) =>
      isRecord(ex) &&
      isStr(ex.exerciseId) &&
      Array.isArray(ex.sets) &&
      ex.sets.every((s) => isRecord(s) && isNum(s.weight) && isNum(s.reps)),
  );
}

function isValidExercise(v: unknown): v is Exercise {
  return (
    isRecord(v) && isStr(v.id) && isStr(v.name) && (BODY_PARTS as readonly unknown[]).includes(v.bodyPart)
  );
}

/** 舊版自訂動作沒有器材與肌群：補上「其他」與部位預設肌群 */
function withExerciseDefaults(e: Exercise): Exercise {
  const part = e.bodyPart as BodyPart;
  return {
    ...e,
    equipment: typeof e.equipment === 'string' ? e.equipment : 'other',
    primaryMuscles: Array.isArray(e.primaryMuscles) && e.primaryMuscles.length ? e.primaryMuscles : [...DEFAULT_MUSCLES[part]],
    secondaryMuscles: Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles : [],
    isBodyweight: e.isBodyweight === true,
    isCustom: true,
  };
}

function isValidBodyMetric(v: unknown): v is BodyMetric {
  return isRecord(v) && isStr(v.id) && typeof v.date === 'string' && DATE_RE.test(v.date);
}

/**
 * 補齊缺少的欄位，確保結構完整。
 * 陣列欄位若型別錯誤就視為空陣列；設定缺的欄位用預設值補上。
 */
function normalize(data: Record<string, unknown>): AppData {
  const empty = createEmptyData();
  const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  const settings = isRecord(data.settings) ? (data.settings as Partial<Settings>) : {};

  return {
    version: CURRENT_DATA_VERSION,
    customExercises: arr<unknown>(data.customExercises, []).filter(isValidExercise).map(withExerciseDefaults),
    // 舊資料可能缺 createdAt/updatedAt，補上 0 讓排序正常
    sessions: arr<unknown>(data.sessions, []).filter(isValidSession).map((s) => ({
      ...s,
      createdAt: isNum(s.createdAt) ? s.createdAt : 0,
      updatedAt: isNum(s.updatedAt) ? s.updatedAt : 0,
    })),
    bodyMetrics: arr<unknown>(data.bodyMetrics, []).filter(isValidBodyMetric),
    settings: { ...empty.settings, ...settings },
    activeDraft: isRecord(data.activeDraft) ? (data.activeDraft as unknown as WorkoutDraft) : null,
  };
}
