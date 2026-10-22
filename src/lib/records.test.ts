import { describe, expect, it } from 'vitest';
import type { WorkoutSession, WorkoutSet } from '../types/models';
import { computeRecords, e1rmTrend, findNewRecords, setE1rm } from './records';

const session = (id: string, date: string, sets: WorkoutSet[], exerciseId = 'squat', createdAt = 0): WorkoutSession => ({
  id,
  date,
  createdAt,
  updatedAt: createdAt,
  exercises: [{ exerciseId, sets }],
});

const barbell = () => ({ bodyweight: false, assisted: false });
const bodyweight = () => ({ bodyweight: true, assisted: false });
const assisted = () => ({ bodyweight: true, assisted: true });

describe('setE1rm', () => {
  it('Epley：重量 × (1 + 次數 / 30)', () => {
    expect(setE1rm({ weight: 100, reps: 5 })).toBeCloseTo(116.667, 2);
    expect(setE1rm({ weight: 100, reps: 1 })).toBe(100);
  });

  it('熱身組、超過 10 下、沒有重量的不估算', () => {
    expect(setE1rm({ weight: 100, reps: 5, isWarmup: true })).toBeNull();
    expect(setE1rm({ weight: 60, reps: 11 })).toBeNull();
    expect(setE1rm({ weight: 0, reps: 5 })).toBeNull();
  });
});

describe('computeRecords', () => {
  it('最大重量同重量時次數多者勝，熱身組不算', () => {
    const rec = computeRecords([
      session('a', '2026-10-01', [{ weight: 100, reps: 3 }, { weight: 140, reps: 1, isWarmup: true }]),
      session('b', '2026-10-05', [{ weight: 100, reps: 5 }]),
    ]).get('squat');
    expect(rec?.bestWeight).toMatchObject({ sessionId: 'b', set: { weight: 100, reps: 5 } });
    expect(rec?.bestE1rm?.sessionId).toBe('b');
  });
});

describe('findNewRecords', () => {
  const s1 = session('s1', '2026-10-01', [{ weight: 100, reps: 5 }], 'squat', 1);

  it('第一次做的動作不算破紀錄', () => {
    expect(findNewRecords(s1, [s1], barbell)).toEqual([]);
  });

  it('更重的重量同時破重量與 1RM 紀錄，並指出是哪一組', () => {
    const s2 = session('s2', '2026-10-05', [{ weight: 90, reps: 5 }, { weight: 105, reps: 5 }], 'squat', 2);
    const records = findNewRecords(s2, [s1, s2], barbell);
    expect(records.map((r) => [r.kind, r.setIndex, r.previous])).toEqual([
      ['weight', 1, 100],
      ['e1rm', 1, expect.closeTo(116.667, 2)],
    ]);
  });

  it('只和「這次之前」的紀錄比較：修改舊紀錄不會被之後的紀錄擋住', () => {
    const later = session('later', '2026-10-09', [{ weight: 120, reps: 5 }], 'squat', 3);
    const s2 = session('s2', '2026-10-05', [{ weight: 105, reps: 5 }], 'squat', 2);
    expect(findNewRecords(s2, [s1, s2, later], barbell).map((r) => r.kind)).toEqual(['weight', 'e1rm']);
  });

  it('熱身組再重也不算紀錄', () => {
    const s2 = session('s2', '2026-10-05', [{ weight: 140, reps: 1, isWarmup: true }, { weight: 100, reps: 5 }], 'squat', 2);
    expect(findNewRecords(s2, [s1, s2], barbell)).toEqual([]);
  });

  it('自體重量動作看次數', () => {
    const p1 = session('p1', '2026-10-01', [{ weight: 0, reps: 8 }], 'pull-up', 1);
    const p2 = session('p2', '2026-10-05', [{ weight: 0, reps: 10 }], 'pull-up', 2);
    expect(findNewRecords(p2, [p1, p2], bodyweight).map((r) => [r.kind, r.value, r.previous])).toEqual([['reps', 10, 8]]);
  });

  it('輔助機器：輔助重量變重不算重量紀錄', () => {
    const a1 = session('a1', '2026-10-01', [{ weight: 20, reps: 8 }], 'assisted-pull-up', 1);
    const a2 = session('a2', '2026-10-05', [{ weight: 30, reps: 8 }], 'assisted-pull-up', 2);
    expect(findNewRecords(a2, [a1, a2], assisted)).toEqual([]);
  });
});

describe('e1rmTrend', () => {
  it('依日期排序，每次訓練取最佳 1RM 與最大重量，只有熱身組的那次略過', () => {
    const points = e1rmTrend(
      [
        session('b', '2026-10-05', [{ weight: 100, reps: 5 }, { weight: 110, reps: 1 }]),
        session('a', '2026-10-01', [{ weight: 90, reps: 5 }]),
        session('c', '2026-10-09', [{ weight: 60, reps: 5, isWarmup: true }]),
      ],
      'squat',
    );
    expect(points.map((p) => [p.date, Math.round(p.e1rm * 10) / 10, p.topWeight])).toEqual([
      ['2026-10-01', 105, 90],
      ['2026-10-05', 116.7, 110],
    ]);
  });
});
