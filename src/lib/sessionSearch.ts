/**
 * 搜尋訓練紀錄：動作名稱、整次訓練的備註、動作備註、日期（「10月」「2026-10」）
 *
 * 用空白分開的每個詞都要找得到（「深蹲 低槓」= 有深蹲、而且備註寫了低槓）。
 * 英文不分大小寫。
 */
import type { WorkoutSession } from '../types/models';
import { formatDateLabel } from './date';

export interface SearchHit {
  session: WorkoutSession;
  /** 符合的備註（顯示在結果裡，讓人知道為什麼找到這筆），例如「深蹲：低槓，膝蓋有點痛」 */
  notes: string[];
}

const normalize = (text: string) => text.toLowerCase();

/** sessions 的順序原樣保留（通常是新到舊） */
export function searchSessions(
  sessions: WorkoutSession[],
  query: string,
  nameOf: (exerciseId: string) => string | undefined,
): SearchHit[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const session of sessions) {
    const notes: string[] = [];
    if (session.note?.trim()) notes.push(session.note.trim());
    for (const ex of session.exercises) {
      if (ex.note?.trim()) notes.push(`${nameOf(ex.exerciseId) ?? '已刪除的動作'}：${ex.note.trim()}`);
    }
    const haystack = normalize(
      [
        session.date,
        formatDateLabel(session.date),
        ...session.exercises.map((e) => nameOf(e.exerciseId) ?? ''),
        ...notes,
      ].join('\n'),
    );
    if (!terms.every((t) => haystack.includes(t))) continue;
    hits.push({ session, notes: notes.filter((n) => terms.some((t) => normalize(n).includes(t))) });
  }
  return hits;
}
