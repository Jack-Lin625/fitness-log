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
      {
        key: 'k1',
        exerciseId: 'squat',
        note: '座椅 4 格',
        supersetId: 'ss',
        sets: [{ key: 's1', weight: '80', reps: '5', rpe: '', isWarmup: false, completed: true }],
      },
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
    // 舊版草稿的組沒有 key，補上一個
    expect(draft?.exercises[0]?.sets[0]).toEqual({
      key: expect.any(String),
      weight: '60',
      reps: '',
      rpe: '',
      isWarmup: false,
      completed: false,
    });
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

describe('migrate：飲食（v4）', () => {
  it('v3 資料升級後有空的飲食欄位', () => {
    const data = migrate({ version: 3, customExercises: [], sessions: [], bodyMetrics: [], settings: {}, activeDraft: null });
    expect(data.version).toBe(CURRENT_DATA_VERSION);
    expect(data.nutritionProfile).toBeNull();
    expect(data.foodEntries).toEqual([]);
  });

  it('TDEE 個人資料：正確的保留，任何一項不合理就當作沒設定', () => {
    const good = { sex: 'female', birthYear: 1995, heightCm: 162, activity: 'light', goal: 'cut' };
    expect(migrate({ ...base, nutritionProfile: good }).nutritionProfile).toEqual(good);
    for (const bad of [{ ...good, sex: 'x' }, { ...good, heightCm: 20 }, { ...good, birthYear: '1995' }, { ...good, goal: 'bulking' }, 'x']) {
      expect(migrate({ ...base, nutritionProfile: bad }).nutritionProfile).toBeNull();
    }
  });

  it('飲食紀錄：無效的略過，未知餐別改為點心，營養素只留有效數字', () => {
    const { foodEntries } = migrate({
      ...base,
      foodEntries: [
        { id: 'a', date: '2026-10-20', meal: 'lunch', name: '雞胸便當', kcal: 650, protein: 45, carbs: 'x', fat: -1, photoId: 'p1', createdAt: 5 },
        { id: 'b', date: '2026-10-20', meal: 'brunch', name: '蛋餅', kcal: 300 },
        { id: 'c', date: '2026-10-20', name: '沒有熱量' },
        { id: 'd', date: 'bad', name: '日期錯誤', kcal: 100 },
        { id: 'e', date: '2026-10-20', name: '負熱量', kcal: -5 },
      ],
    });
    expect(foodEntries).toEqual([
      { id: 'a', date: '2026-10-20', meal: 'lunch', name: '雞胸便當', kcal: 650, protein: 45, photoId: 'p1', createdAt: 5 },
      { id: 'b', date: '2026-10-20', meal: 'snack', name: '蛋餅', kcal: 300, createdAt: 0 },
    ]);
  });
});

describe('migrate：v5（範本、常吃的食物、動作備註、超級組、時長、單位）', () => {
  it('v4 資料升級後有空的範本與常吃的食物', () => {
    const data = migrate({ ...base, version: 4, activeDraft: null, nutritionProfile: null, foodEntries: [] });
    expect(data.version).toBe(5);
    expect(data.templates).toEqual([]);
    expect(data.foodFavorites).toEqual([]);
  });

  it('訓練：保留有效的動作備註、超級組與時長，無效的捨棄', () => {
    const [s] = migrate({
      ...base,
      sessions: [
        {
          id: 'a',
          date: '2026-10-01',
          durationSec: 3000,
          exercises: [
            { exerciseId: 'squat', note: '低槓', supersetId: 'x', sets: [{ weight: 100, reps: 5 }] },
            { exerciseId: 'bench-press', note: 5, supersetId: '', sets: [{ weight: 60, reps: 5 }] },
          ],
        },
      ],
    }).sessions;
    expect(s?.durationSec).toBe(3000);
    expect(s?.exercises[0]).toMatchObject({ note: '低槓', supersetId: 'x' });
    expect(s?.exercises[1]).toEqual({ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 5 }] });
    expect(migrate({ ...base, sessions: [{ ...s, durationSec: -1 }] }).sessions[0]).not.toHaveProperty('durationSec');
  });

  it('範本：結構錯誤或沒有動作的捨棄', () => {
    const ok = { id: 't1', name: '腿日', createdAt: 1, exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }] };
    const { templates } = migrate({
      ...base,
      templates: [ok, { id: 't2', name: '空的', exercises: [] }, { id: 't3', exercises: [] }, { ...ok, id: 't4', exercises: [{ sets: [] }] }],
    });
    expect(templates.map((t) => t.id)).toEqual(['t1']);
  });

  it('常吃的食物：名稱、熱量必須有效', () => {
    const { foodFavorites } = migrate({
      ...base,
      foodFavorites: [
        { id: 'f1', name: '雞胸', kcal: 165, protein: 31, fat: 'x' },
        { id: 'f2', name: '', kcal: 100 },
        { id: 'f3', name: '負的', kcal: -5 },
      ],
    });
    expect(foodFavorites).toEqual([{ id: 'f1', name: '雞胸', kcal: 165, protein: 31 }]);
  });

  it('設定：單位與個別休息時間只留有效值', () => {
    const { settings } = migrate({
      ...base,
      settings: { weightUnit: 'lb', restByExercise: { squat: 180, curl: -1, row: 'x' } },
    });
    expect(settings.weightUnit).toBe('lb');
    expect(settings.restByExercise).toEqual({ squat: 180 });
    expect(migrate({ ...base, settings: { weightUnit: 'stone' } }).settings).not.toHaveProperty('weightUnit');
  });
});
