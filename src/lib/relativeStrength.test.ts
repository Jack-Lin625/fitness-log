import { describe, expect, it } from 'vitest';
import { bestRelative, bestRelativeOf, formatRatio, MAX_GAP_DAYS, relativeTrend, weighIns, weightOn } from './relativeStrength';
import { addDays } from './date';

const metrics = [
  { id: '2', date: '2026-10-10', weight: 78 },
  { id: '1', date: '2026-10-01', weight: 80 },
  { id: '3', date: '2026-10-05', waist: 82 }, // 沒有體重
  { id: '4', date: '2026-10-20', weight: 76 },
];

describe('relativeStrength', () => {
  const list = weighIns(metrics);

  it('只取有體重的紀錄，依日期排序', () => {
    expect(list.map((w) => w.weight)).toEqual([80, 78, 76]);
  });

  it('某天的體重：當天、最接近的一次；一樣近取之前的', () => {
    expect(weightOn(list, '2026-10-10')).toBe(78);
    expect(weightOn(list, '2026-10-08')).toBe(78);
    expect(weightOn(list, '2026-10-03')).toBe(80);
    expect(weightOn(list, '2026-10-15')).toBe(78); // 差 5 天和差 5 天
    expect(weightOn(list, '2026-09-20')).toBe(80); // 第一次量之前
    expect(weightOn(list, '2026-10-30')).toBe(76); // 最後一次量之後
  });

  it(`相差超過 ${MAX_GAP_DAYS} 天就不算`, () => {
    expect(weightOn(list, addDays('2026-10-20', MAX_GAP_DAYS))).toBe(76);
    expect(weightOn(list, addDays('2026-10-20', MAX_GAP_DAYS + 1))).toBeNull();
    expect(weightOn([], '2026-10-20')).toBeNull();
  });

  it('體重下降、1RM 持平：相對力量上升；找不到體重的略過', () => {
    const trend = relativeTrend(
      [
        { date: '2026-10-01', e1rm: 120, topWeight: 100 },
        { date: '2026-10-20', e1rm: 120, topWeight: 100 },
        { date: '2027-03-01', e1rm: 130, topWeight: 110 },
      ],
      list,
    );
    expect(trend.map((p) => formatRatio(p.ratio))).toEqual(['1.50', '1.58']);
    expect(bestRelative(trend)).toMatchObject({ date: '2026-10-20', bodyweight: 76 });
    expect(bestRelative([])).toBeNull();
  });
});

describe('bestRelativeOf', () => {
  it('某個動作相對力量最好的一次；沒有體重紀錄回傳 null', () => {
    const session = (id: string, date: string, weight: number) => ({
      id,
      date,
      createdAt: 1,
      updatedAt: 1,
      exercises: [{ exerciseId: 'squat', sets: [{ weight, reps: 1 }] }],
    });
    const sessions = [session('a', '2026-10-01', 120), session('b', '2026-10-20', 118)];
    const list = weighIns([
      { id: '1', date: '2026-10-01', weight: 80 },
      { id: '2', date: '2026-10-20', weight: 76 },
    ]);
    expect(bestRelativeOf(sessions, 'squat', list)).toMatchObject({ date: '2026-10-20', bodyweight: 76 });
    expect(bestRelativeOf(sessions, 'squat', [])).toBeNull();
    expect(bestRelativeOf(sessions, 'bench-press', list)).toBeNull();
  });
});
