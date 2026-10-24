import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { GUIDES } from '../data/exerciseGuides';
import { buildMessages, describeExercise, getApiKey, looksLikeApiKey, maskApiKey, setApiKey, suggestedQuestions } from './aiCoach';
import { exerciseHistory } from './exerciseHistory';
import { installMemoryStorage } from '../test/memoryStorage';

installMemoryStorage();

const bench = DEFAULT_EXERCISES.find((e) => e.id === 'bench-press')!;
const normal = { bodyweight: false, assisted: false };

describe('describeExercise', () => {
  it('包含動作、肌群、教學與最近紀錄（含備註、熱身組）', () => {
    const history = exerciseHistory(
      [
        {
          id: 'a',
          date: '2026-10-20',
          createdAt: 1,
          updatedAt: 1,
          exercises: [{ exerciseId: 'bench-press', note: '肩膀有點酸', sets: [{ weight: 40, reps: 10, isWarmup: true }, { weight: 70, reps: 5 }] }],
        },
      ],
      'bench-press',
      normal,
    );
    const text = describeExercise({ exercise: bench, guide: GUIDES['bench-press'], history, traits: normal, unit: 'kg' });
    expect(text).toContain('動作：臥推');
    expect(text).toContain('輔助肌群：');
    expect(text).toContain('【App 裡的教學】');
    expect(text).toContain('2026-10-20：熱身 40×10、70×5（備註：肩膀有點酸）');
  });

  it('沒有紀錄時說明還沒做過', () => {
    const text = describeExercise({ exercise: bench, guide: undefined, history: [], traits: normal, unit: 'kg' });
    expect(text).toContain('還沒有紀錄。');
    expect(text).not.toContain('【App 裡的教學】');
  });
});

describe('buildMessages', () => {
  it('動作資料只放在第一個問題前面', () => {
    const msgs = buildMessages('CTX', [
      { role: 'user', text: '肩膀酸' },
      { role: 'assistant', text: '握距收窄' },
      { role: 'user', text: '還是酸' },
    ]);
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(msgs[0]!.content).toBe('CTX\n\n【問題】\n肩膀酸');
    expect(msgs[2]!.content).toBe('還是酸');
  });
});

describe('API 金鑰', () => {
  beforeEach(() => setApiKey(''));

  it('存在這台裝置，清空就刪除', () => {
    expect(getApiKey()).toBe('');
    setApiKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
    expect(getApiKey()).toBe('sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
    setApiKey('');
    expect(getApiKey()).toBe('');
  });

  it('檢查格式並遮住中間', () => {
    expect(looksLikeApiKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(looksLikeApiKey('hello')).toBe(false);
    expect(maskApiKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe('sk-ant-api…wxyz');
  });
});

describe('suggestedQuestions', () => {
  it('依肌群產生，例如臥推問三頭、前三角比胸先酸', () => {
    const [first] = suggestedQuestions(bench);
    expect(first).toContain('三頭');
    expect(first).toContain('沒什麼感覺');
  });
});
