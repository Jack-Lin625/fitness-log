import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../types/models';
import { addDays } from './date';
import { findPlateaus } from './plateau';

const TODAY = '2026-10-19';
const traits = (id: string) => ({ bodyweight: id === 'pull-up', assisted: id === 'assisted-pull-up' });
let n = 0;
const s = (daysAgo: number, exerciseId: string, weight: number, reps: number, isWarmup = false): WorkoutSession => ({
  id: `s${++n}`,
  date: addDays(TODAY, -daysAgo),
  createdAt: n,
  updatedAt: n,
  exercises: [{ exerciseId, sets: [{ weight, reps, isWarmup }] }],
});

describe('findPlateaus', () => {
  it('上次進步 5 週前、之後又練了 4 次：停滯', () => {
    const sessions = [
      s(40, 'squat', 95, 5),
      s(35, 'squat', 100, 5),
      s(28, 'squat', 100, 5),
      s(21, 'squat', 97.5, 5),
      s(14, 'squat', 100, 5),
      s(3, 'squat', 100, 4),
    ];
    expect(findPlateaus(sessions, TODAY, traits)).toEqual([
      { exerciseId: 'squat', lastProgress: addDays(TODAY, -35), weeks: 5, sessionsSince: 4 },
    ]);
  });

  it('最近有進步、之後練不到 3 次、最近 2 週沒練：都不算', () => {
    const progressing = [s(42, 'bench-press', 80, 5), s(7, 'bench-press', 82.5, 5)];
    const fewSessions = [s(42, 'squat', 100, 5), s(20, 'squat', 100, 5), s(5, 'squat', 100, 5)];
    const inactive = [
      s(70, 'deadlift', 140, 5),
      s(50, 'deadlift', 140, 5),
      s(40, 'deadlift', 140, 5),
      s(30, 'deadlift', 140, 5),
    ];
    expect(findPlateaus([...progressing, ...fewSessions, ...inactive], TODAY, traits)).toEqual([]);
  });

  it('加重但次數變少（估算 1RM 沒變高）也算進步', () => {
    const sessions = [
      s(50, 'squat', 100, 8),
      s(40, 'squat', 100, 8),
      s(30, 'squat', 100, 8),
      s(20, 'squat', 105, 3),
      s(10, 'squat', 100, 8),
      s(3, 'squat', 100, 8),
    ];
    expect(findPlateaus(sessions, TODAY, traits)).toEqual([]);
  });

  it('自體重量動作看次數；輔助機器不判斷；熱身組不算練過', () => {
    const pullUps = [s(40, 'pull-up', 0, 10), s(30, 'pull-up', 0, 9), s(20, 'pull-up', 0, 10), s(10, 'pull-up', 0, 8)];
    const assisted = [
      s(40, 'assisted-pull-up', 30, 8),
      s(30, 'assisted-pull-up', 30, 8),
      s(20, 'assisted-pull-up', 30, 8),
      s(10, 'assisted-pull-up', 30, 8),
    ];
    expect(findPlateaus([...pullUps, ...assisted], TODAY, traits).map((p) => p.exerciseId)).toEqual(['pull-up']);
    const warmupOnly = [...pullUps.slice(0, 3), s(10, 'pull-up', 0, 5, true)];
    expect(findPlateaus(warmupOnly, TODAY, traits)).toEqual([]);
  });

  it('只看 today 之前的紀錄', () => {
    const sessions = [
      s(40, 'squat', 100, 5),
      s(30, 'squat', 100, 5),
      s(20, 'squat', 100, 5),
      s(10, 'squat', 100, 5),
      s(0, 'squat', 110, 5),
    ];
    expect(findPlateaus(sessions, TODAY, traits)).toHaveLength(1);
  });
});
