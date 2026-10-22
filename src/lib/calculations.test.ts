/**
 * 小型計算函式：日期、數字輸入、移動平均、熱身組、訓練容量
 */
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../types/models';
import { addDays, formatDateLabel, startOfWeek } from './date';
import { movingAverage } from './movingAverage';
import { formatDuration, formatNumber, parseNumber, sanitizeDecimalInput, sanitizeIntInput } from './number';
import { sessionVolume, volumeBetween } from './volume';
import { plateText, warmupConfig, warmupLadder } from './warmupSets';

describe('日期', () => {
  it('週一為一週的開始', () => {
    expect(startOfWeek(new Date(2026, 9, 22))).toBe('2026-10-19'); // 週四
    expect(startOfWeek(new Date(2026, 9, 25))).toBe('2026-10-19'); // 週日
    expect(startOfWeek(new Date(2026, 9, 19))).toBe('2026-10-19'); // 週一
  });

  it('加減天數可以跨月、跨年', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('顯示用日期', () => {
    expect(formatDateLabel('2026-10-20')).toBe('10月20日 週二');
    expect(formatDateLabel('壞掉')).toBe('壞掉');
  });
});

describe('數字輸入', () => {
  it('小數：中文逗號、句號當小數點，只留一個小數點，最多 6 個字', () => {
    expect(sanitizeDecimalInput('82，5')).toBe('82.5');
    expect(sanitizeDecimalInput('82。5')).toBe('82.5');
    expect(sanitizeDecimalInput('1.2.3')).toBe('1.23');
    expect(sanitizeDecimalInput('abc12')).toBe('12');
    expect(sanitizeDecimalInput('1234567')).toBe('123456');
  });

  it('整數：只留數字，最多三位', () => {
    expect(sanitizeIntInput('1a2')).toBe('12');
    expect(sanitizeIntInput('1234')).toBe('123');
  });

  it('解析：空白回傳 null，輸入到一半的「82.」也能解析', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('82.')).toBe(82);
    expect(parseNumber('.5')).toBe(0.5);
  });

  it('顯示：最多兩位小數，秒數轉分:秒', () => {
    expect(formatNumber(80)).toBe('80');
    expect(formatNumber(82.5)).toBe('82.5');
    expect(formatNumber(1 / 3)).toBe('0.33');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('movingAverage', () => {
  it('以日期為窗口：超過 7 天的舊資料不納入', () => {
    const avg = movingAverage([
      { date: '2026-10-01', value: 70 },
      { date: '2026-10-02', value: 72 },
      { date: '2026-10-09', value: 74 },
    ]);
    expect(avg.map((p) => p.value)).toEqual([70, 71, 74]);
  });

  it('跨月份也正確計算天數', () => {
    const avg = movingAverage([
      { date: '2026-09-28', value: 60 },
      { date: '2026-10-03', value: 62 },
    ]);
    expect(avg[1]?.value).toBe(61);
  });
});

describe('熱身組', () => {
  it('槓鈴：空槓 × 10 → 40% × 5 → 60% × 3 → 80% × 2', () => {
    expect(warmupLadder(100, 2.5, 20)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 80, reps: 2 },
    ]);
  });

  it('太接近前一組或正式組的熱身組略過', () => {
    expect(warmupLadder(30, 2.5, 20)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 2 },
    ]);
  });

  it('正式組就是空槓時不需要熱身組', () => {
    expect(warmupLadder(20, 2.5, 20)).toEqual([]);
    expect(warmupLadder(0, 2.5, 20)).toEqual([]);
  });

  it('啞鈴以 2 kg 為間距、沒有空槓', () => {
    expect(warmupConfig('dumbbell', 20)).toEqual({ step: 2, bar: 0 });
    expect(warmupLadder(30, 2, 0)).toEqual([
      { weight: 12, reps: 5 },
      { weight: 18, reps: 3 },
      { weight: 24, reps: 2 },
    ]);
  });

  it('徒手動作不提供熱身組', () => {
    expect(warmupConfig('bodyweight', 20)).toBeNull();
    expect(warmupConfig('pullup-bar', 20)).toBeNull();
  });

  it('槓片提示文字', () => {
    const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
    expect(plateText(60, 20, plates)).toBe('每邊 20');
    expect(plateText(20, 20, plates)).toBe('空槓');
    expect(plateText(61, 20, plates)).toBe('每邊 20（差 1）');
    expect(plateText(60, 0, plates)).toBeNull();
  });
});

describe('訓練容量', () => {
  const s = (id: string, date: string, exerciseId: string, weight: number, isWarmup = false): WorkoutSession => ({
    id,
    date,
    createdAt: 0,
    updatedAt: 0,
    exercises: [{ exerciseId, sets: [{ weight, reps: 10, ...(isWarmup ? { isWarmup } : {}) }] }],
  });
  const isAssisted = (id: string) => id === 'assisted-pull-up';

  it('重量 × 次數加總；熱身組與輔助機器不計', () => {
    const session: WorkoutSession = {
      ...s('a', '2026-10-01', 'squat', 100),
      exercises: [
        { exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }, { weight: 60, reps: 5, isWarmup: true }] },
        { exerciseId: 'assisted-pull-up', sets: [{ weight: 30, reps: 8 }] },
      ],
    };
    expect(sessionVolume(session, isAssisted)).toBe(500);
  });

  it('日期區間包含開始、不包含結束', () => {
    const sessions = [s('a', '2026-10-19', 'squat', 10), s('b', '2026-10-25', 'squat', 20), s('c', '2026-10-26', 'squat', 40)];
    expect(volumeBetween(sessions, '2026-10-19', '2026-10-26')).toBe(300);
  });
});
