/**
 * 上半身動作的檢查規則：肩推、伏地挺身、撐體、引體向上、下拉、划船、彎舉、三頭伸展、平舉
 * 距離以軀幹長度（肩到髖）為單位，上半身動作不一定拍得到腳。
 */
import {
  armRaise,
  elbowAngle,
  fmtSec,
  framesFor,
  kneeAngle,
  maxOver,
  minOver,
  pickSide,
  rangeOver,
  round,
  sideLabel,
  signalOf,
  toResult,
  upperArmAngle,
  type PatternResult,
} from './helpers';
import type { ProfileOptions } from './profiles';
import { bendBelow, orientByStart, segmentReps, torsoLean, type Body, type Rep, type Side, type Track } from './track';
import type { Issue, Metric, RepResult } from './types';

/** 手臂伸直至少要這麼多度 */
const STRAIGHT_ARM = 150;
/** 推到頂時手肘至少要這麼直（偵測出來的手肘角度常比實際小幾度，所以放寬） */
const PRESS_LOCKOUT = 145;
/** 推到頂時手腕在肩膀前方超過軀幹長度的這個比例 */
const PRESS_FORWARD = 0.3;
/** 最低點手腕還在肩膀上方超過軀幹長度的這個比例：沒放回肩膀 */
const PRESS_PARTIAL = 0.3;
/** 往後仰超過這麼多度 */
const PRESS_LEAN_BACK = 15;
/** 膝蓋彎超過這麼多度：用到腿 */
const LEG_DRIVE = 15;
/** 伏地挺身、撐體：最低點手肘要彎到這麼多度以下 */
const PUSH_DEPTH = 100;
/** 塌腰、屁股翹的度數 */
const SAG = 12;
const PIKE = 15;
/** 引體向上：鼻子可以比手腕低一點點（軀幹長度的比例） */
const CHIN_TOLERANCE = 0.05;
/** 引體向上：髖相對手的前後擺動超過軀幹長度的這個比例 */
const KIP = 0.5;
/** 下拉：身體往後倒超過這麼多度 */
const PULLDOWN_LEAN = 30;
/** 划船：拉到底時手肘至少要彎到這麼多度 */
const ROW_TOP = 100;
/** 身體晃動：一下之中軀幹角度變化超過這麼多度 */
const SWING = 12;
/** 俯身划船：上半身前傾至少這麼多度 */
const BENT_OVER = 35;
/** 彎舉：彎到頂時手肘要在這個角度以下 */
const CURL_TOP = 75;
/** 彎舉：彎到頂時上臂往前超過這麼多度 */
const ELBOW_FORWARD = 35;
/** 三頭：手臂伸直至少這麼多度 */
const TRICEPS_LOCKOUT = 145;
/** 三頭：上臂角度變化超過這麼多度 */
const UPPER_ARM_MOVE = 25;
/** 平舉：舉到頂時手臂和軀幹的角度 */
const RAISE_LOW = 70;
const RAISE_HIGH = 115;
const RAISE_ASYM = 15;

const around = (track: Track, i: number, sec = 0.3): [number, number] => {
  const w = framesFor(track, sec);
  return [i - w, i + w];
};

function build(
  track: Track,
  reps: Rep[],
  check: (rep: Rep, metrics: Metric[], issues: Issue[]) => void,
  concentricLabel: string,
  toPeak: boolean,
): RepResult[] {
  return reps.map((rep, i) => {
    const metrics: Metric[] = [];
    const issues: Issue[] = [];
    check(rep, metrics, issues);
    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: concentricLabel, value: fmtSec(toPeak ? r.times.peak - r.times.start : r.times.end - r.times.peak) });
    return r;
  });
}

/** 一下之中軀幹角度的變化（身體晃動） */
const torsoSwing = (track: Track, rep: Rep, s: Side) =>
  rangeOver(track, rep.start, rep.end, (b) => torsoLean(b[s].hip, b[s].shoulder));

