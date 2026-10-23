/**
 * 深蹲、硬舉的動作檢查規則
 *
 * 只檢查從關節位置量得出來、而且量得準的項目。
 * 背有沒有拱起（脊椎彎曲）偵測不到，結果裡會提醒自己看影片。
 * 門檻刻意放寬：關節點本身有幾度的誤差，寧可少報也不要誤報。
 */
import type { FormAnalysis, FormExercise, Issue, IssueSummary, Metric, RepResult } from './types';
import {
  angleAt,
  buildTrack,
  dist,
  mid,
  segmentReps,
  thighBelowHorizontal,
  torsoLean,
  type Body,
  type PoseFrame,
  type Rep,
  type Track,
} from './track';

/** 每種問題的標題與修正建議 */
const CATALOG: Record<string, { title: string; advice: string }> = {
  shallow: {
    title: '沒蹲到平行',
    advice: '髖關節要蹲到和膝蓋同高或更低。蹲不下去時可以先減重量，或把腳站寬一點、腳尖朝外一點。',
  },
  goodMorning: {
    title: '起身時臀部先抬起來',
    advice: '起身時胸口和臀部要一起往上，不要變成彎腰的早安式。通常是重量太重或股四頭肌不夠力，可以先減重量。',
  },
  heelLift: {
    title: '腳跟離地',
    advice: '重心放在腳掌中間，整個腳掌踩穩。腳踝太緊的話可以穿舉重鞋或在腳跟墊小槓片。',
  },
  softLockout: {
    title: '最後沒有站直',
    advice: '每一下最後都要把膝蓋和髖完全打直再開始下一下。',
  },
  kneeCave: {
    title: '膝蓋往內夾',
    advice: '膝蓋要朝腳尖的方向推出去，特別是起身最用力的時候。可以先減重量，平常加強臀中肌（側躺抬腿、彈力帶側走）。',
  },
  hipShift: {
    title: '重心偏向一邊',
    advice: '蹲到底時骨盆偏向一側，可能是兩腳力量或柔軟度不平均。先減重量，注意兩腳平均出力。',
  },
  hipsFirst: {
    title: '臀部先起來（槓還沒離開小腿就先抬臀）',
    advice: '離地時胸口和臀部要一起往上，像腿推地板一樣。起始姿勢的髖可能放太低，或背部沒有繃緊。',
  },
  barDrift: {
    title: '槓離身體太遠',
    advice: '槓要貼著小腿和大腿往上，全程在腳掌中間的正上方。拉之前先把背闊肌繃緊，想像把槓往身體夾。',
  },
  noLockout: {
    title: '沒有站直鎖定',
    advice: '最後要把髖和膝蓋完全打直，臀部夾緊。',
  },
  leanBack: {
    title: '鎖定時往後仰',
    advice: '站直就好，不要把上半身往後仰，腰椎會承受多餘的壓力。用臀部夾緊來完成鎖定。',
  },
  slowdown: {
    title: '後面幾下明顯變慢',
    advice: '起身速度變慢很多代表已經接近力竭，這組的重量差不多是極限了。',
  },
};

// 門檻
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
/** 硬舉：槓和腳掌中間的水平距離超過腿長的這個比例 */
const BAR_DRIFT = 0.15;
/** 硬舉：鎖定時往後仰超過這麼多度 */
const LEAN_BACK_DEG = 12;
/** 起身時間比前兩下慢這麼多倍 */
const SLOWDOWN = 1.6;

const round = (v: number) => Math.round(v);
/** 每秒幾格 */
const fps = (track: Track) =>
  track.times.length > 1 ? (track.times.length - 1) / (track.times[track.times.length - 1]! - track.times[0]! || 1) : 15;
const fmtSec = (s: number) => `${s.toFixed(1)} 秒`;

