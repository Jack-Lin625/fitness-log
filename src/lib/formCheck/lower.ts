/**
 * 下半身動作的檢查規則：深蹲、硬舉、髖鉸鏈（羅馬尼亞硬舉等）、弓箭步、臀推
 *
 * 只檢查從關節位置量得出來、而且量得準的項目；背有沒有拱起偵測不到。
 * 門檻刻意放寬：關節點本身有幾度的誤差，寧可少報也不要誤報。
 */
import {
  findFrame,
  fmtSec,
  framesFor,
  hipAngle,
  kneeAngle,
  maxOver,
  minOver,
  pct,
  round,
  signalOf,
  toResult,
  type PatternResult,
} from './helpers';
import type { ProfileOptions } from './profiles';
import {
  angleAt,
  bendBelow,
  dist,
  mid,
  segmentReps,
  thighBelowHorizontal,
  torsoLean,
  type Body,
  type Track,
} from './track';
import type { Issue, Metric } from './types';

/** 大腿低於水平至少這麼多度才算平行（關節點的髖在臀部中間，比褶線略高，所以容許一點） */
const PARALLEL_DEG = -8;
/** 起身到 40% 時軀幹前傾比最低點多這麼多度：臀部先起來 */
const GOOD_MORNING_DEG = 12;
/** 腳跟抬起超過腿長的這個比例 */
const HEEL_LIFT = 0.06;
/** 站直時髖的角度至少要這麼大 */
const LOCKOUT_HIP = 160;
/** 站直時膝蓋的角度至少要這麼大（膝蓋留一點點彎是正常的） */
const LOCKOUT_KNEE = 155;
/** 檢查站直鎖定時看前後這麼多秒 */
const LOCKOUT_WINDOW = 0.6;
/** 膝距 ÷ 踝距比站著時少這麼多：膝蓋內夾 */
const KNEE_CAVE = 0.15;
/** 骨盆偏離兩腳中間超過髖寬的這個比例 */
const HIP_SHIFT = 0.2;
/** 硬舉：槓到膝蓋時軀幹比離地時更接近水平這麼多度 */
const HIPS_FIRST_DEG = 10;
/** 硬舉：槓到膝蓋時，髖升高的距離是肩的這麼多倍 */
const HIPS_FIRST_RATIO = 1.6;
/** 槓和腳掌中間的水平距離超過腿長的這個比例 */
const BAR_DRIFT = 0.15;
/** 鎖定時往後仰超過這麼多度 */
const LEAN_BACK_DEG = 12;
/** 弓箭步：前腳大腿離水平還差這麼多度以上算不夠低 */
const LUNGE_DEPTH = -20;
/** 弓箭步：前腳膝蓋超過腳尖這麼多腿長 */
const KNEE_PAST_TOE = 0.15;
/** 弓箭步：最低點上半身前傾超過這麼多度 */
const LUNGE_LEAN = 35;
/** 臀推：頂到最高時肩、髖、膝至少要這麼直 */
const THRUST_LOCKOUT = 160;
/** 臀推：髖比肩膝連線高出這麼多度算腰往上拱 */
const THRUST_ARCH = 15;

// ───────── 深蹲 ─────────