// ───────── 肩推 ─────────

export function analyzePress(track: Track, options: ProfileOptions): PatternResult {
  const T = track.torsoLength;
  const a = pickSide(track, (b, s) => -b[s].wrist.y);
  const s = track.side;
  const side = track.view === 'side';
  const reps = segmentReps(signalOf(track, (b) => -b[a].wrist.y), T * 0.3);
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const [p0, p1] = around(track, rep.peak);
      const lockout = maxOver(track, p0, p1, (b) => elbowAngle(b, a));
      metrics.push({ label: '推到頂時手肘', value: `${round(lockout)}°` });
      if (lockout < PRESS_LOCKOUT) issues.push({ id: 'pressLockout', level: 'warn', text: `手肘只伸到 ${round(lockout)}°` });
      if (side) {
        const forward = minOver(track, p0, p1, (b) => Math.abs(b[a].wrist.x - b[a].shoulder.x)) / T;
        if (forward > PRESS_FORWARD) issues.push({ id: 'pressForward', level: 'warn', text: '推到頂時手在肩膀前面' });
      }
      // 最低點：手腕最低的時候離肩膀多高
      const [s0] = around(track, rep.start);
      const [, e1] = around(track, rep.end);
      const low = maxOver(track, s0, rep.start, (b) => b[a].wrist.y - b[a].shoulder.y);
      const lowEnd = maxOver(track, rep.end, e1, (b) => b[a].wrist.y - b[a].shoulder.y);
      if (Math.max(low, lowEnd) < -PRESS_PARTIAL * T) {
        issues.push({ id: 'pressPartial', level: 'warn', text: '放下時手還在肩膀上方' });
      }
      if (side && options.standing) {
        const lean = minOver(track, rep.start, rep.end, (b) => torsoLean(b[s].hip, b[s].shoulder));
        if (lean <= -PRESS_LEAN_BACK) issues.push({ id: 'pressLeanBack', level: 'warn', text: `上半身往後仰 ${round(-lean)}°` });
        if (!options.legDrive) {
          const bend = maxOver(track, s0, rep.start, (b) => kneeAngle(b, s)) - minOver(track, rep.start, rep.peak, (b) => kneeAngle(b, s));
          if (bend > LEG_DRIVE) issues.push({ id: 'legDrive', level: 'info', text: `推的時候膝蓋彎了 ${round(bend)}°` });
        }
      }
    },
    '推起時間',
    true,
  );
  return { reps: results, notes: options.single ? [`看的是${sideLabel(a)}手`] : [] };
}

// ───────── 伏地挺身 ─────────

export function analyzePushup(track: Track): PatternResult {
  const L = track.legLength;
  const s = track.side;
  const reps = segmentReps(
    signalOf(track, (b) => b[s].shoulder.y),
    L * 0.08,
  );
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const sag = maxOver(track, rep.start, rep.end, (b) => bendBelow(b[s].shoulder, b[s].hip, b[s].ankle));
      const pike = -minOver(track, rep.start, rep.end, (b) => bendBelow(b[s].shoulder, b[s].hip, b[s].ankle));
      metrics.push({ label: '身體偏離直線', value: sag >= pike ? `往下 ${round(Math.max(0, sag))}°` : `往上 ${round(pike)}°` });
      if (sag >= SAG) issues.push({ id: 'hipSag', level: 'warn', text: `腰往下塌 ${round(sag)}°` });
      else if (pike >= PIKE) issues.push({ id: 'hipPike', level: 'warn', text: `屁股比一直線高 ${round(pike)}°` });
      addPushDepth(track, rep, s, metrics, issues, 'pushupShallow');
    },
    '推起時間',
    false,
  );
  return { reps: results, notes: [] };
}

