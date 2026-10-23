import { describe, expect, it } from 'vitest';
import type { WorkoutSession, WorkoutTemplate } from '../types/models';
import { overlap, rotation, templateOf } from './rotation';

const tpl = (id: string, name: string, exercises: string[]): WorkoutTemplate => ({
  id,
  name,
  createdAt: 0,
  exercises: exercises.map((exerciseId) => ({ exerciseId, sets: [{ weight: 50, reps: 8 }] })),
});
const session = (id: string, date: string, exercises: string[], templateId?: string): WorkoutSession => ({
  id,
  date,
  createdAt: 0,
  updatedAt: 0,
  ...(templateId ? { templateId } : {}),
  exercises: exercises.map((exerciseId) => ({ exerciseId, sets: [{ weight: 50, reps: 8 }] })),
});

const push = tpl('push', '推', ['bench-press', 'overhead-press', 'triceps-pushdown', 'lateral-raise']);
const pull = tpl('pull', '拉', ['pull-up', 'barbell-row', 'db-curl', 'face-pull']);
const legs = tpl('legs', '腿', ['squat', 'romanian-deadlift', 'leg-press', 'calf-raise']);

describe('templateOf', () => {
  it('有記下範本就用記下的', () => {
    expect(templateOf(session('a', '2026-10-01', ['squat'], 'push'), [push, pull, legs])).toBe('push');
  });

  it('舊紀錄用動作重疊推斷；少了一兩個動作也認得出來', () => {
    expect(templateOf(session('a', '2026-10-01', ['bench-press', 'overhead-press', 'triceps-pushdown']), [push, pull, legs])).toBe('push');
    expect(templateOf(session('a', '2026-10-01', ['squat', 'leg-press', 'leg-extension', 'calf-raise']), [push, pull, legs])).toBe('legs');
  });

  it('都不像（重疊不到一半）就不算', () => {
    expect(templateOf(session('a', '2026-10-01', ['squat', 'bench-press', 'pull-up', 'plank']), [push, pull, legs])).toBeNull();
    expect(overlap(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
  });

  it('記下的範本已被刪除時改用推斷', () => {
    expect(templateOf(session('a', '2026-10-01', ['pull-up', 'barbell-row', 'db-curl'], 'gone'), [push, pull, legs])).toBe('pull');
  });
});

describe('rotation（最久沒練的排最前面）', () => {
  it('推、拉之後輪到腿', () => {
    const sessions = [
      session('3', '2026-10-22', ['pull-up', 'barbell-row', 'db-curl', 'face-pull'], 'pull'),
      session('2', '2026-10-20', ['bench-press', 'overhead-press', 'triceps-pushdown', 'lateral-raise'], 'push'),
      session('1', '2026-10-17', ['squat', 'romanian-deadlift', 'leg-press', 'calf-raise'], 'legs'),
    ];
    expect(rotation([push, pull, legs], sessions).map((r) => [r.template.id, r.lastDate])).toEqual([
      ['legs', '2026-10-17'],
      ['push', '2026-10-20'],
      ['pull', '2026-10-22'],
    ]);
  });

  it('沒練過的範本最優先（多個時依名稱）', () => {
    const sessions = [session('1', '2026-10-20', ['bench-press', 'overhead-press'], 'push')];
    // 繁體中文依筆畫排序：拉（8 畫）在腿（14 畫）前面
    expect(rotation([push, pull, legs], sessions).map((r) => r.template.id)).toEqual(['pull', 'legs', 'push']);
  });

  it('只看每份範本最近的一次', () => {
    const sessions = [
      session('3', '2026-10-22', [], 'push'),
      session('2', '2026-10-21', [], 'pull'),
      session('1', '2026-10-01', [], 'pull'),
    ];
    expect(rotation([push, pull], sessions).map((r) => [r.template.id, r.lastDate])).toEqual([
      ['pull', '2026-10-21'],
      ['push', '2026-10-22'],
    ]);
  });
});
