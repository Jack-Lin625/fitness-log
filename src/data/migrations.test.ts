import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_VERSION } from '../types/models';
import { DEFAULT_SETTINGS, migrate } from './migrations';

const base = { version: CURRENT_DATA_VERSION, customExercises: [], sessions: [], bodyMetrics: [], settings: {} };

describe('migrate：版本', () => {
  it('沒有版本號的資料拒絕匯入', () => {
    expect(() => migrate({ sessions: [] })).toThrow('缺少版本號');
    expect(() => migrate('garbage')).toThrow('缺少版本號');
  });

  it('比 App 新的版本拒絕匯入', () => {
    expect(() => migrate({ ...base, version: CURRENT_DATA_VERSION + 1 })).toThrow('請先更新 App');
  });

  it('v1 資料自動升級到目前版本', () => {
    const data = migrate({ version: 1, customExercises: [], sessions: [], bodyMetrics: [], settings: {} });
    expect(data.version).toBe(CURRENT_DATA_VERSION);
    expect(data.activeDraft).toBeNull();
  });
});

describe('migrate：訓練紀錄', () => {
  it('結構錯誤的訓練略過，缺 createdAt 的補 0', () => {
    const data = migrate({
      ...base,
      sessions: [
        { id: 'ok', date: '2026-10-01', exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }] },
        { id: 'bad-date', date: '10/01', exercises: [] },
        { id: 'bad-set', date: '2026-10-01', exercises: [{ exerciseId: 'squat', sets: [{ weight: '100', reps: 5 }] }] },
      ],
    });
    expect(data.sessions.map((s) => s.id)).toEqual(['ok']);
    expect(data.sessions[0]).toMatchObject({ createdAt: 0, updatedAt: 0 });
  });
});

describe('migrate：進行中的草稿', () => {
  const good = {
    id: 'd1',
    date: '2026-10-22',
    note: 'hi',
    startedAt: 5,
    editingSessionId: 's9',
    exercises: [
      { key: 'k1', exerciseId: 'squat', sets: [{ weight: '80', reps: '5', rpe: '', isWarmup: false, completed: true }] },
    ],
  };

  it('正常的草稿完整保留', () => {
    expect(migrate({ ...base, activeDraft: good }).activeDraft).toEqual(good);
  });

  it('缺少的欄位補上預設值', () => {
    const draft = migrate({
      ...base,
      activeDraft: { id: 'd2', date: '2026-10-22', exercises: [{ key: 'k', exerciseId: 'bench-press', sets: [{ weight: '60' }] }] },
    }).activeDraft;
    expect(draft).toMatchObject({ id: 'd2', note: '' });
    expect(draft?.exercises[0]?.sets[0]).toEqual({ weight: '60', reps: '', rpe: '', isWarmup: false, completed: false });
    expect(typeof draft?.startedAt).toBe('number');
    expect(draft).not.toHaveProperty('editingSessionId');
  });

  it.each([
    ['沒有 exercises', { id: 'x', date: '2026-10-22' }],
    ['日期格式錯誤', { id: 'x', date: 'bad', exercises: [] }],
    ['動作缺 key', { id: 'x', date: '2026-10-22', exercises: [{ exerciseId: 'a', sets: [] }] }],
    ['sets 不是陣列', { id: 'x', date: '2026-10-22', exercises: [{ key: 'k', exerciseId: 'a', sets: 'oops' }] }],
    ['不是物件', 'garbage'],
  ])('結構錯誤的草稿捨棄：%s', (_, activeDraft) => {
    expect(migrate({ ...base, activeDraft }).activeDraft).toBeNull();
  });
});

describe('migrate：設定、自訂動作、體態的型別檢查', () => {
  it('設定：型別錯的換成預設值，正確的保留', () => {
    const { settings } = migrate({
      ...base,
      settings: {
        defaultRestSeconds: 'abc',
        barWeight: 15,
        availablePlates: null,
        timerSound: 'yes',
        timerVibrate: false,
        stretchSeconds: -5,
        stretchRoller: true,
        lastBackupAt: 123,
      },
    });
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      barWeight: 15,
      timerVibrate: false,
      stretchRoller: true,
      lastBackupAt: 123,
    });
  });

  it('設定：槓片清單只留正數，全部無效時用預設', () => {
    expect(migrate({ ...base, settings: { availablePlates: [20, 'x', -5, 10] } }).settings.availablePlates).toEqual([20, 10]);
    expect(migrate({ ...base, settings: { availablePlates: ['x'] } }).settings.availablePlates).toEqual(DEFAULT_SETTINGS.availablePlates);
  });

  it('自訂動作：未知器材改為「其他」，未知肌群移除，沒有肌群時用部位預設', () => {
    const [a, b] = migrate({
      ...base,
      customExercises: [
        { id: 'c1', name: '未來的動作', bodyPart: 'legs', equipment: 'future-machine', primaryMuscles: ['quads', 'tail'], secondaryMuscles: 'x' },
        { id: 'c2', name: '舊版動作', bodyPart: 'back' },
      ],
    }).customExercises;
    expect(a).toMatchObject({ equipment: 'other', primaryMuscles: ['quads'], secondaryMuscles: [], isCustom: true });
    expect(b).toMatchObject({ equipment: 'other', primaryMuscles: ['lats', 'upperBack'], isBodyweight: false });
  });

  it('體態：只保留有效的數字', () => {
    const [m] = migrate({
      ...base,
      bodyMetrics: [{ id: 'm1', date: '2026-10-01', weight: 70.5, bodyFat: 'abc', waist: null, arm: 35, extra: 1 }],
    }).bodyMetrics;
    expect(m).toEqual({ id: 'm1', date: '2026-10-01', weight: 70.5, arm: 35 });
  });
});
