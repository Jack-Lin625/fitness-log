import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from './defaultExercises';
import { GUIDES, hasGuide, type ExerciseGuide } from './exerciseGuides';
import { ARMS_GUIDES } from './guides/arms';
import { BACK_GUIDES } from './guides/back';
import { CHEST_GUIDES } from './guides/chest';
import { CORE_GUIDES } from './guides/core';
import { LEGS_GUIDES } from './guides/legs';
import { SHOULDERS_GUIDES } from './guides/shoulders';

const PARTS = { chest: CHEST_GUIDES, back: BACK_GUIDES, legs: LEGS_GUIDES, shoulders: SHOULDERS_GUIDES, arms: ARMS_GUIDES, core: CORE_GUIDES };

describe('動作教學', () => {
  it('每個內建動作都有教學', () => {
    const missing = DEFAULT_EXERCISES.filter((e) => !hasGuide(e.id)).map((e) => `${e.id}（${e.name}）`);
    expect(missing).toEqual([]);
  });

  it('沒有對應不到動作的教學（id 打錯會在這裡發現）', () => {
    const ids = new Set(DEFAULT_EXERCISES.map((e) => e.id));
    expect(Object.keys(GUIDES).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('教學放在動作所屬部位的檔案，各檔案之間沒有重複的 key', () => {
    const total = Object.values(PARTS).reduce((n, g) => n + Object.keys(g).length, 0);
    expect(total).toBe(Object.keys(GUIDES).length);
    for (const e of DEFAULT_EXERCISES) {
      expect(Object.keys(PARTS[e.bodyPart]), `${e.name} 應放在 ${e.bodyPart}`).toContain(e.id);
    }
  });

  it.each(Object.entries(GUIDES))('%s 的內容完整', (_, g: ExerciseGuide) => {
    for (const list of [g.setup, g.steps, g.cues, g.safety]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((s) => s.trim().length > 0)).toBe(true);
      expect(new Set(list).size).toBe(list.length); // 同一段落沒有重複的句子
    }
    expect(g.mistakes.length).toBeGreaterThan(0);
    expect(g.mistakes.every((m) => m.what.trim() && m.fix.trim())).toBe(true);
    expect(g.breathing.trim().length).toBeGreaterThan(0);
  });

  it('內建物件的屬性名稱不會被當成有教學', () => {
    expect(hasGuide('toString')).toBe(false);
    expect(hasGuide('constructor')).toBe(false);
  });
});
