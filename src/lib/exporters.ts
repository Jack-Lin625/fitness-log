/**
 * 匯出：JSON 完整備份、CSV（可用 Excel／Google 試算表開啟）
 */
import type { AppData, BodyMetric, Exercise, WorkoutSession } from '../types/models';
import { BODY_PART_LABELS } from '../types/models';
import { STORED_METRICS } from './bodyMetrics';
import { chronological } from './records';
import { setVolume } from './volume';
import { todayString } from './date';

/** 完整備份（含版本號，之後的版本也能匯入） */
export function toBackupJson(data: AppData): string {
  // 備份不包含進行中的訓練草稿
  return JSON.stringify({ ...data, activeDraft: null }, null, 2);
}

/** CSV 欄位跳脫：含逗號、引號、換行時用雙引號包起來 */
function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | undefined)[][]): string {
  // 開頭的 BOM 讓 Excel 正確辨識中文（UTF-8）
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** 訓練紀錄 CSV：一組一列 */
export function sessionsToCsv(
  sessions: WorkoutSession[],
  getExercise: (id: string) => Exercise | undefined,
): string {
  const rows: (string | number | undefined)[][] = [
    ['日期', '動作', '部位', '組', '重量(kg)', '次數', 'RPE', '熱身組', '容量(kg)', '備註'],
  ];
  for (const s of chronological(sessions)) {
    for (const ex of s.exercises) {
      const e = getExercise(ex.exerciseId);
      ex.sets.forEach((set, i) => {
        rows.push([
          s.date,
          e?.name ?? '已刪除的動作',
          e ? BODY_PART_LABELS[e.bodyPart] : '',
          i + 1,
          set.weight,
          set.reps,
          set.rpe,
          set.isWarmup ? '是' : '',
          e?.assisted ? 0 : setVolume(set),
          s.note,
        ]);
      });
    }
  }
  return toCsv(rows);
}

/** 體態紀錄 CSV：一天一列 */
export function bodyMetricsToCsv(metrics: BodyMetric[]): string {
  const header = ['日期', ...STORED_METRICS.map((d) => `${d.label}(${d.unit})`)];
  const rows = [...metrics]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => [m.date, ...STORED_METRICS.map((d) => m[d.key])]);
  return toCsv([header, ...rows]);
}

/** 下載檔案到使用者裝置 */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 給瀏覽器一點時間開始下載再釋放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 檔名加上日期，例如 fitlog-backup-2026-10-20.json */
export const datedName = (prefix: string, ext: string) => `${prefix}-${todayString()}.${ext}`;

/** 讀取使用者選擇的檔案內容 */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('無法讀取這個檔案'));
    reader.readAsText(file);
  });
}
