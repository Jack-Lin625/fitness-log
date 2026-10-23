import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftSet, WorkoutDraft, WorkoutSession } from '../types/models';
import type { WorkoutTemplate } from '../types/models';
import {
  convertDraftUnit,
  draftFromSession,
  draftFromTemplate,
  draftToSession,
  emptyDraftSet,
  formatSessionDuration,
  formatSetShort,
  supersetGroups,
  templateFromSession,
} from './draft';

/** key 是隨機產生的，比對時任何字串都可以 */
const anyKey = expect.any(String) as unknown as string;

const set = (weight: string, reps: string, extra: Partial<DraftSet> = {}): DraftSet => ({
  key: anyKey,
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

describe('訓練時長', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 18, 0));
  });
  afterEach(() => vi.useRealTimers());

  const startedMinutesAgo = (min: number) => Date.now() - min * 60_000;

  it('新的訓練記下開始到完成的秒數', () => {
    const { session } = draftToSession(draft([[set('80', '5')]], { startedAt: startedMinutesAgo(52) }));
    expect(session?.durationSec).toBe(52 * 60);
  });

  it('太短（補登）、太長（忘了按完成）或日期不是今天都不記', () => {
    expect(draftToSession(draft([[set('80', '5')]], { startedAt: Date.now() - 20_000 })).session).not.toHaveProperty('durationSec');
    expect(draftToSession(draft([[set('80', '5')]], { startedAt: startedMinutesAgo(6 * 60) })).session).not.toHaveProperty('durationSec');
    expect(
      draftToSession(draft([[set('80', '5')]], { date: '2026-10-19', startedAt: startedMinutesAgo(50) })).session,
    ).not.toHaveProperty('durationSec');
  });

  it('修改紀錄時沿用原本的時長', () => {
    const existing: WorkoutSession = { id: 's9', date: '2026-10-01', exercises: [], createdAt: 1, updatedAt: 1, durationSec: 3000 };
    const { session } = draftToSession(draft([[set('80', '5')]], { editingSessionId: 's9', startedAt: startedMinutesAgo(3) }), existing);
    expect(session?.durationSec).toBe(3000);
  });

  it('顯示文字', () => {
    expect(formatSessionDuration(52 * 60)).toBe('52 分');
    expect(formatSessionDuration(65 * 60)).toBe('1 小時 5 分');
    expect(formatSessionDuration(120 * 60)).toBe('2 小時');
  });
});

describe('動作備註與超級組', () => {
  it('草稿 → 紀錄：備註去掉空白，超級組保留', () => {
    const d = draft([[set('80', '5')], [set('20', '10')]]);
    d.exercises[0]!.note = '  座椅 4 格 ';
    d.exercises[0]!.supersetId = 'ss';
    d.exercises[1]!.supersetId = 'ss';
    d.exercises[1]!.note = '   ';
    const { session } = draftToSession(d);
    expect(session?.exercises[0]).toMatchObject({ note: '座椅 4 格', supersetId: 'ss' });
    expect(session?.exercises[1]).not.toHaveProperty('note');
  });

  it('相鄰且 id 相同的動作（至少 2 個）才算一組，依序標 A、B', () => {
    const groups = supersetGroups([
      { supersetId: 'x' },
      { supersetId: 'x' },
      {},
      { supersetId: 'y' },
      { supersetId: 'z' },
      { supersetId: 'z' },
      { supersetId: 'z' },
    ]);
    expect(groups.map((g) => g && `${g.label}${g.position + 1}/${g.size}`)).toEqual([
      'A1/2',
      'A2/2',
      null,
      null,
      'B1/3',
      'B2/3',
      'B3/3',
    ]);
  });
});

describe('磅', () => {
  it('輸入的磅換算成公斤儲存，再轉回草稿時顯示磅', () => {
    const { session } = draftToSession(draft([[set('225', '5')]]), undefined, 'lb');
    expect(session?.exercises[0]?.sets[0]?.weight).toBeCloseTo(102.058, 3);
    const back = draftFromSession(session!, 'edit', 'lb');
    expect(back.exercises[0]?.sets[0]?.weight).toBe('225');
  });

  it('簡短文字以磅顯示', () => {
    expect(formatSetShort({ weight: 102.05828325, reps: 5 }, false, false, 'lb')).toBe('225×5');
  });
});

describe('菜單範本', () => {
  const source: WorkoutSession = {
    id: 's1',
    date: '2026-10-01',
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      { exerciseId: 'squat', note: '槓位低', sets: [{ weight: 60, reps: 5, isWarmup: true }, { weight: 100, reps: 5, rpe: 8 }] },
      { exerciseId: 'new-one', sets: [{ weight: 30, reps: 10 }] },
    ],
  };

  it('存成範本時不含 RPE，保留熱身組與備註', () => {
    const t = templateFromSession(source, '腿日');
    expect(t.name).toBe('腿日');
    expect(t.exercises[0]).toEqual({
      exerciseId: 'squat',
      note: '槓位低',
      sets: [{ weight: 60, reps: 5, isWarmup: true }, { weight: 100, reps: 5 }],
    });
  });

  it('做過的動作留白（帶入上次成績），沒做過的填範本數字', () => {
    const t: WorkoutTemplate = templateFromSession(source, '腿日');
    const d = draftFromTemplate(t, (id) => id === 'squat');
    expect(d.exercises[0]?.sets.map((s) => [s.weight, s.reps, s.isWarmup])).toEqual([
      ['', '', true],
      ['', '', false],
    ]);
    expect(d.exercises[0]?.note).toBe('槓位低');
    expect(d.exercises[1]?.sets.map((s) => [s.weight, s.reps])).toEqual([['30', '10']]);
  });
});

describe('convertDraftUnit', () => {
  it('切換單位時換算已輸入的重量，空白不變', () => {
    const d = draft([[set('100', '5'), set('', '5')]]);
    const lb = convertDraftUnit(d, 'kg', 'lb');
    expect(lb.exercises[0]?.sets.map((s) => s.weight)).toEqual(['220.5', '']);
    expect(convertDraftUnit(lb, 'lb', 'kg').exercises[0]?.sets[0]?.weight).toBe('100.02');
  });
});

describe('記下從哪份範本開始', () => {
  it('從範本開始的訓練記下 templateId；修改舊紀錄時保留原本的', () => {
    const t: WorkoutTemplate = { id: 't1', name: '腿日', createdAt: 0, exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }] };
    const d = draftFromTemplate(t, () => false);
    expect(d.templateId).toBe('t1');
    const { session } = draftToSession(d);
    expect(session?.templateId).toBe('t1');

    const edited = draftToSession(draftFromSession(session!, 'edit'), session!).session;
    expect(edited?.templateId).toBe('t1');
    // 複製上次菜單（不是從範本開始）不記
    expect(draftToSession(draftFromSession(session!, 'template')).session).not.toHaveProperty('templateId');
  });
});