/** 伏地挺身、撐體的深度與撐直 */
function addPushDepth(track: Track, rep: Rep, s: Side, metrics: Metric[], issues: Issue[], shallowId: string) {
  const [p0, p1] = around(track, rep.peak);
  const bottom = minOver(track, p0, p1, (b) => elbowAngle(b, s));
  const [s0, s1] = around(track, rep.start);
  const top = maxOver(track, s0, s1, (b) => elbowAngle(b, s));
  metrics.push({ label: '最低點手肘', value: `${round(bottom)}°` });
  if (bottom > PUSH_DEPTH) issues.push({ id: shallowId, level: 'warn', text: `手肘只彎到 ${round(bottom)}°` });
  if (top < STRAIGHT_ARM) issues.push({ id: 'pushupLockout', level: 'info', text: `上面手肘 ${round(top)}°` });
}

// ───────── 撐體 ─────────

export function analyzeDip(track: Track): PatternResult {
  const s = track.side;
  const reps = segmentReps(
    signalOf(track, (b) => b[s].shoulder.y),
    track.torsoLength * 0.15,
  );
  const results = build(track, reps, (rep, m, i) => addPushDepth(track, rep, s, m, i, 'dipShallow'), '撐起時間', false);
  return { reps: results, notes: [] };
}

// ───────── 引體向上 ─────────

export function analyzePullup(track: Track): PatternResult {
  const T = track.torsoLength;
  const s = track.side;
  const reps = segmentReps(
    signalOf(track, (b) => -b[s].shoulder.y),
    T * 0.25,
  );
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const [p0, p1] = around(track, rep.peak);
      // 鼻子比手腕高多少（軀幹長度的比例，正數 = 比較高）
      const over = maxOver(track, p0, p1, (b) => (Math.min(b.left.wrist.y, b.right.wrist.y) - b.nose.y) / T);
      metrics.push({ label: '最高點下巴', value: over >= 0 ? '過槓' : `差 ${round(-over * 100)}% 軀幹長` });
      if (over < -CHIN_TOLERANCE) issues.push({ id: 'chinNotOver', level: 'warn', text: '下巴沒有過槓' });
      const [s0, s1] = around(track, rep.start);
      const hang = maxOver(track, s0, s1, (b) => elbowAngle(b, s));
      metrics.push({ label: '懸垂時手肘', value: `${round(hang)}°` });
      if (hang < STRAIGHT_ARM) issues.push({ id: 'noDeadHang', level: 'warn', text: `懸垂時手肘只有 ${round(hang)}°` });
      if (track.view === 'side') {
        const kip = rangeOver(track, rep.start, rep.end, (b) => b[s].hip.x - b[s].wrist.x) / T;
        if (kip > KIP) issues.push({ id: 'kipping', level: 'warn', text: '身體前後擺盪' });
      }
    },
    '拉起時間',
    true,
  );
  return { reps: results, notes: [] };
}

// ───────── 下拉 ─────────

export function analyzePulldown(track: Track, options: ProfileOptions): PatternResult {
  const T = track.torsoLength;
  const s = track.side;
  const a = options.single ? pickSide(track, (b, x) => b[x].wrist.y) : s;
  const reps = segmentReps(
    signalOf(track, (b) => b[a].wrist.y),
    T * 0.25,
  );
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const [p0, p1] = around(track, rep.peak);
      // 手腕比鼻子低多少（正數 = 拉到下巴以下）
      const below = maxOver(track, p0, p1, (b) => (b[a].wrist.y - b.nose.y) / T);
      if (below < 0) issues.push({ id: 'pulldownShallow', level: 'warn', text: '手沒有拉到下巴以下' });
      const [s0, s1] = around(track, rep.start);
      const stretch = maxOver(track, s0, s1, (b) => elbowAngle(b, a));
      metrics.push({ label: '上面手肘', value: `${round(stretch)}°` });
      if (stretch < STRAIGHT_ARM) issues.push({ id: 'pulldownStretch', level: 'info', text: `上面手肘只有 ${round(stretch)}°` });
      const lean = minOver(track, p0, p1, (b) => torsoLean(b[s].hip, b[s].shoulder));
      metrics.push({ label: '拉到底時身體後傾', value: `${round(Math.max(0, -lean))}°` });
      if (lean <= -PULLDOWN_LEAN) issues.push({ id: 'pulldownLean', level: 'warn', text: `身體往後倒 ${round(-lean)}°` });
    },
    '拉下時間',
    true,
  );
  return { reps: results, notes: options.single ? [`看的是${sideLabel(a)}手`] : [] };
}

