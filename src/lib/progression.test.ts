import { describe, expect, it } from 'vitest';
import { suggestNext } from './progression';

const normal = { bodyweight: false, assisted: false };

describe('suggestNext（漸進超負荷建議）', () => {
  it('上次每組都做滿、不是力竭 → 加一格重量', () => {
    expect(suggestNext([{ weight: 80, reps: 5 }, { weight: 80, reps: 5 }, { weight: 80, reps: 5, rpe: 8.5 }], normal, 2.5)).toEqual({
      kind: 'increase',
      weight: 82.5,
      reps: 5,
    });
  });

  it('熱身組不看；以最重的那幾組判斷', () => {
    expect(
      suggestNext([{ weight: 40, reps: 3, isWarmup: true }, { weight: 60, reps: 8 }, { weight: 80, reps: 5 }], normal, 2.5),
    ).toMatchObject({ kind: 'increase', weight: 82.5, reps: 5 });
  });

  it('次數掉了或接近力竭 → 維持重量', () => {
    expect(suggestNext([{ weight: 80, reps: 5 }, { weight: 80, reps: 4 }], normal, 2.5)).toEqual({ kind: 'hold', weight: 80, reps: 5 });
    expect(suggestNext([{ weight: 80, reps: 5, rpe: 10 }], normal, 2.5)).toMatchObject({ kind: 'hold' });
  });

  it('徒手動作建議多做 1 下；輔助機器建議減少輔助', () => {
    expect(suggestNext([{ weight: 0, reps: 8 }, { weight: 0, reps: 8 }], { bodyweight: true, assisted: false }, 2.5)).toEqual({
      kind: 'reps',
      weight: 0,
      reps: 9,
    });
    expect(suggestNext([{ weight: 30, reps: 8 }], { bodyweight: true, assisted: true }, 5)).toEqual({
      kind: 'lessAssist',
      weight: 25,
      reps: 8,
    });
  });

  it('沒有正式組時不建議', () => {
    expect(suggestNext([{ weight: 40, reps: 5, isWarmup: true }], normal, 2.5)).toBeNull();
  });
});
