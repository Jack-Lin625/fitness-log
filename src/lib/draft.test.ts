import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftSet, WorkoutDraft, WorkoutSession } from '../types/models';
import { draftFromSession, draftToSession, emptyDraftSet, formatSetShort } from './draft';

const set = (weight: string, reps: string, extra: Partial<DraftSet> = {}): DraftSet => ({
  weight,
  reps,
  rpe: '',
  isWarmup: false,
  completed: false,
  ...extra,
});

const draft = (sets: DraftSet[][], extra: Partial<WorkoutDraft> = {}): WorkoutDraft => ({
  id: 'd1',
  date: '2026-10-20',
  note: '',
  startedAt: 0,
  exercises: sets.map((s, i) => ({ key: `k${i}`, exerciseId: `ex${i}`, sets: s })),
  ...extra,
});

describe('draftToSession', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 18, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('次數必須大於 0；只填重量沒填次數的組會被略過並計數', () => {
    const { session, skippedSets } = draftToSession(draft([[set('80', '5'), set('80', ''), set('', ''), set('80', '0')]]));
    expect(session?.exercises[0]?.sets).toEqual([{ weight: 80, reps: 5 }]);
    expect(skippedSets).toBe(2);
  });

  it('重量空白視為 0、RPE 超出 1–10 忽略、熱身組保留標記', () => {
    const { session } = draftToSession(
      draft([[set('', '10'), set('60', '5', { rpe: '8.5' }), set('60', '5', { rpe: '12' }), set('40', '5', { isWarmup: true })]]),
    );
    expect(session?.exercises[0]?.sets).toEqual([
      { weight: 0, reps: 10 },
      { weight: 60, reps: 5, rpe: 8.5 },
      { weight: 60, reps: 5 },
      { weight: 40, reps: 5, isWarmup: true },
    ]);
  });

  it('沒有有效組數的動作移除；全部都沒有時不能儲存', () => {
    expect(draftToSession(draft([[set('80', '5')], [set('', '')]])).session?.exercises).toHaveLength(1);
    expect(draftToSession(draft([[set('80', '')]])).session).toBeNull();
  });

  it('備註去掉前後空白，空白備註不存', () => {
    expect(draftToSession(draft([[set('80', '5')]], { note: '  好累  ' })).session?.note).toBe('好累');
    expect(draftToSession(draft([[set('80', '5')]], { note: '   ' })).session).not.toHaveProperty('note');
  });

  it('修改既有紀錄時沿用原本的 id 與建立時間', () => {
    const existing: WorkoutSession = { id: 's9', date: '2026-10-01', exercises: [], createdAt: 123, updatedAt: 123 };
    const { session } = draftToSession(draft([[set('80', '5')]], { editingSessionId: 's9' }), existing);
    expect(session).toMatchObject({ id: 's9', createdAt: 123, updatedAt: Date.now() });
  });
});

describe('draftFromSession', () => {
  const source: WorkoutSession = {
    id: 's1',
    date: '2026-10-01',
    note: '上次的備註',
    createdAt: 1,
    updatedAt: 1,
    exercises: [{ exerciseId: 'squat', sets: [{ weight: 82.5, reps: 5, rpe: 8 }, { weight: 40, reps: 8, isWarmup: true }] }],
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 18, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('當範本：日期改成今天、清掉 RPE 與備註、組數未完成', () => {
    const d = draftFromSession(source, 'template');
    expect(d).toMatchObject({ date: '2026-10-20', note: '' });
    expect(d.id).not.toBe('s1');
    expect(d).not.toHaveProperty('editingSessionId');
    expect(d.exercises[0]?.sets).toEqual([set('82.5', '5'), set('40', '8', { isWarmup: true })]);
  });

  it('修改：保留日期、RPE、備註，組數視為已完成', () => {
    const d = draftFromSession(source, 'edit');
    expect(d).toMatchObject({ id: 's1', date: '2026-10-01', note: '上次的備註', editingSessionId: 's1' });
    expect(d.exercises[0]?.sets[0]).toEqual(set('82.5', '5', { rpe: '8', completed: true }));
  });

  it('來回轉換後內容不變', () => {
    const { session } = draftToSession(draftFromSession(source, 'edit'), source);
    expect(session?.exercises).toEqual(source.exercises);
  });
});

describe('emptyDraftSet / formatSetShort', () => {
  it('新的一組沿用上一組的重量與次數，但不沿用 RPE 與完成狀態', () => {
    expect(emptyDraftSet(set('80', '5', { rpe: '9', completed: true, isWarmup: true }))).toEqual(set('80', '5'));
  });

  it('依動作類型顯示一組', () => {
    expect(formatSetShort({ weight: 80, reps: 5 }, false)).toBe('80×5');
    expect(formatSetShort({ weight: 10, reps: 8 }, true)).toBe('+10×8');
    expect(formatSetShort({ weight: 0, reps: 12 }, true)).toBe('×12');
    expect(formatSetShort({ weight: 20, reps: 8 }, true, true)).toBe('×8（輔助 20）');
  });
});