/** 分析一段影片的偵測結果 */
export function analyzeForm(
  exercise: FormExercise,
  frames: PoseFrame[],
  size: { width: number; height: number },
): FormAnalysis {
  const empty = (error: string, notes: string[] = []): FormAnalysis => ({
    exercise,
    view: 'unknown',
    reps: [],
    summary: [],
    notes,
    error,
  });
  if (frames.length === 0) return empty('影片沒有可以分析的畫面');
  const track = buildTrack(frames, size);
  const notes: string[] = [];
  if (track.coverage < 0.3 || track.legLength <= 0) {
    return empty('偵測不到完整的人。請讓全身（包含腳）都在畫面裡，光線充足，背景不要有其他人。');
  }
  if (track.coverage < 0.7) notes.push('有些畫面偵測不到全身，結果可能不準。請確認腳和頭都在畫面裡。');

  if (exercise === 'deadlift' && track.view !== 'side') {
    return { ...empty('硬舉請從正側面拍（鏡頭對著身體側面，約膝蓋高度）。', notes), view: track.view };
  }
  if (track.view === 'unknown') {
    notes.push('拍攝角度是斜的，結果可能不準。深蹲請從正側面或正前方拍。');
  }

  const reps = exercise === 'squat' ? analyzeSquat(track) : analyzeDeadlift(track);
  if (reps.length === 0) {
    return {
      ...empty(
        exercise === 'squat'
          ? '找不到完整的一下深蹲。請錄完整的動作（從站著開始，蹲下再站起來）。'
          : '找不到完整的一下硬舉。請從槓在地上開始錄，到站直鎖定。',
        notes,
      ),
      view: track.view,
    };
  }
  addSlowdown(reps, exercise);
  if (exercise === 'squat' && track.view === 'front') notes.push('正面拍看得到膝蓋和左右平衡；蹲的深度要從側面拍才量得出來。');
  if (exercise === 'squat' && track.view === 'side') notes.push('膝蓋有沒有往內夾要從正面拍才看得到。');
  if (exercise === 'deadlift') notes.push('背有沒有拱起偵測不到（看不到脊椎的彎曲），請自己對照影片確認背部是否打直。');
  return { exercise, view: track.view, reps, summary: summarize(reps), notes, error: null };
}

/** 同一種問題彙整在一起，嚴重的排前面 */
function summarize(reps: RepResult[]): IssueSummary[] {
  const map = new Map<string, IssueSummary>();
  for (const r of reps) {
    for (const issue of r.issues) {
      const entry = map.get(issue.id);
      if (entry) entry.reps.push(r.index);
      else map.set(issue.id, { id: issue.id, level: issue.level, ...CATALOG[issue.id]!, reps: [r.index] });
    }
  }
  return [...map.values()].sort((a, b) => (a.level === b.level ? b.reps.length - a.reps.length : a.level === 'warn' ? -1 : 1));
}

function toResult(track: Track, rep: Rep, index: number, metrics: Metric[], issues: Issue[]): RepResult {
  return {
    ...rep,
    index,
    times: { start: track.times[rep.start]!, peak: track.times[rep.peak]!, end: track.times[rep.end]! },
    metrics,
    issues,
  };
}

/** 從 from 往 to 找第一個符合條件的格（找不到回傳 to） */
function findFrame(track: Track, from: number, to: number, ok: (b: Body) => boolean): number {
  const step = to >= from ? 1 : -1;
  for (let i = from; i !== to + step; i += step) {
    const b = track.bodies[i];
    if (b && ok(b)) return i;
  }
  return to;
}

/** 一段時間內最大的角度（站直鎖定會停一下，取最大值可以去掉單一格的偵測誤差） */
function maxAngle(track: Track, from: number, to: number, angle: (b: Body) => number): number {
  let best = -Infinity;
  for (let i = Math.max(0, from); i <= Math.min(track.bodies.length - 1, to); i++) {
    const b = track.bodies[i];
    if (b) best = Math.max(best, angle(b));
  }
  return best;
}

/** 起身（向心）的時間：深蹲是最低點到站直，硬舉是離地到鎖定 */
const concentric = (r: RepResult, exercise: FormExercise) =>
  exercise === 'squat' ? r.times.end - r.times.peak : r.times.peak - r.times.start;

/** 後面的起身時間比前兩下慢很多：接近力竭 */
function addSlowdown(reps: RepResult[], exercise: FormExercise): void {
  if (reps.length < 3) return;
  const base = (concentric(reps[0]!, exercise) + concentric(reps[1]!, exercise)) / 2;
  if (base <= 0) return;
  for (const r of reps.slice(2)) {
    const ratio = concentric(r, exercise) / base;
    if (ratio >= SLOWDOWN) r.issues.push({ id: 'slowdown', level: 'info', text: `比前兩下慢了 ${round((ratio - 1) * 100)}%` });
  }
}

