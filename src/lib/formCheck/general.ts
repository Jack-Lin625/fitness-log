/**
 * 通用檢查（沒有專屬規則的動作）與撐住不動的動作（棒式）
 */
import {
  elbowAngle,
  fmtSec,
  kneeAngle,
  pct,
  round,
  sideLabel,
  signalOf,
  spread,
  toResult,
  type PatternResult,
} from './helpers';
import { angleAt, bendBelow, mid, orientByStart, segmentReps, type Body, type Side, type Track } from './track';
import type { Issue, Metric } from './types';

/** 從 u 轉到 v 的角度（度，−180～180，有正負，不會在 180° 折回來） */
function turn(u: { x: number; y: number }, v: { x: number; y: number }): number {
  return (Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y) * 180) / Math.PI;
}
const sub = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x - b.x, y: a.y - b.y });

interface Measure {
  name: string;
  unit: '°' | '%';
  /** 至少要變化這麼多才算在做動作 */
  min: number;
  /** side 為 null 代表兩側一起算的量 */
  value: (b: Body, side: Side, T: number) => number;
  bilateral?: boolean;
}

/**
 * 通用檢查會看的量。肩、髖用「相對於軀幹延長線轉了幾度」，手臂往後、腿往後踢時不會在 180° 折回來被算成兩下。
 */
const MEASURES: Measure[] = [
  { name: '手肘', unit: '°', min: 20, value: elbowAngle },
  { name: '肩膀', unit: '°', min: 20, value: (b, s) => turn(sub(b[s].hip, b[s].shoulder), sub(b[s].elbow, b[s].shoulder)) },
  { name: '髖', unit: '°', min: 20, value: (b, s) => turn(sub(b[s].hip, b[s].shoulder), sub(b[s].knee, b[s].hip)) },
  { name: '膝蓋', unit: '°', min: 20, value: kneeAngle },
  { name: '腳踝', unit: '°', min: 15, value: (b, s) => angleAt(b[s].knee, b[s].ankle, b[s].toe) },
  {
    name: '兩手距離',
    unit: '%',
    min: 15,
    bilateral: true,
    value: (b, _s, T) => (Math.hypot(b.left.wrist.x - b.right.wrist.x, b.left.wrist.y - b.right.wrist.y) / T) * 100,
  },
  {
    name: '肩膀高度',
    unit: '%',
    min: 6,
    bilateral: true,
    value: (b, _s, T) => ((mid(b.left.hip, b.right.hip).y - mid(b.left.shoulder, b.right.shoulder).y) / T) * 100,
  },
  {
    name: '手的左右位置',
    unit: '%',
    min: 15,
    bilateral: true,
    value: (b, _s, T) => ((mid(b.left.wrist, b.right.wrist).x - mid(b.left.hip, b.right.hip).x) / T) * 100,
  },
  {
    name: '上半身傾斜',
    unit: '°',
    min: 12,
    bilateral: true,
    value: (b) => {
      const sh = mid(b.left.shoulder, b.right.shoulder);
      const hip = mid(b.left.hip, b.right.hip);
      return (Math.atan2(sh.x - hip.x, hip.y - sh.y) * 180) / Math.PI;
    },
  },
];

/** 幅度小於其他下的這個比例：不完整 */
const PARTIAL = 0.75;

/**
 * 找出變化最大的量（以各自的門檻為單位比較），用它數次數、比較每一下的幅度
 */
