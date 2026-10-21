/** 數字輸入與顯示的工具 */

/** 只保留數字和一個小數點；中文鍵盤的「，」「,」視為小數點 */
export function sanitizeDecimalInput(value: string): string {
  let s = value.replace(/[，,。]/g, '.').replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  return s.slice(0, 6);
}

/** 只保留整數，最多三位 */
export function sanitizeIntInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

/** 字串轉數字；空字串或非數字回傳 null */
export function parseNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 數字轉成顯示用字串：80 → "80"、82.5 → "82.5"，最多兩位小數 */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** 秒數 → 「1:30」 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
