import { describe, expect, it } from 'vitest';
import type { WorkoutSession, WorkoutSet } from '../types/models';
import { exerciseHistory } from './exerciseHistory';

const session = (id: string, date: string, sets: WorkoutSet[], extra: Partial<WorkoutSession['exercises'][number]> = {}, other: WorkoutSet[] = []): WorkoutSession => ({
  id,
  date,
  createdAt: 1,
  updatedAt: 1,
  exercises: [{ exerciseId: 'squat', sets, ...extra }, ...(other.length ? [{ exerciseId: 'bench', sets: other }] : [])],
});
const normal = { bodyweight: false, assisted: false };

describe('exerciseHistory', () => {
  const sessions = [
    session('a', '2026-10-01', [{ weight: 60, reps: 5, isWarmup: true }, { weight: 100, reps: 5 }, { weight: 100, reps: 5 }], { note: '低槓' }),
    session('b', '2026-10-08', [{ weight: 100, reps: 5 }, { weight: 102.5, reps: 5 }]),
    session('c', '2026-10-15', [{ weight: 100, reps: 4 }], {}, [{ weight: 80, reps: 5 }]),
    session('x', '2026-10-10', [], {}, [{ weight: 80, reps: 5 }]),
  ];

  it('只列出有做這個動作的訓練，新到舊', () => {
    expect(exerciseHistory(sessions, 'squat', normal).map((e) => e.sessionId)).toEqual(['c', 'b', 'a']);
  });

  it('每次的最重組、估算 1RM、正式組數、容量（不含熱身組）、備註', () => {
    const a = exerciseHistory(sessions, 'squat', normal).at(-1)!;
    expect(a).toMatchObject({ topSet: { weight: 100, reps: 5 }, workingSets: 2, volume: 1000, note: '低槓' });
    expect(a.bestE1rm).toBeCloseTo(116.67, 1);
  });

  it('標出當時打破的紀錄：第一次不算，之後和這次之前比較', () => {
    const [c, b, a] = exerciseHistory(sessions, 'squat', normal);
    expect(a!.records).toEqual([]);
    expect(b!.records.sort()).toEqual(['e1rm', 'weight']);
    expect(c!.records).toEqual([]);
  });

  it('沒做過的動作是空的', () => {
    expect(exerciseHistory(sessions, 'deadlift', normal)).toEqual([]);
  });
});

describe('exerciseHistory：逐次累積的紀錄和整批重算一致', () => {
  it('隨機的紀錄序列：每次的 PR 標記等於「和這次之前的全部紀錄比較」', async () => {
    const { computeRecords, setRecordKinds } = await import('./records');
    // 固定種子的亂數，結果可以重現
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const list: WorkoutSession[] = Array.from({ length: 60 }, (_, i) =>
      session(`s${i}`, `2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, '0')}`,
        Array.from({ length: 3 }, () => ({ weight: Math.round(80 + rand() * 40) / 2.5 * 2.5, reps: 1 + Math.floor(rand() * 12) }))),
    );
    const entries = exerciseHistory(list, 'squat', normal).reverse();
    entries.forEach((e, i) => {
      const prior = computeRecords(list.slice(0, i)).get('squat');
      const expected = new Set(e.sets.flatMap((s) => setRecordKinds(s, prior, normal)));
      expect(new Set(e.records)).toEqual(expected);
    });
  });
});
