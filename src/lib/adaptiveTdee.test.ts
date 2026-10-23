import { describe, expect, it } from 'vitest';
import type { BodyMetric } from '../types/models';
import { estimateTdee } from './adaptiveTdee';
import { addDays } from './date';

const TODAY = '2026-10-23';

/** 過去 28 天（昨天往回）：每天吃 kcal，體重從 startKg 每天變化 perDay */
function history(opts: { kcal: number; days?: number[]; startKg: number; perDayKg: number; weighEvery?: number }) {
  const food = new Map<string, number>();
  const metrics: BodyMetric[] = [];
  for (let i = 28; i >= 1; i--) {
    const date = addDays(TODAY, -i);
    const n = 28 - i; // 0 = 最早
    if (!opts.days || opts.days.includes(n)) food.set(date, opts.kcal);
    if (n % (opts.weighEvery ?? 2) === 0) metrics.push({ id: date, date, weight: opts.startKg + opts.perDayKg * n });
  }
  return { food, metrics };
}

describe('estimateTdee（用飲食與體重變化推算 TDEE）', () => {
  it('每天吃 2,000、每週瘦 0.5 kg → TDEE 約 2,550', () => {
    const { food, metrics } = history({ kcal: 2000, startKg: 80, perDayKg: -0.5 / 7 });
    const r = estimateTdee(food, metrics, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tdee).toBe(2550);
    expect(r.weeklyChangeKg).toBeCloseTo(-0.5, 2);
    expect(r.avgIntake).toBe(2000);
    expect([r.from, r.to]).toEqual(['2026-09-25', '2026-10-22']);
  });

  it('體重不變 → TDEE 等於平均攝取；增重時 TDEE 低於攝取', () => {
    const flat = history({ kcal: 2400, startKg: 70, perDayKg: 0 });
    expect(estimateTdee(flat.food, flat.metrics, TODAY)).toMatchObject({ ok: true, tdee: 2400 });
    // 每週增 0.2 kg：3,000 − 0.2 × 7,700 ÷ 7 = 2,780
    const gain = history({ kcal: 3000, startKg: 70, perDayKg: 0.2 / 7 });
    expect(estimateTdee(gain.food, gain.metrics, TODAY)).toMatchObject({ ok: true, tdee: 2780 });
  });

  it('體重每天上下波動時，用趨勢計算，結果仍接近', () => {
    const { food, metrics } = history({ kcal: 2000, startKg: 80, perDayKg: -0.5 / 7, weighEvery: 1 });
    const noisy = metrics.map((m, i) => ({ ...m, weight: m.weight! + (i % 2 === 0 ? 0.6 : -0.6) }));
    const r = estimateTdee(food, noisy, TODAY);
    expect(r.ok && Math.abs(r.tdee - 2550) <= 60).toBe(true);
  });

  it('飲食記錄不夠、體重量太少或期間太短時，說明還缺什麼', () => {
    const few = history({ kcal: 2000, startKg: 80, perDayKg: 0, days: [0, 1, 2, 3, 4] });
    expect(estimateTdee(few.food, few.metrics, TODAY)).toMatchObject({ ok: false, missing: ['再記錄 15 天完整的飲食'], foodDays: 5 });

    const full = history({ kcal: 2000, startKg: 80, perDayKg: 0 });
    expect(estimateTdee(full.food, full.metrics.slice(0, 3), TODAY)).toMatchObject({ ok: false, missing: ['再量 3 次體重'] });
    // 6 次體重但只在 10 天內
    expect(estimateTdee(full.food, full.metrics.slice(0, 6), TODAY)).toMatchObject({ ok: false, missing: ['體重紀錄要跨越至少 14 天'] });
  });

  it('今天和 28 天以前的紀錄不算；熱量太低的日子（只記一部分）不算', () => {
    const { food, metrics } = history({ kcal: 2000, startKg: 80, perDayKg: 0 });
    food.set(TODAY, 9000);
    food.set(addDays(TODAY, -40), 9000);
    food.set(addDays(TODAY, -3), 300);
    const r = estimateTdee(food, metrics, TODAY);
    expect(r).toMatchObject({ ok: true, tdee: 2000, foodDays: 27 });
  });

  it('算出不合理的數字時不顯示', () => {
    const { food, metrics } = history({ kcal: 900, startKg: 80, perDayKg: 0.3 });
    expect(estimateTdee(food, metrics, TODAY).ok).toBe(false);
  });
});