// ───────── 划船 ─────────

export function analyzeRow(track: Track, options: ProfileOptions): PatternResult {
  const s = track.side;
  const a = pickSide(track, (b, x) => -elbowAngle(b, x));
  const reps = segmentReps(
    signalOf(track, (b) => 180 - elbowAngle(b, a)),
    40,
  );
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const [p0, p1] = around(track, rep.peak);
      const top = minOver(track, p0, p1, (b) => elbowAngle(b, a));
      metrics.push({ label: '拉到底時手肘', value: `${round(top)}°` });
      if (top > ROW_TOP) issues.push({ id: 'rowShallow', level: 'warn', text: `手肘只彎到 ${round(top)}°` });
      const [s0, s1] = around(track, rep.start);
      const stretch = maxOver(track, s0, s1, (b) => elbowAngle(b, a));
      if (stretch < STRAIGHT_ARM - 10) issues.push({ id: 'rowStretch', level: 'info', text: `放下時手肘只有 ${round(stretch)}°` });
      if (options.standing) {
        const swing = torsoSwing(track, rep, s);
        metrics.push({ label: '上半身起伏', value: `${round(swing)}°` });
        if (swing > (options.swingLimit ?? SWING + 3)) issues.push({ id: 'rowSwing', level: 'warn', text: `上半身起伏 ${round(swing)}°` });
      }
      if (options.bentOver) {
        const lean = torsoLean(track.bodies[rep.start]![s].hip, track.bodies[rep.start]![s].shoulder);
        metrics.push({ label: '上半身前傾', value: `${round(lean)}°` });
        if (lean < BENT_OVER) issues.push({ id: 'rowUpright', level: 'warn', text: `上半身只前傾 ${round(lean)}°` });
      }
    },
    '拉起時間',
    true,
  );
  return { reps: results, notes: options.single ? [`看的是${sideLabel(a)}手`] : [] };
}

// ───────── 彎舉 ─────────

export function analyzeCurl(track: Track, options: ProfileOptions): PatternResult {
  const s = track.side;
  const a = pickSide(track, (b, x) => -elbowAngle(b, x));
  const reps = segmentReps(
    signalOf(track, (b) => 180 - elbowAngle(b, a)),
    50,
  );
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const [s0, s1] = around(track, rep.start);
      const [e0, e1] = around(track, rep.end);
      const extend = Math.max(maxOver(track, s0, s1, (b) => elbowAngle(b, a)), maxOver(track, e0, e1, (b) => elbowAngle(b, a)));
      const [p0, p1] = around(track, rep.peak);
      const top = minOver(track, p0, p1, (b) => elbowAngle(b, a));
      metrics.push({ label: '手肘角度', value: `${round(extend)}° → ${round(top)}°` });
      if (extend < STRAIGHT_ARM - 5) issues.push({ id: 'curlNoExtend', level: 'warn', text: `放下時手肘只有 ${round(extend)}°` });
      if (top > CURL_TOP) issues.push({ id: 'curlTop', level: 'info', text: `只彎到 ${round(top)}°` });
      if (options.standing) {
        const forward = maxOver(track, p0, p1, (b) => upperArmAngle(b, a));
        metrics.push({ label: '彎到頂時上臂往前', value: `${round(forward)}°` });
        if (forward > ELBOW_FORWARD) issues.push({ id: 'elbowForward', level: 'warn', text: `上臂往前了 ${round(forward)}°` });
        const swing = torsoSwing(track, rep, s);
        if (swing > SWING) issues.push({ id: 'bodySwing', level: 'warn', text: `身體晃了 ${round(swing)}°` });
      }
    },
    '彎起時間',
    true,
  );
  return { reps: results, notes: options.single ? [`看的是${sideLabel(a)}手`] : [] };
}

