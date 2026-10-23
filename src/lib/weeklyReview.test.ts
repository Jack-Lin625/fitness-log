import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import type { FoodEntry, WorkoutSession } from '../types/models';
import { DEFAULT_SET_TARGETS } from './setTargets';
import { hasReview, weeklyReview, type ReviewInput } from './weeklyReview';

const byId = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]));
const session = (id: string, date: string, exerciseId: string, weight: number, reps: number, sets = 3): WorkoutSession => ({
  id,
  date,
  createdAt: Number(id.replace(/\D/g, '')) || 1,
  updatedAt: 1,
  exercises: [{ exerciseId, sets: Array.from({ length: sets }, () => ({ weight, reps })) }],
});
const food = (date: string, kcal: number, protein?: number): FoodEntry => ({
  id: `${date}-${kcal}`,
  date,
  meal: 'lunch',
  name: '餐',
  kcal,
  ...(protein !== undefined ? { protein } : {}),
  createdAt: 1,
});

// 回顧 10/12（一）–10/18（日）
const base = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  sessions: [],
  bodyMetrics: [],
  foodEntries: [],
  weekStart: '2026-10-12',
  traitsOf: (id) => ({ bodyweight: byId.get(id)?.isBodyweight ?? false, assisted: byId.get(id)?.assisted === true }),
  isAssisted: (id) => byId.get(id)?.assisted === true,
  getExercise: (id) => byId.get(id),
  targets: DEFAULT_SET_TARGETS,
  ...over,
});

describe('weeklyReview', () => {
  it('次數、訓練量和前一週比較；只算週一到週日', () => {
    const r = weeklyReview(
      base({
        sessions: [
          session('s5', '2026-10-19', 'squat', 100, 5), // 下週，不算
          session('s4', '2026-10-18', 'squat', 100, 5),
          session('s3', '2026-10-12', 'bench-press', 60, 8),
          session('s2', '2026-10-11', 'squat', 90, 5), // 前一週
          session('s1', '2026-10-01', 'squat', 80, 5),
        ],
      }),
    );
    expect(r).toMatchObject({ start: '2026-10-12', end: '2026-10-19', sessions: 2, prevSessions: 1 });
    expect(r.volume).toBe(100 * 5 * 3 + 60 * 8 * 3);
    expect(r.prevVolume).toBe(90 * 5 * 3);
  });

  it('破紀錄：每個動作只列一項（優先最大重量），取這週最好的成績，previous 是這週之前的紀錄；第一次做的動作不算', () => {
    const r = weeklyReview(
      base({
        sessions: [
          session('s4', '2026-10-16', 'squat', 110, 5),
          session('s3', '2026-10-13', 'squat', 105, 5),
          session('s2', '2026-10-13', 'bench-press', 60, 5), // 第一次做
          session('s1', '2026-10-05', 'squat', 100, 5),
        ],
      }),
    );
    expect(r.records).toEqual([{ exerciseId: 'squat', kind: 'weight', value: 110, previous: 100 }]);
  });

  it('重量沒變、次數變多：列估算 1RM', () => {
    const r = weeklyReview(
      base({ sessions: [session('s2', '2026-10-14', 'squat', 100, 8), session('s1', '2026-10-05', 'squat', 100, 5)] }),
    );
    expect(r.records).toMatchObject([{ exerciseId: 'squat', kind: 'e1rm' }]);
  });

  it('平均體重與前一週比較；飲食只算有記錄的天數', () => {
    const r = weeklyReview(
      base({
        bodyMetrics: [
          { id: 'a', date: '2026-10-05', weight: 80 },
          { id: 'b', date: '2026-10-07', weight: 79 },
          { id: 'c', date: '2026-10-13', weight: 78.6 },
          { id: 'd', date: '2026-10-17', weight: 78.2 },
          { id: 'e', date: '2026-10-15', waist: 80 },
        ],
        foodEntries: [food('2026-10-12', 1000, 50), food('2026-10-12', 1200, 60), food('2026-10-14', 1800), food('2026-10-20', 9999)],
      }),
    );
    expect(r.weight?.avg).toBeCloseTo(78.4);
    expect(r.weight?.prevAvg).toBeCloseTo(79.5);
    expect(r.food).toEqual({ days: 2, avgKcal: 2000, avgProtein: 110 });
  });

  it('組數沒達標的部位；這週沒練就不列', () => {
    const r = weeklyReview(base({ sessions: [session('s1', '2026-10-14', 'squat', 100, 5, 12)] }));
    expect(r.lowParts.map((p) => p.part)).toEqual(['chest', 'back', 'shoulders', 'arms', 'core']);
    expect(r.lowParts[0]).toEqual({ part: 'chest', sets: 0, min: 10 });
    expect(weeklyReview(base()).lowParts).toEqual([]);
  });

  it('什麼都沒記錄：沒有東西可以回顧', () => {
    expect(hasReview(weeklyReview(base()))).toBe(false);
    expect(hasReview(weeklyReview(base({ foodEntries: [food('2026-10-15', 2000)] })))).toBe(true);
  });
});
