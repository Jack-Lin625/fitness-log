import { describe, expect, it } from 'vitest';
import type { Exercise, WorkoutSession } from '../types/models';
import { DEFAULT_SET_TARGETS, isValidTarget, resolveTargets, targetStatus, targetText } from './setTargets';
import { setsByBodyPart } from './volume';

describe('每週組數目標', () => {
  const t = { min: 10, max: 20 };

  it('狀態與文字', () => {
    expect([targetStatus(6, t), targetText(6, t)]).toEqual(['low', '還差 4 組']);
    expect([targetStatus(10, t), targetText(10, t)]).toEqual(['ok', '達標']);
    expect([targetStatus(20, t), targetText(20, t)]).toEqual(['ok', '達標']);
    expect([targetStatus(23, t), targetText(23, t)]).toEqual(['high', '超過 3 組']);
    expect(targetStatus(5, { min: 0, max: 0 })).toBe('none');
  });

  it('自訂目標覆蓋預設，不合理的設定忽略', () => {
    const r = resolveTargets({ chest: { min: 12, max: 18 }, core: { min: 0, max: 0 }, legs: { min: 20, max: 10 } });
    expect(r.chest).toEqual({ min: 12, max: 18 });
    expect(r.core).toEqual({ min: 0, max: 0 });
    expect(r.legs).toEqual(DEFAULT_SET_TARGETS.legs);
    expect(isValidTarget({ min: 5, max: 50 })).toBe(false);
    expect(isValidTarget({ min: 2.5, max: 10 })).toBe(false);
  });

  it('組數只算正式組，依動作的部位', () => {
    const ex: Record<string, Partial<Exercise>> = { squat: { bodyPart: 'legs' }, bench: { bodyPart: 'chest' } };
    const s: WorkoutSession = {
      id: 'a',
      date: '2026-10-20',
      createdAt: 1,
      updatedAt: 1,
      exercises: [
        { exerciseId: 'squat', sets: [{ weight: 60, reps: 5, isWarmup: true }, { weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
        { exerciseId: 'bench', sets: [{ weight: 80, reps: 5 }] },
        { exerciseId: 'gone', sets: [{ weight: 1, reps: 1 }] },
      ],
    };
    const sets = setsByBodyPart([s], (id) => ex[id] as Exercise | undefined);
    expect(sets).toMatchObject({ legs: 2, chest: 1, back: 0 });
  });
});