// ───────── 深蹲 ─────────

function analyzeSquat(track: Track): RepResult[] {
  const L = track.legLength;
  const s = track.side;
  const front = track.view === 'front';
  const hipY = (b: Body) => (front ? mid(b.left.hip, b.right.hip).y : b[s].hip.y);
  const reps = segmentReps(
    track.bodies.map((b) => (b ? hipY(b) : null)),
    L * 0.2,
  );

  return reps.map((rep, i) => {
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
      let worst = Infinity;
      for (let k = rep.peak; k <= riseTo; k++) {
        const b = track.bodies[k];
        if (b) worst = Math.min(worst, ratio(b));
      }
      const drop = standing > 0 ? 1 - worst / standing : 0;
      metrics.push({ label: '膝距／踝距（最窄）', value: `${worst.toFixed(2)}（站著 ${standing.toFixed(2)}）` });
      if (drop >= KNEE_CAVE) issues.push({ id: 'kneeCave', level: 'warn', text: `起身時膝距比站著窄了 ${round(drop * 100)}%` });

      // 最低點時骨盆偏離兩腳中間多少（以髖寬為單位）；MediaPipe 的 left 是本人的左邊
      const hipMid = mid(bottom.left.hip, bottom.right.hip);
      const footMid = mid(bottom.left.ankle, bottom.right.ankle);
      const hipWidth = dist(bottom.left.hip, bottom.right.hip) || 1;
      const shift = (hipMid.x - footMid.x) / hipWidth;
      const towardLeft = Math.sign(shift) === Math.sign(bottom.left.hip.x - bottom.right.hip.x);
      metrics.push({ label: '最低點骨盆偏移', value: `${round(Math.abs(shift) * 100)}% 髖寬${Math.abs(shift) >= 0.05 ? `（偏${towardLeft ? '左' : '右'}）` : ''}` });
      if (Math.abs(shift) >= HIP_SHIFT) {
        issues.push({ id: 'hipShift', level: 'warn', text: `最低點骨盆偏向你的${towardLeft ? '左' : '右'}邊` });
      }
    } else {
      // 深度：最低點附近大腿最低的那一格
      let depth = -Infinity;
      for (let k = Math.max(rep.start, rep.peak - 2); k <= Math.min(rep.end, rep.peak + 2); k++) {
        const b = track.bodies[k];
        if (b) depth = Math.max(depth, thighBelowHorizontal(b[s].hip, b[s].knee));
      }
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
      const heelRise = (start[s].heel.y - bottom[s].heel.y) / track.legLength;
      if (heelRise >= HEEL_LIFT) issues.push({ id: 'heelLift', level: 'warn', text: '最低點腳跟抬起' });

      const lockFrom = rep.end - Math.round(LOCKOUT_WINDOW / 2 * fps(track));
      const lockTo = rep.end + Math.round(LOCKOUT_WINDOW / 2 * fps(track));
      const knee = maxAngle(track, lockFrom, lockTo, (b) => angleAt(b[s].hip, b[s].knee, b[s].ankle));
      const hip = maxAngle(track, lockFrom, lockTo, (b) => angleAt(b[s].shoulder, b[s].hip, b[s].knee));
      if (knee < LOCKOUT_KNEE || hip < LOCKOUT_HIP) {
        issues.push({ id: 'softLockout', level: 'info', text: `站起來時膝蓋 ${round(knee)}°、髖 ${round(hip)}°` });
      }
    }

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '下蹲時間', value: fmtSec(r.times.peak - r.times.start) });
    metrics.push({ label: '起身時間', value: fmtSec(r.times.end - r.times.peak) });
    return r;
  });
}

// ───────── 硬舉 ─────────