export function analyzeSquat(track: Track): PatternResult {
  const L = track.legLength;
  const s = track.side;
  const front = track.view === 'front';
  const hipY = (b: Body) => (front ? mid(b.left.hip, b.right.hip).y : b[s].hip.y);
  const reps = segmentReps(signalOf(track, hipY), L * 0.2);
  const notes =
    track.view === 'front'
      ? ['正面拍看得到膝蓋和左右平衡；蹲的深度要從側面拍才量得出來。']
      : ['膝蓋有沒有往內夾要從正面拍才看得到。'];

  const results = reps.map((rep, i) => {
    const start = track.bodies[rep.start]!;
    const bottom = track.bodies[rep.peak]!;
    const end = track.bodies[rep.end]!;
    const metrics: Metric[] = [];
    const issues: Issue[] = [];

    if (front) {
      // 膝距 ÷ 踝距：起身前半段最小的時候，和站著時比
      const ratio = (b: Body) =>
        Math.abs(b.left.knee.x - b.right.knee.x) / (Math.abs(b.left.ankle.x - b.right.ankle.x) || 1);
      const standing = ratio(start);
      const riseTo = findFrame(track, rep.peak, rep.end, (b) => hipY(b) <= hipY(bottom) - (hipY(bottom) - hipY(end)) * 0.6);
      const worst = minOver(track, rep.peak, riseTo, ratio);
      const drop = standing > 0 ? 1 - worst / standing : 0;
      metrics.push({ label: '膝距／踝距（最窄）', value: `${worst.toFixed(2)}（站著 ${standing.toFixed(2)}）` });
      if (drop >= KNEE_CAVE) issues.push({ id: 'kneeCave', level: 'warn', text: `起身時膝距比站著窄了 ${pct(drop)}` });

      // 最低點時骨盆偏離兩腳中間多少（以髖寬為單位）；MediaPipe 的 left 是本人的左邊
      const hipMid = mid(bottom.left.hip, bottom.right.hip);
      const footMid = mid(bottom.left.ankle, bottom.right.ankle);
      const hipWidth = dist(bottom.left.hip, bottom.right.hip) || 1;
      const shift = (hipMid.x - footMid.x) / hipWidth;
      const towardLeft = Math.sign(shift) === Math.sign(bottom.left.hip.x - bottom.right.hip.x);
      metrics.push({
        label: '最低點骨盆偏移',
        value: `${pct(Math.abs(shift))} 髖寬${Math.abs(shift) >= 0.05 ? `（偏${towardLeft ? '左' : '右'}）` : ''}`,
      });
      if (Math.abs(shift) >= HIP_SHIFT) {
        issues.push({ id: 'hipShift', level: 'warn', text: `最低點骨盆偏向你的${towardLeft ? '左' : '右'}邊` });
      }
    } else {
      // 深度：最低點附近大腿最低的那一格
      const depth = maxOver(track, Math.max(rep.start, rep.peak - 2), Math.min(rep.end, rep.peak + 2), (b) =>
        thighBelowHorizontal(b[s].hip, b[s].knee),
      );
      metrics.push({ label: '深度', value: depth >= 0 ? `低於平行 ${round(depth)}°` : `離平行還差 ${round(-depth)}°` });
      if (depth < PARALLEL_DEG) issues.push({ id: 'shallow', level: 'warn', text: `大腿離水平還差 ${round(-depth)}°` });

      const leanBottom = torsoLean(bottom[s].hip, bottom[s].shoulder);
      metrics.push({ label: '最低點軀幹前傾', value: `${round(leanBottom)}°` });

      // 起身到 40% 時，軀幹前傾有沒有比最低點多很多
      const rise = hipY(bottom) - hipY(end);
      const at = findFrame(track, rep.peak, rep.end, (b) => hipY(b) <= hipY(bottom) - rise * 0.4);
      const leanRise = torsoLean(track.bodies[at]![s].hip, track.bodies[at]![s].shoulder);
      if (leanRise - leanBottom >= GOOD_MORNING_DEG) {
        issues.push({ id: 'goodMorning', level: 'warn', text: `起身時軀幹多前傾了 ${round(leanRise - leanBottom)}°` });
      }

      // 腳跟：最低點比站著時高多少
      if ((start[s].heel.y - bottom[s].heel.y) / L >= HEEL_LIFT) {
        issues.push({ id: 'heelLift', level: 'warn', text: '最低點腳跟抬起' });
      }

      const w = framesFor(track, LOCKOUT_WINDOW / 2);
      const knee = maxOver(track, rep.end - w, rep.end + w, (b) => kneeAngle(b, s));
      const hip = maxOver(track, rep.end - w, rep.end + w, (b) => hipAngle(b, s));
      if (knee < LOCKOUT_KNEE || hip < LOCKOUT_HIP) {
        issues.push({ id: 'softLockout', level: 'info', text: `站起來時膝蓋 ${round(knee)}°、髖 ${round(hip)}°` });
      }
    }

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '下蹲時間', value: fmtSec(r.times.peak - r.times.start) });
    metrics.push({ label: '起身時間', value: fmtSec(r.times.end - r.times.peak) });
    return r;
  });
  return { reps: results, notes };
}