// ───────── 三頭伸展 ─────────

export function analyzeTriceps(track: Track, options: ProfileOptions): PatternResult {
  const s = track.side;
  const a = pickSide(track, (b, x) => elbowAngle(b, x));
  // 起始姿勢可能是彎著（下壓）或伸直（過頭伸展），依影片開頭決定方向
  const reps = segmentReps(orientByStart(signalOf(track, (b) => elbowAngle(b, a)), track.times), 45);
  const upperArmDir = (b: Body) => (Math.atan2(b[a].elbow.x - b[a].shoulder.x, b[a].elbow.y - b[a].shoulder.y) * 180) / Math.PI;
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const straight = maxOver(track, rep.start - 2, rep.end + 2, (b) => elbowAngle(b, a));
      metrics.push({ label: '伸到最直', value: `${round(straight)}°` });
      if (straight < TRICEPS_LOCKOUT) issues.push({ id: 'tricepsNoLockout', level: 'warn', text: `手肘只伸到 ${round(straight)}°` });
      if (options.fixedUpperArm) {
        const move = rangeOver(track, rep.start, rep.end, upperArmDir);
        metrics.push({ label: '上臂移動', value: `${round(move)}°` });
        if (move > UPPER_ARM_MOVE) issues.push({ id: 'elbowMoving', level: 'warn', text: `上臂動了 ${round(move)}°` });
      }
      if (options.standing) {
        const swing = torsoSwing(track, rep, s);
        if (swing > SWING) issues.push({ id: 'bodySwing', level: 'warn', text: `身體晃了 ${round(swing)}°` });
      }
    },
    '動作時間',
    true,
  );
  return { reps: results, notes: options.single ? [`看的是${sideLabel(a)}手`] : [] };
}

// ───────── 側平舉、前平舉 ─────────

export function analyzeRaise(track: Track, options: ProfileOptions): PatternResult {
  const s = track.side;
  // 兩手一起舉（側面拍時只看得到近側）
  const both = track.view !== 'side' && !options.single;
  const a = pickSide(track, armRaise);
  const lift = (b: Body) => (both ? (armRaise(b, 'left') + armRaise(b, 'right')) / 2 : armRaise(b, a));
  const reps = segmentReps(signalOf(track, lift), 40);
  const results = build(
    track,
    reps,
    (rep, metrics, issues) => {
      const [p0, p1] = around(track, rep.peak);
      const top = maxOver(track, p0, p1, lift);
      metrics.push({ label: '舉到最高', value: `${round(top)}°（90° = 肩膀高度）` });
      if (top < RAISE_LOW) issues.push({ id: 'raiseLow', level: 'warn', text: `手臂只舉到 ${round(top)}°` });
      else if (top > RAISE_HIGH) issues.push({ id: 'raiseHigh', level: 'info', text: `手臂舉到 ${round(top)}°` });
      if (both) {
        const peak = track.bodies[rep.peak]!;
        const diff = armRaise(peak, 'left') - armRaise(peak, 'right');
        if (Math.abs(diff) > RAISE_ASYM) {
          issues.push({ id: 'raiseAsym', level: 'warn', text: `${diff > 0 ? '右' : '左'}手比較低 ${round(Math.abs(diff))}°` });
        }
      }
      if (options.standing && track.view === 'side') {
        const swing = torsoSwing(track, rep, s);
        if (swing > SWING) issues.push({ id: 'bodySwing', level: 'warn', text: `身體晃了 ${round(swing)}°` });
      }
    },
    '舉起時間',
    true,
  );
  return { reps: results, notes: !both && options.single ? [`看的是${sideLabel(a)}手`] : [] };
}
