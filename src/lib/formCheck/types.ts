/** 動作檢查的結果 */
import type { Rep, View } from './track';

export type FormExercise = 'squat' | 'deadlift';

export interface Issue {
  /** 問題種類（彙整用），例如 'shallow' */
  id: string;
  /** warn：需要修正；info：參考 */
  level: 'warn' | 'info';
  /** 這一下的說明，例如「大腿離水平還差 14°」 */
  text: string;
}

export interface Metric {
  label: string;
  value: string;
}

export interface RepResult extends Rep {
  /** 第幾下（從 1 開始） */
  index: number;
  /** 起點、最深、終點的時間（秒） */
  times: { start: number; peak: number; end: number };
  metrics: Metric[];
  issues: Issue[];
}

/** 同一種問題出現在哪幾下 */
export interface IssueSummary {
  id: string;
  level: 'warn' | 'info';
  title: string;
  /** 怎麼修正 */
  advice: string;
  reps: number[];
}

export interface FormAnalysis {
  exercise: FormExercise;
  view: View;
  reps: RepResult[];
  summary: IssueSummary[];
  /** 拍攝或偵測的問題，例如「角度斜的」；有 error 時沒有結果 */
  notes: string[];
  error: string | null;
}
