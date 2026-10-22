/**
 * 資料模型定義
 * 所有儲存到 localStorage 的資料都必須符合這些 interface。
 * 修改結構時：遞增 CURRENT_DATA_VERSION，並在 data/migrations.ts 加上升級函式。
 */

/** 身體部位分類 */
export type BodyPart = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

/** 部位顯示順序 */
export const BODY_PARTS: readonly BodyPart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

/** 部位中文名稱 */
export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: '胸',
  back: '背',
  legs: '腿',
  shoulders: '肩',
  arms: '手臂',
  core: '核心',
};

/**
 * 肌群（拉伸、訓練量分析用）
 * 依健身房常用的分法，粒度足以區分「股四頭」「腿後」「內收肌」這類拉伸目標。
 */
export type Muscle =
  | 'pecs' | 'upperPecs'
  | 'lats' | 'upperBack' | 'traps' | 'lowerBack'
  | 'frontDelts' | 'sideDelts' | 'rearDelts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'abductors' | 'adductors' | 'hipFlexors' | 'calves'
  | 'abs' | 'obliques';

/** 器材（一般大型健身房常見的器材） */
export type Equipment =
  // 自由重量
  | 'barbell' | 'ezbar' | 'trapbar' | 'dumbbell' | 'kettlebell' | 'band'
  // 纜繩、史密斯
  | 'cable' | 'smith'
  // 機器
  | 'chest-press-machine' | 'pec-deck' | 'shoulder-press-machine' | 'lateral-raise-machine'
  | 'lat-pulldown' | 'seated-row-machine' | 'tbar' | 'assisted-machine'
  | 'leg-press' | 'hack-squat' | 'leg-extension' | 'leg-curl' | 'hip-machine' | 'hip-thrust-machine'
  | 'calf-machine' | 'arm-machine' | 'ab-machine'
  // 椅子、架子、徒手
  | 'bench' | 'preacher-bench' | 'back-extension' | 'pullup-bar' | 'dip-station' | 'ab-wheel' | 'box'
  | 'bodyweight' | 'other';

/** 動作定義 */
export interface Exercise {
  /** 內建動作用固定 id（如 'squat'），自訂動作用 uuid */
  id: string;
  /** 顯示名稱，如「深蹲」 */
  name: string;
  bodyPart: BodyPart;
  /** 主要使用的器材 */
  equipment: Equipment;
  /** 主要訓練的肌群 */
  primaryMuscles: Muscle[];
  /** 輔助出力的肌群 */
  secondaryMuscles: Muscle[];
  /** 自體重量動作（引體向上、伏地挺身等），weight 代表額外負重 */
  isBodyweight: boolean;
  /** 輔助機器動作（輔助引體向上等），weight 代表「輔助重量」，越重越輕鬆，不計入容量與重量紀錄 */
  assisted?: boolean;
  /** 只有自訂動作可以刪除 */
  isCustom: boolean;
  /** 刪除自訂動作時改為封存，避免舊紀錄找不到對應動作 */
  archived?: boolean;
}

/** 單一組（不命名為 Set，避免與 JavaScript 內建 Set 撞名） */
export interface WorkoutSet {
  /** 公斤；自體重量動作代表額外負重（0 = 徒手） */
  weight: number;
  reps: number;
  /** 選填，6–10，可用 0.5 間隔 */
  rpe?: number;
  /** 熱身組不計入 PR 與訓練容量 */
  isWarmup?: boolean;
}

/** 一次訓練中的某個動作 */
export interface SessionExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  note?: string;
}

/** 一次訓練 */
export interface WorkoutSession {
  id: string;
  /** 本地日期 'YYYY-MM-DD'，不存時間以避免時區造成日期偏移 */
  date: string;
  exercises: SessionExercise[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** 體態紀錄（除日期外皆選填） */
export interface BodyMetric {
  id: string;
  /** 本地日期 'YYYY-MM-DD' */
  date: string;
  /** 體重 kg */
  weight?: number;
  /** 體脂率 % */
  bodyFat?: number;
  /** 腰圍 cm */
  waist?: number;
  /** 胸圍 cm */
  chest?: number;
  /** 手臂圍 cm */
  arm?: number;
}

/** 使用者設定 */
export interface Settings {
  /** 組間休息預設秒數 */
  defaultRestSeconds: number;
  /** 槓鈴重量 kg */
  barWeight: number;
  /** 健身房有的槓片（單片重量 kg），由大到小 */
  availablePlates: number[];
  timerSound: boolean;
  timerVibrate: boolean;
  /** 上次匯出 JSON 備份的時間（timestamp），用來提醒定期備份 */
  lastBackupAt?: number;
  /** 每個拉伸動作維持的秒數（未設定時為 30） */
  stretchSeconds?: number;
  /** 拉伸時加入滾筒放鬆 */
  stretchRoller?: boolean;
}

/*
 * ───────── 訓練草稿 ─────────
 * 訓練進行中的暫存資料。欄位用字串而非數字，是為了保留使用者正在輸入的內容
 * （例如輸入到一半的「82.」），完成訓練時才轉換成 WorkoutSession。
 */

/** 草稿中的一組 */
export interface DraftSet {
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
  /** 已勾選完成（只在訓練進行中使用，不會存進正式紀錄） */
  completed: boolean;
}

/** 草稿中的一個動作 */
export interface DraftExercise {
  /** 畫面用的穩定識別碼，讓調整動作順序時不會錯亂 */
  key: string;
  exerciseId: string;
  sets: DraftSet[];
}

/** 進行中的訓練（同一時間最多一份） */
export interface WorkoutDraft {
  id: string;
  date: string;
  exercises: DraftExercise[];
  note: string;
  startedAt: number;
  /** 有值代表正在修改既有紀錄，而不是新增 */
  editingSessionId?: string;
}

/** 目前資料格式版本 */
export const CURRENT_DATA_VERSION = 3;

/**
 * localStorage 中實際儲存的根物件。
 * 未來加入營養／飲食功能時，在這裡新增欄位（如 meals、foods）並遞增版本號。
 */
export interface AppData {
  version: number;
  /** 只存自訂動作；內建動作由 data/defaultExercises.ts 提供 */
  customExercises: Exercise[];
  sessions: WorkoutSession[];
  bodyMetrics: BodyMetric[];
  settings: Settings;
  /** 進行中的訓練草稿（v2 新增），關掉網頁再回來也不會遺失 */
  activeDraft: WorkoutDraft | null;
}
