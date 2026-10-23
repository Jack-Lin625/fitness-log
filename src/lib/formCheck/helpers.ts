/** 各動作的檢查規則共用的小工具 */
import { CATALOG } from './catalog';
import { angleAt, type Body, type Rep, type Side, type Track } from './track';
import type { Issue, IssueSummary, Metric, RepResult } from './types';

export const round = (v: number) => Math.round(v);
export const fmtSec = (s: number) => `${s.toFixed(1)} 秒`;
export const pct = (v: number) => `${round(v * 100)}%`;

/** 每秒幾格 */
export const fps = (track: Track) =>
  track.times.length > 1 ? (track.times.length - 1) / (track.times[track.times.length - 1]! - track.times[0]! || 1) : 15;

/** 第幾格到第幾格之間，每一格算出一個值，取最大／最小 */
export function maxOver(track: Track, from: number, to: number, value: (b: Body) => number): number {
  let best = -Infinity;
  for (let i = Math.max(0, from); i <= Math.min(track.bodies.length - 1, to); i++) {
    const b = track.bodies[i];
    if (b) best = Math.max(best, value(b));
  }
  return best;
}
export const minOver = (track: Track, from: number, to: number, value: (b: Body) => number) =>
  -maxOver(track, from, to, (b) => -value(b));
/** 最大值減最小值 */
export const rangeOver = (track: Track, from: number, to: number, value: (b: Body) => number) =>
  maxOver(track, from, to, value) - minOver(track, from, to, value);

/** 從 from 往 to 找第一個符合條件的格（找不到回傳 to） */
export function findFrame(track: Track, from: number, to: number, ok: (b: Body) => boolean): number {
  const step = to >= from ? 1 : -1;
  for (let i = from; i !== to + step; i += step) {
    const b = track.bodies[i];
    if (b && ok(b)) return i;
  }
  return to;
}

/** 前後幾格（秒數換成格數） */
export const framesFor = (track: Track, seconds: number) => Math.max(1, Math.round(seconds * fps(track)));

/** 訊號：每一格算一個值，偵測不到的格是 null */
export const signalOf = (track: Track, value: (b: Body) => number) => track.bodies.map((b) => (b ? value(b) : null));

/** 訊號的變化範圍（去掉頭尾 5% 的極端值） */
export function spread(signal: (number | null)[]): number {
  const v = signal.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length < 5) return 0;
  return v[Math.floor(v.length * 0.95)]! - v[Math.floor(v.length * 0.05)]!;
}

/**
 * 選要看哪一側：側面拍時近側比較準，除非另一側動作幅度明顯比較大（單手動作用遠側那隻手）
 */
export function pickSide(track: Track, value: (b: Body, side: Side) => number): Side {
  const near = track.side;
  const far: Side = near === 'left' ? 'right' : 'left';
  const n = spread(signalOf(track, (b) => value(b, near)));
  const f = spread(signalOf(track, (b) => value(b, far)));
  return f > n * 1.3 ? far : near;
}

// 常用角度
export const elbowAngle = (b: Body, s: Side) => angleAt(b[s].shoulder, b[s].elbow, b[s].wrist);
export const kneeAngle = (b: Body, s: Side) => angleAt(b[s].hip, b[s].knee, b[s].ankle);
export const hipAngle = (b: Body, s: Side) => angleAt(b[s].shoulder, b[s].hip, b[s].knee);
/** 上臂和軀幹的夾角（手臂往前或往側邊舉起的角度） */
export const upperArmAngle = (b: Body, s: Side) => angleAt(b[s].hip, b[s].shoulder, b[s].elbow);
/** 整隻手臂（肩到手腕）和軀幹的夾角 */
export const armRaise = (b: Body, s: Side) => angleAt(b[s].hip, b[s].shoulder, b[s].wrist);
export const sideLabel = (s: Side) => (s === 'left' ? '左' : '右');

export function toResult(track: Track, rep: Rep, index: number, metrics: Metric[], issues: Issue[]): RepResult {
  return {
    ...rep,
    index,
    times: { start: track.times[rep.start]!, peak: track.times[rep.peak]!, end: track.times[rep.end]! },
    metrics,
    issues,
  };
}

/** 同一種問題彙整在一起，嚴重的排前面 */
export function summarize(reps: RepResult[]): IssueSummary[] {
  const map = new Map<string, IssueSummary>();
  for (const r of reps) {
    for (const issue of r.issues) {
      const entry = map.get(issue.id);
      if (entry) {
        if (!entry.reps.includes(r.index)) entry.reps.push(r.index);
      } else {
        map.set(issue.id, { id: issue.id, level: issue.level, ...CATALOG[issue.id]!, reps: [r.index] });
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.level === b.level ? b.reps.length - a.reps.length : a.level === 'warn' ? -1 : 1,
  );
}

/** 用力的那一段：往最深處（toPeak）、從最深處回來（fromPeak）、或整下 */
export type Concentric = 'toPeak' | 'fromPeak' | 'whole';

const SLOWDOWN = 1.6;

/** 後面的用力時間比前兩下慢很多：接近力竭 */
export function addSlowdown(reps: RepResult[], concentric: Concentric): void {
  if (reps.length < 3) return;
  const duration = (r: RepResult) =>
    concentric === 'toPeak'
      ? r.times.peak - r.times.start
      : concentric === 'fromPeak'
        ? r.times.end - r.times.peak
        : r.times.end - r.times.start;
  const base = (duration(reps[0]!) + duration(reps[1]!)) / 2;
  if (base <= 0) return;
  for (const r of reps.slice(2)) {
    const ratio = duration(r) / base;
    if (ratio >= SLOWDOWN) r.issues.push({ id: 'slowdown', level: 'info', text: `比前兩下慢了 ${round((ratio - 1) * 100)}%` });
  }
}

/** 一段的結果；沒有找到任何一下時給 error */
export interface PatternResult {
  reps: RepResult[];
  notes: string[];
  error?: string;
}
