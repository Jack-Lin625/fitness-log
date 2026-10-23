/**
 * 動作檢查的前處理：把 MediaPipe 每一格的關節點整理成可以計算的軌跡
 *
 * - 座標換成像素（x、y 同一個比例，角度才算得準），y 往下增加
 * - 側面拍時選看得比較清楚的那一側，並把畫面左右翻成「面向右邊」，之後的計算不用管方向
 * - 偶爾一兩格偵測不到就用前後內插；連續太久偵測不到就留空
 * - 前後各一格平均，去掉抖動
 */

/** MediaPipe 的一個關節點（x、y 是 0–1 的畫面比例） */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** 影片某一格的偵測結果 */
export interface PoseFrame {
  /** 秒 */
  t: number;
  /** 33 個關節點；沒偵測到人為 null */
  landmarks: Landmark[] | null;
}

export interface Vec {
  x: number;
  y: number;
}

/** BlazePose 的關節編號 */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFoot: 31,
  rightFoot: 32,
} as const;

const JOINTS = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'heel', 'toe'] as const;
export type Joint = (typeof JOINTS)[number];
type Side = 'left' | 'right';

const INDEX: Record<Side, Record<Joint, number>> = {
  left: {
    shoulder: LM.leftShoulder,
    elbow: LM.leftElbow,
    wrist: LM.leftWrist,
    hip: LM.leftHip,
    knee: LM.leftKnee,
    ankle: LM.leftAnkle,
    heel: LM.leftHeel,
    toe: LM.leftFoot,
  },
  right: {
    shoulder: LM.rightShoulder,
    elbow: LM.rightElbow,
    wrist: LM.rightWrist,
    hip: LM.rightHip,
    knee: LM.rightKnee,
    ankle: LM.rightAnkle,
    heel: LM.rightHeel,
    toe: LM.rightFoot,
  },
};

/** 一格裡兩側的關節（像素座標） */
export type Body = Record<Side, Record<Joint, Vec>>;

export type View = 'side' | 'front' | 'unknown';

export interface Track {
  times: number[];
  /** 每一格的身體；偵測不到為 null */
  bodies: (Body | null)[];
  /** 側面拍時用來計算的那一側（離鏡頭近的） */
  side: Side;
  view: View;
  /** 大腿 + 小腿的長度（像素），用來把距離換成「幾分之幾腿長」 */
  legLength: number;
  /** 有偵測到全身的格數比例 */
  coverage: number;
}

/** 判斷全身有沒有偵測到用的關節 */
const KEY_JOINTS: Joint[] = ['shoulder', 'hip', 'knee', 'ankle'];
const MIN_VISIBILITY = 0.5;
/** 偵測不到的空檔在這個秒數以內才內插 */
const MAX_GAP_SEC = 0.5;

const vis = (l: Landmark | undefined) => l?.visibility ?? 1;
const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** 某一側的關節都看得清楚嗎 */
function sideScore(lms: Landmark[], side: Side): number {
  return KEY_JOINTS.reduce((n, j) => n + vis(lms[INDEX[side][j]]), 0) / KEY_JOINTS.length;
}

/** 偵測結果 → 軌跡 */
export function buildTrack(frames: PoseFrame[], size: { width: number; height: number }): Track {
  const times = frames.map((f) => f.t);
  // 1. 哪一側比較清楚（側面拍時近側的可信度高）
  let left = 0;
  let right = 0;
  for (const f of frames) {
    if (!f.landmarks) continue;
    left += sideScore(f.landmarks, 'left');
    right += sideScore(f.landmarks, 'right');
  }
  const side: Side = left >= right ? 'left' : 'right';

  // 2. 換成像素；全身偵測不到的格留空
  const raw: (Body | null)[] = frames.map((f) => {
    const lms = f.landmarks;
    if (!lms || lms.length < 33 || Math.max(sideScore(lms, 'left'), sideScore(lms, 'right')) < MIN_VISIBILITY) return null;
    const pick = (s: Side) =>
      Object.fromEntries(
        JOINTS.map((j) => {
          const l = lms[INDEX[s][j]]!;
          return [j, { x: l.x * size.width, y: l.y * size.height }];
        }),
      ) as Record<Joint, Vec>;
    return { left: pick('left'), right: pick('right') };
  });
  const valid = raw.filter(Boolean).length;
  const coverage = frames.length ? valid / frames.length : 0;

  // 3. 拍攝角度：兩肩的水平距離 ÷ 軀幹長度（側面時兩肩幾乎重疊）
  const ratios: number[] = [];
  for (const b of raw) {
    if (!b) continue;
    const torso = dist(mid(b.left.shoulder, b.right.shoulder), mid(b.left.hip, b.right.hip));
    if (torso > 0) ratios.push(Math.abs(b.left.shoulder.x - b.right.shoulder.x) / torso);
  }
  const ratio = median(ratios);
  const view: View = ratios.length === 0 ? 'unknown' : ratio < 0.3 ? 'side' : ratio > 0.55 ? 'front' : 'unknown';

  // 4. 側面時翻成面向右邊（腳尖在腳跟的右邊）
  if (view === 'side') {
    const facing = median(raw.filter((b): b is Body => !!b).map((b) => b[side].toe.x - b[side].heel.x));
    if (facing < 0) {
      for (const b of raw) {
        if (!b) continue;
        for (const s of ['left', 'right'] as const) for (const j of JOINTS) b[s][j] = { x: -b[s][j].x, y: b[s][j].y };
      }
    }
  }

  const bodies = smooth(interpolate(raw, times), times);
  const legs = bodies
    .filter((b): b is Body => !!b)
    .map((b) => dist(b[side].hip, b[side].knee) + dist(b[side].knee, b[side].ankle));
  return { times, bodies, side, view, legLength: median(legs), coverage };
}