function analyzeDeadlift(track: Track): RepResult[] {
  const L = track.legLength;
  const s = track.side;
  // 槓的高度以手腕代替；值越大代表槓越高
  const reps = segmentReps(
    track.bodies.map((b) => (b ? -b[s].wrist.y : null)),
    L * 0.25,
    true,
  ).filter((rep) => {
    // 從地上拉起：離地時槓（手腕）要在膝蓋以下，拉起要花一點時間；不是的話多半是偵測跳動
    const b = track.bodies[rep.start]!;
    return b[s].wrist.y > b[s].knee.y && track.times[rep.peak]! - track.times[rep.start]! >= 0.3;
  });

  return reps.map((found, i) => {
    // 站直的那段時間：槓在最高點附近（離最高點不到 10% 腿長）；鎖定的時間點取第一次到達的那格
    const topY = track.bodies[found.peak]![s].wrist.y;
    const atTop = (b: Body) => b[s].wrist.y <= topY + L * 0.1;
    const rep = { ...found, peak: findFrame(track, found.start, found.peak, atTop) };
    const liftoff = track.bodies[rep.start]!;
    const metrics: Metric[] = [];
    const issues: Issue[] = [];

    // 離地到槓過膝：髖上升的距離 ÷ 肩上升的距離。背的角度維持住時兩者差不多，
    // 臀部先起來時髖升得多、肩幾乎不動，軀幹變得更平
    const kneePass = findFrame(track, rep.start, rep.peak, (b) => b[s].wrist.y <= b[s].knee.y);
    const atKnee = track.bodies[kneePass]!;
    const hipRise = liftoff[s].hip.y - atKnee[s].hip.y;
    const shoulderRise = liftoff[s].shoulder.y - atKnee[s].shoulder.y;
    const elevation = (b: Body) => (Math.atan2(b[s].hip.y - b[s].shoulder.y, b[s].shoulder.x - b[s].hip.x) * 180) / Math.PI;
    const flatter = elevation(liftoff) - elevation(atKnee);
    const riseRatio = shoulderRise > 0 ? hipRise / shoulderRise : Infinity;
    metrics.push({
      label: '離地到槓過膝',
      value: `髖升高 ${round((hipRise / L) * 100)}%、肩升高 ${round((shoulderRise / L) * 100)}% 腿長`,
    });
    if (flatter >= HIPS_FIRST_DEG || (hipRise > L * 0.05 && riseRatio >= HIPS_FIRST_RATIO)) {
      issues.push({
        id: 'hipsFirst',
        level: 'warn',
        text: `槓到膝蓋前，髖升高的距離是肩的 ${riseRatio === Infinity ? '好幾' : riseRatio.toFixed(1)} 倍`,
      });
    }

    // 槓（手腕）和腳掌中間的水平距離
    const midfoot = mid(liftoff[s].heel, liftoff[s].toe).x;
    let drift = 0;
    for (let k = rep.start; k <= rep.peak; k++) {
      const b = track.bodies[k];
      if (b) drift = Math.max(drift, Math.abs(b[s].wrist.x - midfoot));
    }
    metrics.push({ label: '槓偏離腳掌中間（最大）', value: `${round((drift / L) * 100)}% 腿長` });
    if (drift / L >= BAR_DRIFT) issues.push({ id: 'barDrift', level: 'warn', text: `槓最遠離腳掌中間 ${round((drift / L) * 100)}% 腿長` });

    const lockAngle = (angle: (b: Body) => number) =>
      maxAngle(track, rep.start, rep.end, (b) => (atTop(b) ? angle(b) : -Infinity));
    const hip = lockAngle((b) => angleAt(b[s].shoulder, b[s].hip, b[s].knee));
    const knee = lockAngle((b) => angleAt(b[s].hip, b[s].knee, b[s].ankle));
    // 往後仰最多的那格（負數）
    const lean = -lockAngle((b) => -torsoLean(b[s].hip, b[s].shoulder));

    metrics.push({ label: '鎖定時髖／膝', value: `${round(hip)}°／${round(knee)}°` });
    if (lean <= -LEAN_BACK_DEG) {
      issues.push({ id: 'leanBack', level: 'warn', text: `上半身往後仰 ${round(-lean)}°` });
    } else if (hip < LOCKOUT_HIP || knee < LOCKOUT_KNEE) {
      issues.push({ id: 'noLockout', level: 'warn', text: `鎖定時髖 ${round(hip)}°、膝 ${round(knee)}°` });
    }

    const r = toResult(track, rep, i + 1, metrics, issues);
    metrics.push({ label: '拉起時間', value: fmtSec(r.times.peak - r.times.start) });
    return r;
  });
}