// ───────── 硬舉 ─────────

export function analyzeDeadlift(track: Track, options: ProfileOptions): PatternResult {
  const L = track.legLength;
  const s = track.side;
  // 槓的高度以手腕代替；值越大代表槓越高
  const reps = segmentReps(
    signalOf(track, (b) => -b[s].wrist.y),
    L * (options.rack ? 0.12 : 0.25),
    true,
  ).filter((rep) => {
    // 從地上拉起：離地時槓（手腕）要在膝蓋以下，拉起要花一點時間；不是的話多半是偵測跳動
    const b = track.bodies[rep.start]!;
    const pullTime = track.times[rep.peak]! - track.times[rep.start]!;
    return (options.rack || b[s].wrist.y > b[s].knee.y) && pullTime >= 0.3;
  });

  const results = reps.map((found, i) => {
    // 站直的那段時間：槓在最高點附近（離最高點不到 10% 腿長）；鎖定的時間點取第一次到達的那格
    const topY = track.bodies[found.peak]![s].wrist.y;
    const atTop = (b: Body) => b[s].wrist.y <= topY + L * 0.1;
    const rep = { ...found, peak: findFrame(track, found.start, found.peak, atTop) };
    const liftoff = track.bodies[rep.start]!;
    const metrics: Metric[] = [];
    const issues: Issue[] = [];

    if (!options.rack) {
      // 離地到槓過膝：髖上升的距離 ÷ 肩上升的距離。背的角度維持住時兩者差不多，
      // 臀部先起來時髖升得多、肩幾乎不動，軀幹變得更平
      const kneePass = findFrame(track, rep.start, rep.peak, (b) => b[s].wrist.y <= b[s].knee.y);
      const atKnee = track.bodies[kneePass]!;
      const hipRise = liftoff[s].hip.y - atKnee[s].hip.y;
      const shoulderRise = liftoff[s].shoulder.y - atKnee[s].shoulder.y;
      const elevation = (b: Body) =>
        (Math.atan2(b[s].hip.y - b[s].shoulder.y, b[s].shoulder.x - b[s].hip.x) * 180) / Math.PI;
      const flatter = elevation(liftoff) - elevation(atKnee);
      const riseRatio = shoulderRise > 0 ? hipRise / shoulderRise : Infinity;
      metrics.push({ label: '離地到槓過膝', value: `髖升高 ${pct(hipRise / L)}、肩升高 ${pct(shoulderRise / L)} 腿長` });
      if (flatter >= HIPS_FIRST_DEG || (hipRise > L * 0.05 && riseRatio >= HIPS_FIRST_RATIO)) {
        issues.push({
          id: 'hipsFirst',
          level: 'warn',
          text: `槓到膝蓋前，髖升高的距離是肩的 ${riseRatio === Infinity ? '好幾' : riseRatio.toFixed(1)} 倍`,
        });
      }
    }

    // 槓（手腕）和腳掌中間的水平距離
    const midfoot = mid(liftoff[s].heel, liftoff[s].toe).x;
    const drift = maxOver(track, rep.start, rep.peak, (b) => Math.abs(b[s].wrist.x - midfoot));
    metrics.push({ label: '槓偏離腳掌中間（最大）', value: `${pct(drift / L)} 腿長` });
    if (drift / L >= BAR_DRIFT) issues.push({ id: 'barDrift', level: 'warn', text: `槓最遠離腳掌中間 ${pct(drift / L)} 腿長` });

    addLockout(track, rep.start, rep.end, atTop, s, metrics, issues);

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '拉起時間', value: fmtSec(r.times.peak - r.times.start) });
    return r;
  });
  return { reps: results, notes: ['背有沒有拱起偵測不到（看不到脊椎的彎曲），請自己對照影片確認背部是否打直。'] };
}

