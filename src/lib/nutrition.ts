/**
 * TDEE 與每日建議攝取量
 *
 * - 基礎代謝（BMR）：預設用 Mifflin-St Jeor；有近期體脂率時改用 Katch-McArdle
 *   （用去脂體重計算，對肌肉量多或體脂高的人比較準）。
 * - TDEE = BMR × 活動係數。
 * - 目標熱量：減脂 −20%（不低於基礎代謝）、維持、增肌 +10%（乾淨增肌，減少多長的脂肪）。
 * - 營養素：蛋白質依體重（減脂時多一點，保留肌肉）；脂肪約佔 25% 熱量且不低於 0.6 g/kg；剩下給碳水。
 * 這些都是估算的起點，實際要看 2–3 週的體重變化再微調。
 */
import type { ActivityLevel, BodyMetric, MealType, NutritionGoal, NutritionProfile, Sex } from '../types/models';
import { addDays } from './date';

export interface ActivityOption {
  id: ActivityLevel;
  label: string;
  detail: string;
  factor: number;
}

export const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  { id: 'sedentary', label: '久坐', detail: '辦公室工作，幾乎不運動', factor: 1.2 },
  { id: 'light', label: '輕度', detail: '每週運動 1–3 天', factor: 1.375 },
  { id: 'moderate', label: '中度', detail: '每週運動 3–5 天', factor: 1.55 },
  { id: 'active', label: '高度', detail: '每週運動 6–7 天', factor: 1.725 },
  { id: 'veryActive', label: '非常高', detail: '體力勞動工作，或一天練兩次', factor: 1.9 },
];

export interface GoalOption {
  id: NutritionGoal;
  label: string;
  detail: string;
  /** 目標熱量 = TDEE × factor */
  factor: number;
  /** 每公斤體重的蛋白質（公克） */
  proteinPerKg: number;
}

export const GOAL_OPTIONS: readonly GoalOption[] = [
  { id: 'cut', label: '減脂', detail: '每天少吃約 20%，每週約減 0.3–0.7 kg', factor: 0.8, proteinPerKg: 2.0 },
  { id: 'maintain', label: '維持', detail: '吃到 TDEE，體重維持不變', factor: 1, proteinPerKg: 1.6 },
  { id: 'bulk', label: '增肌', detail: '每天多吃約 10%，減少多長的脂肪', factor: 1.1, proteinPerKg: 1.8 },
];

/** 約 7,700 kcal ≈ 1 kg 體重 */
const KCAL_PER_KG = 7700;
/** 體脂率在體重量測前這麼多天內才採用 */
const BODY_FAT_MAX_AGE_DAYS = 60;

export function ageFromBirthYear(birthYear: number, today: Date = new Date()): number {
  return today.getFullYear() - birthYear;
}

/** Mifflin-St Jeor：男 10W + 6.25H − 5A + 5；女 −161 */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Katch-McArdle：370 + 21.6 × 去脂體重 */
export function katchMcArdle(weightKg: number, bodyFatPct: number): number {
  return 370 + 21.6 * weightKg * (1 - bodyFatPct / 100);
}

export interface BodyInput {
  weightKg: number;
  /** 最新體重的日期 */
  weightDate: string;
  /** 有近期體脂率才會有 */
  bodyFatPct?: number;
}

/** 從體態紀錄（舊到新）取最新體重，以及量體重前 60 天內最新的體脂率 */
export function latestBody(metrics: BodyMetric[]): BodyInput | null {
  const withWeight = metrics.filter((m) => m.weight !== undefined);
  const last = withWeight[withWeight.length - 1];
  if (!last || last.weight === undefined) return null;
  const body: BodyInput = { weightKg: last.weight, weightDate: last.date };
  const since = addDays(last.date, -BODY_FAT_MAX_AGE_DAYS);
  const fat = [...metrics].reverse().find((m) => m.bodyFat !== undefined && m.date >= since && m.date <= last.date);
  if (fat?.bodyFat !== undefined) body.bodyFatPct = fat.bodyFat;
  return body;
}

export interface NutritionPlan {
  formula: 'mifflin' | 'katch';
  bmr: number;
  tdee: number;
  /** TDEE 的來源：公式估計，或由飲食與體重紀錄推算 */
  tdeeSource: 'formula' | 'measured';
  /** 公式估計的 TDEE（用推算值時拿來比較） */
  formulaTdee: number;
  /** 每日目標熱量 */
  target: number;
  /** 減脂目標低於基礎代謝，已拉高到基礎代謝 */
  raisedToBmr: boolean;
  /** 公克 */
  protein: number;
  fat: number;
  carbs: number;
  /** 照目標熱量吃，預估每週體重變化（kg，負數為減少） */
  weeklyChangeKg: number;
}

const round10 = (v: number) => Math.round(v / 10) * 10;

/**
 * measuredTdee：由紀錄推算的 TDEE（lib/adaptiveTdee.ts）；使用者選擇採用、且有算出來時取代公式估計。
 */
export function nutritionPlan(
  profile: NutritionProfile,
  body: BodyInput,
  today: Date = new Date(),
  measuredTdee?: number,
): NutritionPlan {
  const age = ageFromBirthYear(profile.birthYear, today);
  const useKatch = body.bodyFatPct !== undefined;
  const bmr = round10(
    useKatch
      ? katchMcArdle(body.weightKg, body.bodyFatPct ?? 0)
      : mifflinStJeor(profile.sex, body.weightKg, profile.heightCm, age),
  );
  const activity = ACTIVITY_OPTIONS.find((a) => a.id === profile.activity) ?? ACTIVITY_OPTIONS[0]!;
  const goal = GOAL_OPTIONS.find((g) => g.id === profile.goal) ?? GOAL_OPTIONS[1]!;
  const formulaTdee = round10(bmr * activity.factor);
  const useMeasured = profile.useMeasuredTdee === true && measuredTdee !== undefined;
  const tdee = useMeasured ? round10(measuredTdee) : formulaTdee;

  const raw = round10(tdee * goal.factor);
  const raisedToBmr = raw < bmr;
  const target = Math.max(raw, bmr);

  const protein = Math.round(body.weightKg * goal.proteinPerKg);
  const fat = Math.round(Math.max((target * 0.25) / 9, body.weightKg * 0.6));
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));

  return {
    formula: useKatch ? 'katch' : 'mifflin',
    bmr,
    tdee,
    tdeeSource: useMeasured ? 'measured' : 'formula',
    formulaTdee,
    target,
    raisedToBmr,
    protein,
    fat,
    carbs,
    weeklyChangeKg: Math.round((((target - tdee) * 7) / KCAL_PER_KG) * 100) / 100,
  };
}

/** 依現在時間猜是哪一餐 */
export function mealForHour(hour: number): MealType {
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 14) return 'lunch';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'snack';
}
