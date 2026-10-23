import { describe, expect, it } from 'vitest';
import type { Exercise, WorkoutSession } from '../types/models';
import { currentWeekStreak, longestWeekStreak, monthGrid, trainingDays } from './calendar';

const session = (id: string, date: string, exerciseIds: string[] = ['squat']): WorkoutSession => ({
  id,
  date,
  createdAt: 1,
  updatedAt: 1,
  exercises: exerciseIds.map((exerciseId) => ({ exerciseId, sets: [{ weight: 100, reps: 5 }] })),
});

describe('monthGrid', () => {
  it('2026 年 10 月：週一開始，前後補上下個月的日期', () => {
    const weeks = monthGrid(2026, 9);
    // 10/1 是週四 → 第一列從 9/28（週一）開始
    expect(weeks[0]![0]).toEqual({ date: '2026-09-28', inMonth: false });
    expect(weeks[0]![3]).toEqual({ date: '2026-10-01', inMonth: true });
    // 10/31 是週六 → 最後一列到 11/1（週日）
    expect(weeks.at(-1)!.at(-1)).toEqual({ date: '2026-11-01', inMonth: false });
    expect(weeks).toHaveLength(5);
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
  });

  it('月份剛好從週一開始時，第一列就是 1 號', () => {
    // 2026 年 6 月 1 日是週一
    expect(monthGrid(2026, 5)[0]![0]).toEqual({ date: '2026-06-01', inMonth: true });
  });
});

describe('trainingDays', () => {
  const exercises: Record<string, Exercise> = {
    squat: { id: 'squat', name: '深蹲', bodyPart: 'legs', equipment: 'barbell', primaryMuscles: [], secondaryMuscles: [], isBodyweight: false, isCustom: false },
    bench: { id: 'bench', name: '臥推', bodyPart: 'chest', equipment: 'barbell', primaryMuscles: [], secondaryMuscles: [], isBodyweight: false, isCustom: false },
  };

  it('同一天的多次訓練合併，部位依固定順序、不重複', () => {
    const days = trainingDays([session('a', '2026-10-20', ['squat']), session('b', '2026-10-20', ['bench', 'squat', 'gone'])], (id) => exercises[id]);
    expect(days.get('2026-10-20')?.parts).toEqual(['chest', 'legs']);
    expect(days.get('2026-10-20')?.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('連續訓練週數', () => {
  const sessions = [
    session('1', '2026-09-22'), // 9/21 那週
    session('2', '2026-09-29'), // 9/28 那週
    session('3', '2026-10-06'), // 10/5 那週
    session('4', '2026-10-14'), // 10/12 那週
    // 10/19 那週沒練
  ];

  it('本週還沒練不算中斷，從上週往回算', () => {
    expect(currentWeekStreak([...sessions, session('5', '2026-10-21')], '2026-10-23')).toBe(5);
    // 10/26 那週還沒練：從 10/19 那週算，那週有練
    expect(currentWeekStreak([...sessions, session('5', '2026-10-21')], '2026-10-27')).toBe(5);
  });

  it('上週也沒練就是 0', () => {
    expect(currentWeekStreak(sessions, '2026-10-30')).toBe(0);
  });

  it('最長連續週數', () => {
    expect(longestWeekStreak(sessions)).toBe(4);
    expect(longestWeekStreak([...sessions, session('x', '2026-08-01')])).toBe(4);
    expect(longestWeekStreak([])).toBe(0);
  });
});
