/** 日期工具：一律使用本地時區的 'YYYY-MM-DD' 字串 */

/** 今天的本地日期字串 */
export function todayString(): string {
  return toDateString(new Date());
}

/** Date → 'YYYY-MM-DD'（本地時區） */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 'YYYY-MM-DD' → 「10月20日 週二」 */
export function formatDateLabel(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return dateString;
  const date = new Date(y, m - 1, d);
  return `${m}月${d}日 週${WEEKDAYS[date.getDay()] ?? ''}`;
}

/** 指定日期所在週的週一（'YYYY-MM-DD'） */
export function startOfWeek(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 週一 = 0
  return toDateString(d);
}

/** 'YYYY-MM-DD' 加減天數 */
export function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  return toDateString(date);
}
