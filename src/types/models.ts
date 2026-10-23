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
  /** 這個動作的備註，例如座椅高度、握距 */
  note?: string;
  /** 超級組：相鄰且 supersetId 相同的動作輪流做 */
  supersetId?: string;
}

/** 一次訓練 */
export interface WorkoutSession {
  id: string;
  /** 本地日期 'YYYY-MM-DD'，不存時間以避免時區造成日期偏移 */
  date: string;
  exercises: SessionExercise[];
  note?: string;
  /** 訓練時長（秒），從開始訓練到按下完成；補登或修改的紀錄沒有 */
  durationSec?: number;
  createdAt: number;
  updatedAt: number;
}

/** 菜單範本：常練的動作與組數，開始訓練時一鍵帶入 */
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: SessionExercise[];
  createdAt: number;
}

/** 體態照片的角度 */
export type BodyPose = 'front' | 'side' | 'back';

/** 體態照片的顯示順序 */
export const BODY_POSES: readonly BodyPose[] = ['front', 'side', 'back'];

export const BODY_POSE_LABELS: Record<BodyPose, string> = { front: '正面', side: '側面', back: '背面' };

/** 一張體態照片；照片本身存在 IndexedDB，這裡只記 id */
export interface BodyPhoto {
  pose: BodyPose;
  photoId: string;
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
  /** 體態照片（v6 新增），每個角度最多一張 */
  photos?: BodyPhoto[];
}

/** 訓練重量的單位（資料一律以公斤儲存，只有輸入與顯示換算） */
export type WeightUnit = 'kg' | 'lb';

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
  /** 訓練重量單位（未設定為公斤） */
  weightUnit?: WeightUnit;
  /** 個別動作的休息秒數（動作 id → 秒），沒設定的用 defaultRestSeconds */
  restByExercise?: Record<string, number>;
  /** 自訂的每週各部位組數目標，沒設定的部位用預設（lib/setTargets.ts） */
  setTargets?: Partial<Record<BodyPart, { min: number; max: number }>>;
}

/*
 * ───────── 飲食 ─────────
 */

export type Sex = 'male' | 'female';

/** 活動量（含訓練），用來把基礎代謝換算成 TDEE */
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

/** 飲食目標 */
export type NutritionGoal = 'cut' | 'maintain' | 'bulk';

/** 計算 TDEE 需要的個人資料；體重、體脂率取自體態紀錄 */
export interface NutritionProfile {
  sex: Sex;
  /** 出生年（西元），用來算年齡，不必每年更新 */
  birthYear: number;
  /** 身高 cm */
  heightCm: number;
  activity: ActivityLevel;
  goal: NutritionGoal;
  /** 用飲食與體重紀錄推算的 TDEE 取代公式估計（資料足夠時才會生效） */
  useMeasuredTdee?: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** 餐別顯示順序 */
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
};

/** 一筆飲食紀錄 */
export interface FoodEntry {
  id: string;
  /** 本地日期 'YYYY-MM-DD' */
  date: string;
  meal: MealType;
  /** 食物名稱，如「雞胸便當」 */
  name: string;
  /** 熱量 kcal */
  kcal: number;
  /** 三大營養素（公克），選填 */
  protein?: number;
  carbs?: number;
  fat?: number;
  /** 照片在 IndexedDB 裡的 id；照片本身不存在 localStorage（太大） */
  photoId?: string;
  createdAt: number;
}

/** 常吃的食物，記錄時一鍵帶入 */
export interface FoodFavorite {
  id: string;
  name: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/*
 * ───────── 訓練草稿 ─────────
 * 訓練進行中的暫存資料。欄位用字串而非數字，是為了保留使用者正在輸入的內容
 * （例如輸入到一半的「82.」），完成訓練時才轉換成 WorkoutSession。
 */

/** 草稿中的一組 */
export interface DraftSet {
  /** 畫面用的穩定識別碼，刪除中間某一組時其他組的狀態不會錯位 */
  key: string;
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
  note?: string;
  supersetId?: string;
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
export const CURRENT_DATA_VERSION = 6;

/**
 * localStorage 中實際儲存的根物件。
 * 新增欄位時遞增版本號，並在 data/migrations.ts 加上升級函式。
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
  /** 計算 TDEE 的個人資料（v4 新增），還沒設定為 null */
  nutritionProfile: NutritionProfile | null;
  /** 飲食紀錄（v4 新增） */
  foodEntries: FoodEntry[];
  /** 菜單範本（v5 新增） */
  templates: WorkoutTemplate[];
  /** 常吃的食物（v5 新增） */
  foodFavorites: FoodFavorite[];
}