export function analyzeGeneric(track: Track): PatternResult {
  const T = track.torsoLength || 1;
  let best: { m: Measure; side: Side; signal: (number | null)[]; range: number; score: number } | null = null;
  for (const m of MEASURES) {
    for (const side of m.bilateral ? [track.side] : (['left', 'right'] as const)) {
      const signal = signalOf(track, (b) => m.value(b, side, T));
      const range = spread(signal);
      // 側面拍時近側比較準：遠側要明顯比較大才選
      const score = (range / m.min) * (track.view === 'side' && side !== track.side ? 1 / 1.3 : 1);
      if (!best || score > best.score) best = { m, side, signal, range, score };
    }
  }
  if (!best || best.score < 1) {
    return { reps: [], notes: [], error: '找不到明顯重複的動作。請錄完整的一組，動作的關節要在畫面裡。' };
  }
  const { m } = best;
  const signal = orientByStart(best.signal, track.times);
  const reps = segmentReps(signal, Math.max(m.min * 0.75, best.range * 0.4));
  const rom = reps.map((r) => Math.abs(signal[r.peak]! - signal[r.start]!));
  const sorted = [...rom].sort((a, b) => a - b);
  const ref = sorted[Math.floor((sorted.length - 1) * 0.75)] ?? 0;
  const results = reps.map((rep, i) => {
    const metrics: Metric[] = [{ label: `${m.name}${m.unit === '%' ? '變化' : '活動幅度'}`, value: `${round(rom[i]!)}${m.unit}` }];
    const issues: Issue[] = [];
    if (ref > 0 && rom[i]! < ref * PARTIAL) {
      issues.push({ id: 'partialRom', level: 'warn', text: `幅度比其他下小 ${pct(1 - rom[i]! / ref)}` });
    }
    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '這一下的時間', value: fmtSec(r.times.end - r.times.start) });
    return r;
  });
  const what = m.bilateral || track.view === 'side' ? m.name : `${sideLabel(best.side)}${m.name}`;
  return {
    reps: results,
    notes: [`這個動作沒有專屬的檢查規則，只看${what}的${m.unit === '%' ? '變化' : '活動幅度'}（每一下有沒有做完整）和速度。`],
  };
}

// ───────── 棒式（撐住不動） ─────────

const HOLD_SAG = 12;
const HOLD_PIKE = 15;
/** 超過這個比例的時間有問題才提醒 */
const HOLD_RATIO = 0.3;

export function analyzeHold(track: Track): PatternResult {
  const s = track.side;
  const line = (b: Body) =>
    track.view === 'side'
      ? { a: b[s].shoulder, h: b[s].hip, c: b[s].ankle }
      : { a: mid(b.left.shoulder, b.right.shoulder), h: mid(b.left.hip, b.right.hip), c: mid(b.left.ankle, b.right.ankle) };
  // 撐住的格：身體接近水平（肩到腳踝的線和水平的夾角小於 45°）
  const holding: number[] = [];
  const devs: number[] = [];
  track.bodies.forEach((b, i) => {
    if (!b) return;
    const { a, h, c } = line(b);
    const tilt = (Math.atan2(Math.abs(c.y - a.y), Math.abs(c.x - a.x)) * 180) / Math.PI;
    const dev = bendBelow(a, h, c);
    if (tilt < 45 && Math.abs(dev) < 45) {
      holding.push(i);
      devs.push(dev);
    }
  });
  if (holding.length < 2) return { reps: [], notes: [], error: '找不到撐住的姿勢。請從側面拍，全身都要在畫面裡。' };
  const start = holding[0]!;
  const end = holding[holding.length - 1]!;
  const seconds = track.times[end]! - track.times[start]!;
  if (seconds < 2) return { reps: [], notes: [], error: '撐住的時間太短（不到 2 秒），請錄完整的一次。' };

  const sagRatio = devs.filter((d) => d >= HOLD_SAG).length / devs.length;
  const pikeRatio = devs.filter((d) => d <= -HOLD_PIKE).length / devs.length;
  const avg = devs.reduce((a, b) => a + b, 0) / devs.length;
  const metrics: Metric[] = [
    { label: '撐住時間', value: fmtSec(seconds) },
    { label: '平均身體偏離直線', value: avg >= 0 ? `往下 ${round(avg)}°` : `往上 ${round(-avg)}°` },
  ];
  const issues: Issue[] = [];
  if (sagRatio >= HOLD_RATIO) {
    issues.push({ id: 'hipSag', level: 'warn', text: `${pct(sagRatio)} 的時間腰往下塌，最多 ${round(Math.max(...devs))}°` });
  } else if (pikeRatio >= HOLD_RATIO) {
    issues.push({ id: 'hipPike', level: 'warn', text: `${pct(pikeRatio)} 的時間屁股翹太高` });
  }
  // 後半段比前半段塌（撐不住了）
  const half = Math.floor(devs.length / 2);
  const first = devs.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
  const second = devs.slice(half).reduce((a, b) => a + b, 0) / (devs.length - half || 1);
  if (second - first >= 6 && !issues.some((i) => i.id === 'hipSag')) {
    issues.push({ id: 'hipSag', level: 'info', text: '後半段腰開始往下掉' });
  }
  const peak = holding[Math.floor(holding.length / 2)]!;
  return { reps: [toResult(track, { start, peak, end }, 1, metrics, issues)], notes: [] };
}
