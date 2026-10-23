/**
 * 菜單輪替：依每份範本「上次練的日期」，建議今天練哪一份
 *
 * 做法：最久沒練的範本排最前面（沒練過的最優先）。
 * 推／拉／腿這類輪替不用另外設定順序：練了推、拉之後，最久沒練的自然是腿。
 *
 * 一次訓練屬於哪份範本：
 * - 從範本開始的訓練會記下 templateId（新功能之後的紀錄）
 * - 之前的紀錄用動作重疊的比例推斷（和範本的動作有一半以上相同才算）
 */
import type { WorkoutSession, WorkoutTemplate } from '../types/models';

/** 動作重疊的比例（Jaccard：交集 ÷ 聯集） */
export function overlap(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

/** 推斷時，動作重疊至少要這麼多才算是同一份菜單 */
export const MATCH_THRESHOLD = 0.5;

/** 這次訓練屬於哪份範本；都不像就回傳 null */
export function templateOf(session: WorkoutSession, templates: WorkoutTemplate[]): string | null {
  if (session.templateId && templates.some((t) => t.id === session.templateId)) return session.templateId;
  const ids = session.exercises.map((e) => e.exerciseId);
  let best: string | null = null;
  let bestScore = MATCH_THRESHOLD - 1e-9;
  for (const t of templates) {
    const score = overlap(
      ids,
      t.exercises.map((e) => e.exerciseId),
    );
    if (score > bestScore) [best, bestScore] = [t.id, score];
  }
  return best;
}

export interface RotationItem {
  template: WorkoutTemplate;
  /** 上次練這份菜單的日期；沒練過為 null */
  lastDate: string | null;
}

/**
 * 依輪替順序排好的範本：沒練過的在前（依名稱），其餘依上次練的日期由舊到新。
 * sessions 需為新到舊（repo.getSessions() 的順序）。
 */
export function rotation(templates: WorkoutTemplate[], sessions: WorkoutSession[]): RotationItem[] {
  const last = new Map<string, string>();
  for (const s of sessions) {
    if (last.size === templates.length) break;
    const id = templateOf(s, templates);
    if (id && !last.has(id)) last.set(id, s.date);
  }
  return templates
    .map((template) => ({ template, lastDate: last.get(template.id) ?? null }))
    .sort((a, b) => {
      if (a.lastDate === null || b.lastDate === null) {
        if (a.lastDate === b.lastDate) return a.template.name.localeCompare(b.template.name, 'zh-Hant');
        return a.lastDate === null ? -1 : 1;
      }
      return a.lastDate.localeCompare(b.lastDate);
    });
}