function lerpBody(a: Body, b: Body, k: number): Body {
  const out = { left: {}, right: {} } as Body;
  for (const s of ['left', 'right'] as const) {
    for (const j of JOINTS) {
      out[s][j] = { x: a[s][j].x + (b[s][j].x - a[s][j].x) * k, y: a[s][j].y + (b[s][j].y - a[s][j].y) * k };
    }
  }
  return out;
}

/** 短暫偵測不到的格用前後內插 */
function interpolate(bodies: (Body | null)[], times: number[]): (Body | null)[] {
  const out = [...bodies];
  let last = -1;
  for (let i = 0; i < bodies.length; i++) {
    if (!bodies[i]) continue;
    if (last >= 0 && i - last > 1 && times[i]! - times[last]! <= MAX_GAP_SEC) {
      for (let k = last + 1; k < i; k++) {
        out[k] = lerpBody(bodies[last]!, bodies[i]!, (times[k]! - times[last]!) / (times[i]! - times[last]!));
      }
    }
    last = i;
  }
  return out;
}

/** 前後各一格平均（有缺的就只用有的） */
function smooth(bodies: (Body | null)[], times: number[]): (Body | null)[] {
  void times;
  return bodies.map((b, i) => {
    if (!b) return null;
    const near = [bodies[i - 1], b, bodies[i + 1]].filter((x): x is Body => !!x);
    const out = { left: {}, right: {} } as Body;
    for (const s of ['left', 'right'] as const) {
      for (const j of JOINTS) {
        out[s][j] = {
          x: near.reduce((n, x) => n + x[s][j].x, 0) / near.length,
          y: near.reduce((n, x) => n + x[s][j].y, 0) / near.length,
        };
      }
    }
    return out;
  });
}

// ───────── 角度 ─────────

const DEG = 180 / Math.PI;

/** b 點的夾角（度，0–180） */
export function angleAt(a: Vec, b: Vec, c: Vec): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) || 1) * (Math.hypot(v2.x, v2.y) || 1));
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
}

/** 軀幹（髖 → 肩）和垂直線的角度；往前傾為正、往後仰為負（面向右邊） */
export function torsoLean(hip: Vec, shoulder: Vec): number {
  return Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * DEG;
}

/** 大腿低於水平幾度（髖比膝低為正） */
export function thighBelowHorizontal(hip: Vec, knee: Vec): number {
  return Math.atan2(hip.y - knee.y, Math.abs(knee.x - hip.x)) * DEG;
}

// ───────── 切出每一下 ─────────

export interface Rep {
  /** 開始動作的那一格 */
  start: number;
  /** 最深（深蹲最低點、硬舉站直）的那一格 */
  peak: number;
  /** 回到起點的那一格 */
  end: number;
}

/**
 * 依「深度」訊號切出每一下：值越大代表越深（深蹲是髖的高度往下、硬舉是槓往上）。
 * 用遲滯（進入、離開用不同門檻）避免抖動被算成很多下。
 * minRange：最深與最淺至少要差這麼多才算有在做動作。
 * openEnd：影片在最深處結束（硬舉站直鎖定後就停止錄影）也算一下，end 是最後一格。
 */
export function segmentReps(signal: (number | null)[], minRange: number, openEnd = false): Rep[] {
  const values = signal.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (values.length < 5) return [];
  const top = values[Math.floor(values.length * 0.05)]!;
  const bottom = values[Math.floor(values.length * 0.95)]!;
  const range = bottom - top;
  if (range < minRange) return [];
  const enter = top + range * 0.45;
  const exit = top + range * 0.2;

  const reps: Rep[] = [];
  let down = false;
  let start = -1;
  let peak = -1;
  let lastShallow = -1;
  for (let i = 0; i < signal.length; i++) {
    const v = signal[i];
    if (v === null || v === undefined) continue;
    if (!down) {
      if (v <= exit) lastShallow = i;
      if (v >= enter) {
        down = true;
        // 往回找到真正開始動的那一格（還在原地時的值幾乎不變）
        start = lastShallow;
        while (start > 0 && signal[start - 1] !== null && signal[start - 1]! < signal[start]! - range * 0.02) start--;
        peak = i;
      }
    } else {
      if (v > signal[peak]!) peak = i;
      if (v <= exit) {
        // 回到起點後再往前找到真正最淺的那格
        let end = i;
        while (end + 1 < signal.length && signal[end + 1] !== null && signal[end + 1]! < signal[end]!) end++;
        if (start >= 0) reps.push({ start, peak, end });
        down = false;
        lastShallow = end;
        i = end;
      }
    }
  }
  if (openEnd && down && start >= 0 && signal[peak]! >= top + range * 0.85) {
    let end = signal.length - 1;
    while (end > peak && signal[end] === null) end--;
    reps.push({ start, peak, end });
  }
  return reps;
}