/** 站直的那段時間有沒有鎖定、有沒有往後仰 */
function addLockout(
  track: Track,
  from: number,
  to: number,
  atTop: (b: Body) => boolean,
  s: Track['side'],
  metrics: Metric[],
  issues: Issue[],
): void {
  const top = (value: (b: Body) => number) => maxOver(track, from, to, (b) => (atTop(b) ? value(b) : -Infinity));
  const hip = top((b) => hipAngle(b, s));
  const knee = top((b) => kneeAngle(b, s));
  // 往後仰最多的那格（負數）
  const lean = -top((b) => -torsoLean(b[s].hip, b[s].shoulder));
  metrics.push({ label: '站直時髖／膝', value: `${round(hip)}°／${round(knee)}°` });
  if (lean <= -LEAN_BACK_DEG) {
    issues.push({ id: 'leanBack', level: 'warn', text: `上半身往後仰 ${round(-lean)}°` });
  } else if (hip < LOCKOUT_HIP || knee < LOCKOUT_KNEE) {
    issues.push({ id: 'noLockout', level: 'warn', text: `站直時髖 ${round(hip)}°、膝 ${round(knee)}°` });
  }
}

// ───────── 髖鉸鏈（羅馬尼亞硬舉、直腿硬舉、早安式） ─────────

export function analyzeHinge(track: Track, options: ProfileOptions): PatternResult {
  const L = track.legLength;
  const s = track.side;
  // 彎得越深，髖的角度越小
  const reps = segmentReps(
    signalOf(track, (b) => 180 - hipAngle(b, s)),
    30,
  );
  const results = reps.map((rep, i) => {
    const metrics: Metric[] = [];
    const issues: Issue[] = [];
    const bottom = track.bodies[rep.peak]!;

    // 膝蓋：站著和最低點的角度差
    const kneeTop = maxOver(track, rep.start - 2, rep.start + 2, (b) => kneeAngle(b, s));
    const kneeBottom = minOver(track, rep.peak - 2, rep.peak + 2, (b) => kneeAngle(b, s));
    const bend = kneeTop - kneeBottom;
    metrics.push({ label: '最低點軀幹前傾', value: `${round(torsoLean(bottom[s].hip, bottom[s].shoulder))}°` });
    metrics.push({ label: '膝蓋多彎了', value: `${round(bend)}°` });
    if (bend > (options.kneeBend ?? 35)) issues.push({ id: 'squatHinge', level: 'warn', text: `下去時膝蓋多彎了 ${round(bend)}°` });

    if (options.loaded) {
      const midfoot = mid(track.bodies[rep.start]![s].heel, track.bodies[rep.start]![s].toe).x;
      const drift = maxOver(track, rep.start, rep.end, (b) => Math.abs(b[s].wrist.x - midfoot));
      metrics.push({ label: '槓偏離腳掌中間（最大）', value: `${pct(drift / L)} 腿長` });
      if (drift / L >= BAR_DRIFT) issues.push({ id: 'barDrift', level: 'warn', text: `槓最遠離腳掌中間 ${pct(drift / L)} 腿長` });
    }

    // 回到站直的那段（彎的角度回到最淺附近）
    const w = framesFor(track, LOCKOUT_WINDOW / 2);
    addLockout(track, rep.end - w, rep.end + w, () => true, s, metrics, issues);

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '起身時間', value: fmtSec(r.times.end - r.times.peak) });
    return r;
  });
  return { reps: results, notes: ['背有沒有拱起偵測不到，請自己對照影片確認背部全程打直。'] };
}

// ───────── 弓箭步、分腿蹲 ─────────

