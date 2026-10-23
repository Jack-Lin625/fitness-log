import { describe, expect, it } from 'vitest';
import type { BodyMetric, NutritionProfile } from '../types/models';
import { ageFromBirthYear, katchMcArdle, latestBody, mealForHour, mifflinStJeor, nutritionPlan } from './nutrition';

/** 固定「今天」，年齡才不會隨執行年份改變 */
const TODAY = new Date(2026, 5, 1);

describe('基礎代謝公式', () => {
  it('Mifflin-St Jeor：男 +5、女 −161', () => {
    expect(mifflinStJeor('male', 70, 175, 30)).toBe(1648.75);
    expect(mifflinStJeor('female', 55, 160, 25)).toBe(1264);
  });

  it('Katch-McArdle：370 + 21.6 × 去脂體重', () => {
    expect(katchMcArdle(80, 20)).toBeCloseTo(1752.4);
  });

  it('年齡以出生年計算', () => {
    expect(ageFromBirthYear(1996, TODAY)).toBe(30);
  });
});

describe('nutritionPlan', () => {
  const profile = (p: Partial<NutritionProfile>): NutritionProfile => ({
    sex: 'male',
    birthYear: 1996,
    heightCm: 175,
    activity: 'moderate',
    goal: 'maintain',
    ...p,
  });

  it('維持：男、30 歲、175 cm、70 kg、中度活動', () => {
    // BMR 1648.75 → 1650；TDEE 1650 × 1.55 = 2557.5 → 2560
    // 蛋白質 70 × 1.6 = 112 g；脂肪 2560 × 25% ÷ 9 = 71 g；碳水 (2560 − 448 − 639) ÷ 4 = 368 g
    expect(nutritionPlan(profile({}), { weightKg: 70, weightDate: '2026-06-01' }, TODAY)).toEqual({
      formula: 'mifflin',
      bmr: 1650,
      tdee: 2560,
      tdeeSource: 'formula',
      formulaTdee: 2560,
      target: 2560,
      raisedToBmr: false,
      protein: 112,
      fat: 71,
      carbs: 368,
      weeklyChangeKg: 0,
    });
  });

  it('減脂：目標低於基礎代謝時拉高到基礎代謝', () => {
    // 女、30 歲（1996）：550 + 1000 − 150 − 161 = 1239 → 1240；久坐 × 1.2 = 1488 → 1490
    // 減 20% = 1192 → 1190，低於 1240 → 用 1240
    const plan = nutritionPlan(
      profile({ sex: 'female', heightCm: 160, activity: 'sedentary', goal: 'cut' }),
      { weightKg: 55, weightDate: '2026-06-01' },
      TODAY,
    );
    expect(plan).toMatchObject({ bmr: 1240, tdee: 1490, target: 1240, raisedToBmr: true, protein: 110 });
    // (1240 − 1490) × 7 ÷ 7700 = −0.227
    expect(plan.weeklyChangeKg).toBe(-0.23);
  });

  it('增肌＋有體脂率：改用 Katch-McArdle', () => {
    // 去脂 64 kg：370 + 21.6 × 64 = 1752.4 → 1750；高度活動 × 1.725 = 3018.75 → 3020；+10% = 3322 → 3320
    // 蛋白質 80 × 1.8 = 144；脂肪 3320 × 25% ÷ 9 = 92；碳水 (3320 − 576 − 828) ÷ 4 = 479
    const plan = nutritionPlan(
      profile({ activity: 'active', goal: 'bulk' }),
      { weightKg: 80, weightDate: '2026-06-01', bodyFatPct: 20 },
      TODAY,
    );
    expect(plan).toMatchObject({ formula: 'katch', bmr: 1750, tdee: 3020, target: 3320, protein: 144, fat: 92, carbs: 479 });
    expect(plan.weeklyChangeKg).toBe(0.27);
  });

  it('脂肪至少每公斤 0.6 g；碳水不會是負數', () => {
    // 體重很重、熱量很低的極端情況
    const plan = nutritionPlan(profile({ goal: 'cut', activity: 'sedentary' }), { weightKg: 200, weightDate: '2026-06-01', bodyFatPct: 60 }, TODAY);
    expect(plan.fat).toBeGreaterThanOrEqual(120);
    expect(plan.carbs).toBeGreaterThanOrEqual(0);
  });
});

describe('latestBody', () => {
  const m = (date: string, v: Partial<BodyMetric>): BodyMetric => ({ id: date, date, ...v });

  it('取最新體重，以及量體重前 60 天內最新的體脂率', () => {
    expect(
      latestBody([m('2026-08-01', { weight: 70, bodyFat: 18 }), m('2026-09-20', { bodyFat: 17 }), m('2026-10-20', { weight: 71 })]),
    ).toEqual({ weightKg: 71, weightDate: '2026-10-20', bodyFatPct: 17 });
  });

  it('體脂率超過 60 天就不採用', () => {
    expect(latestBody([m('2026-08-01', { weight: 70, bodyFat: 18 }), m('2026-10-20', { weight: 71 })])).toEqual({
      weightKg: 71,
      weightDate: '2026-10-20',
    });
  });

  it('沒有體重紀錄時回傳 null', () => {
    expect(latestBody([m('2026-10-20', { waist: 80 })])).toBeNull();
    expect(latestBody([])).toBeNull();
  });
});

describe('mealForHour', () => {
  it.each([
    [7, 'breakfast'],
    [12, 'lunch'],
    [15, 'snack'],
    [19, 'dinner'],
    [23, 'snack'],
    [3, 'snack'],
  ] as const)('%i 點 → %s', (hour, meal) => {
    expect(mealForHour(hour)).toBe(meal);
  });
});

describe('nutritionPlan：採用推算的 TDEE', () => {
  const p = { sex: 'male', birthYear: 1996, heightCm: 175, activity: 'moderate', goal: 'cut' } as const;
  const body = { weightKg: 70, weightDate: '2026-06-01' };
  const TODAY2 = new Date(2026, 5, 1);

  it('選擇採用且有推算值時，用推算值計算目標；公式值保留比較', () => {
    const plan = nutritionPlan({ ...p, useMeasuredTdee: true }, body, TODAY2, 2804);
    expect(plan).toMatchObject({ tdee: 2800, tdeeSource: 'measured', formulaTdee: 2560, target: 2240 });
  });

  it('沒選擇採用、或推算值還算不出來時，用公式', () => {
    expect(nutritionPlan(p, body, TODAY2, 2800)).toMatchObject({ tdee: 2560, tdeeSource: 'formula' });
    expect(nutritionPlan({ ...p, useMeasuredTdee: true }, body, TODAY2)).toMatchObject({ tdee: 2560, tdeeSource: 'formula' });
  });
});
