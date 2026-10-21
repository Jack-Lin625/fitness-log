/**
 * Chart.js 的載入與主題設定
 * 圖表程式庫只在打開圖表頁時才下載（動態載入），讓 App 開啟速度不受影響。
 */
import type { Chart as ChartType } from 'chart.js';
import { BODY_PARTS, type BodyPart } from '../types/models';

let loading: Promise<typeof ChartType> | null = null;

/** 載入並註冊用得到的 Chart.js 元件（只執行一次） */
export function loadChart(): Promise<typeof ChartType> {
  loading ??= import('chart.js').then((m) => {
    m.Chart.register(
      m.LineController,
      m.LineElement,
      m.PointElement,
      m.BarController,
      m.BarElement,
      m.LinearScale,
      m.CategoryScale,
      m.Tooltip,
      m.Legend,
      m.Filler,
    );
    return m.Chart;
  });
  return loading;
}

/** 從 CSS 變數讀出目前（深色或淺色）模式的顏色 */
export interface ChartTheme {
  ink: string;
  muted: string;
  line: string;
  surface: string;
  accent: string;
  pr: string;
  fontNum: string;
  fontBody: string;
  parts: Record<BodyPart, string>;
}

export function readTheme(): ChartTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    ink: v('--ink'),
    muted: v('--muted'),
    line: v('--line'),
    surface: v('--surface'),
    accent: v('--accent'),
    pr: v('--pr'),
    fontNum: v('--font-num'),
    fontBody: v('--font-body'),
    parts: Object.fromEntries(BODY_PARTS.map((p) => [p, v(`--part-${p}`)])) as Record<BodyPart, string>,
  };
}

/** 'YYYY-MM-DD' → 當天中午的 timestamp（避開時區邊界），給時間軸使用 */
export const toTime = (date: string) => new Date(`${date}T12:00:00`).getTime();

/** timestamp → 「10/20」 */
export const shortDate = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** timestamp → 「10月20日」 */
export const longDate = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