export function analyzeLunge(track: Track): PatternResult {
  const L = track.legLength;
  const hipY = (b: Body) => mid(b.left.hip, b.right.hip).y;
  const reps = segmentReps(signalOf(track, hipY), L * 0.12);
  const results = reps.map((rep, i) => {
    const metrics: Metric[] = [];
    const issues: Issue[] = [];
    const bottom = track.bodies[rep.peak]!;
    // 前腳：腳踝比較前面的那一隻（側面已翻成面向右邊）
    const f = bottom.left.ankle.x >= bottom.right.ankle.x ? 'left' : 'right';
    const depth = maxOver(track, rep.peak - 2, rep.peak + 2, (b) => thighBelowHorizontal(b[f].hip, b[f].knee));
    metrics.push({ label: '前腳大腿', value: depth >= 0 ? `低於水平 ${round(depth)}°` : `離水平還差 ${round(-depth)}°` });
    if (depth < LUNGE_DEPTH) issues.push({ id: 'shallowLunge', level: 'warn', text: `前腳大腿離水平還差 ${round(-depth)}°` });

    const lean = torsoLean(bottom[track.side].hip, bottom[track.side].shoulder);
    metrics.push({ label: '最低點上半身前傾', value: `${round(lean)}°` });
    if (lean > LUNGE_LEAN) issues.push({ id: 'leanForward', level: 'info', text: `上半身前傾 ${round(lean)}°` });

    const past = (bottom[f].knee.x - bottom[f].toe.x) / L;
    if (past > KNEE_PAST_TOE) issues.push({ id: 'kneeForward', level: 'info', text: `膝蓋超過腳尖 ${pct(past)} 腿長` });

    const startHeel = track.bodies[rep.start]![f].heel.y;
    if ((startHeel - bottom[f].heel.y) / L >= HEEL_LIFT) {
      issues.push({ id: 'heelLift', level: 'warn', text: '前腳腳跟抬起' });
    }

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '起身時間', value: fmtSec(r.times.end - r.times.peak) });
    return r;
  });
  return { reps: results, notes: [] };
}

// ───────── 臀推、臀橋 ─────────

export function analyzeHipThrust(track: Track): PatternResult {
  const L = track.legLength;
  const s = track.side;
  // 臀部往上為深
  const reps = segmentReps(
    signalOf(track, (b) => -b[s].hip.y),
    L * 0.1,
  );
  const results = reps.map((rep, i) => {
    const metrics: Metric[] = [];
    const issues: Issue[] = [];
    const w = framesFor(track, 0.3);
    const straight = maxOver(track, rep.peak - w, rep.peak + w, (b) => hipAngle(b, s));
    // 髖在肩膝連線上方幾度（負數 = 在上方，腰往上拱）
    const arch = -minOver(track, rep.peak - w, rep.peak + w, (b) => bendBelow(b[s].shoulder, b[s].hip, b[s].knee));
    const top = track.bodies[rep.peak]!;
    const knee = angleAt(top[s].hip, top[s].knee, top[s].ankle);
    metrics.push({ label: '頂到最高時肩髖膝', value: `${round(straight)}°` });
    metrics.push({ label: '頂到最高時膝蓋', value: `${round(knee)}°` });
    if (arch >= THRUST_ARCH) issues.push({ id: 'overArch', level: 'warn', text: `髖比肩膝連線高了 ${round(arch)}°` });
    else if (straight < THRUST_LOCKOUT) issues.push({ id: 'hipNotExtended', level: 'warn', text: `肩、髖、膝只有 ${round(straight)}°` });
    if (knee > 115) issues.push({ id: 'feetPosition', level: 'info', text: '腳放得比較遠（膝蓋角度大）' });
    else if (knee < 65) issues.push({ id: 'feetPosition', level: 'info', text: '腳放得比較近（膝蓋角度小）' });

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '推起時間', value: fmtSec(r.times.peak - r.times.start) });
    return r;
  });
  return { reps: results, notes: [] };
}
