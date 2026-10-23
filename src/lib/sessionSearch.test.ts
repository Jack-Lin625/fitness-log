import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../types/models';
import { searchSessions } from './sessionSearch';

const NAMES: Record<string, string> = { squat: '深蹲', 'bench-press': '槓鈴臥推', 'lat-pulldown': '滑輪下拉 Lat Pulldown' };
const nameOf = (id: string) => NAMES[id];

const session = (id: string, date: string, exercises: [string, string?][], note?: string): WorkoutSession => ({
  id,
  date,
  createdAt: 1,
  updatedAt: 1,
  ...(note ? { note } : {}),
  exercises: exercises.map(([exerciseId, n]) => ({ exerciseId, sets: [{ weight: 50, reps: 5 }], ...(n ? { note: n } : {}) })),
});

const sessions = [
  session('c', '2026-10-20', [['squat', '低槓，膝蓋有點痛'], ['bench-press']]),
  session('b', '2026-10-13', [['squat', '高槓'], ['lat-pulldown']], '肩膀痛，提早結束'),
  session('a', '2026-09-30', [['bench-press']]),
];
const ids = (q: string) => searchSessions(sessions, q, nameOf).map((h) => h.session.id);

describe('searchSessions', () => {
  it('依動作名稱找，順序不變', () => {
    expect(ids('深蹲')).toEqual(['c', 'b']);
    expect(ids('臥推')).toEqual(['c', 'a']);
  });

  it('依備註找（整次的和動作的），結果附上符合的備註', () => {
    expect(ids('痛')).toEqual(['c', 'b']);
    const [hit] = searchSessions(sessions, '低槓', nameOf);
    expect(hit?.notes).toEqual(['深蹲：低槓，膝蓋有點痛']);
    expect(searchSessions(sessions, '肩膀', nameOf)[0]?.notes).toEqual(['肩膀痛，提早結束']);
  });

  it('每個詞都要符合；英文不分大小寫', () => {
    expect(ids('深蹲 低槓')).toEqual(['c']);
    expect(ids('深蹲 臥推')).toEqual(['c']);
    expect(ids('lat pulldown')).toEqual(['b']);
  });

  it('依日期找', () => {
    expect(ids('9月')).toEqual(['a']);
    expect(ids('2026-10')).toEqual(['c', 'b']);
  });

  it('空白查詢回傳空陣列；找不到也是空陣列', () => {
    expect(ids('  ')).toEqual([]);
    expect(ids('硬舉')).toEqual([]);
  });
});
