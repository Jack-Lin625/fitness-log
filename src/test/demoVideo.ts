/**
 * 測試用：把假人示範變成 MediaPipe 格式的偵測結果（姿勢檢查的測試資料）
 * 側面示範：假人面向右邊、左側靠近鏡頭；正面示範：l 是假人的左側（畫面右邊）。
 */
import { easeInOut, type Demo, type FrontPose, type Pose, type Vec } from '../demos/types';
import { LM, type Landmark, type PoseFrame } from '../lib/formCheck/track';

export const DEMO_SIZE = { width: 200, height: 240 };
export const DEMO_FPS = 15;
/** 假人的座標往下移一點，讓舉過頭的動作也在畫面裡 */
const OFFSET_Y = 20;

function put(lms: Landmark[], i: number, v: Vec, visibility: number, mirror: boolean) {
  const x = mirror ? DEMO_SIZE.width - v.x : v.x;
  lms[i] = { x: x / DEMO_SIZE.width, y: (v.y + OFFSET_Y) / DEMO_SIZE.height, visibility };
}

export function sideLandmarks(pose: Pose, mirror = false): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.2 }));
  const far = pose.far ?? {};
  // 鼻子在頭的前方
  put(lms, LM.nose, { x: pose.head.x + 7, y: pose.head.y + 2 }, 0.9, mirror);
  const joints: [number, Vec, Vec | undefined][] = [
    [LM.leftShoulder, pose.shoulder, undefined],
    [LM.leftElbow, pose.elbow, far.elbow],
    [LM.leftWrist, pose.hand, far.hand],
    [LM.leftHip, pose.hip, undefined],
    [LM.leftKnee, pose.knee, far.knee],
    [LM.leftAnkle, pose.ankle, far.ankle],
    [LM.leftHeel, pose.heel, far.heel],
    [LM.leftFoot, pose.toe, far.toe],
  ];
  for (const [i, near, farV] of joints) {
    put(lms, i, near, 0.95, mirror);
    // 遠側：有給就用，沒有就幾乎重疊在後面
    put(lms, i + 1, farV ?? { x: near.x - 1.5, y: near.y }, 0.6, mirror);
  }
  return lms;
}

export function frontLandmarks(pose: FrontPose): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.2 }));
  put(lms, LM.nose, { x: pose.head.x, y: pose.head.y + 3 }, 0.95, false);
  for (const [o, limbs] of [
    [0, pose.l],
    [1, pose.r],
  ] as const) {
    put(lms, LM.leftShoulder + o, limbs.shoulder, 0.95, false);
    put(lms, LM.leftElbow + o, limbs.elbow, 0.95, false);
    put(lms, LM.leftWrist + o, limbs.hand, 0.95, false);
    put(lms, LM.leftHip + o, limbs.hip, 0.95, false);
    put(lms, LM.leftKnee + o, limbs.knee, 0.95, false);
    put(lms, LM.leftAnkle + o, limbs.ankle, 0.95, false);
    put(lms, LM.leftHeel + o, { x: limbs.ankle.x, y: limbs.ankle.y + 4 }, 0.95, false);
    put(lms, LM.leftFoot + o, limbs.toe, 0.95, false);
  }
  return lms;
}

/** 示範一下的進度：頂部停留 → 下 → 底部停留 → 上 */
export function demoProgress(demo: Demo, t: number): number {
  const { down, bottomHold, up, topHold } = demo.timing;
  const total = topHold + down + bottomHold + up;
  const x = t % total;
  if (x < topHold) return 0;
  if (x < topHold + down) return easeInOut((x - topHold) / down);
  if (x < topHold + down + bottomHold) return 1;
  return 1 - easeInOut((x - topHold - down - bottomHold) / up);
}

export const repSeconds = (demo: Demo) => demo.timing.topHold + demo.timing.down + demo.timing.bottomHold + demo.timing.up;

/** 示範做 reps 下（最後停在起始姿勢） */
export function demoVideo(demo: Demo, reps = 3, progress: (p: number, t: number) => number = (p) => p): PoseFrame[] {
  const duration = repSeconds(demo) * reps + demo.timing.topHold;
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= duration * DEMO_FPS; i++) {
    const t = i / DEMO_FPS;
    const p = progress(demoProgress(demo, t), t);
    const pose = demo.pose(p);
    frames.push({ t, landmarks: demo.kind === 'front' ? frontLandmarks(pose as FrontPose) : sideLandmarks(pose as Pose) });
  }
  return frames;
}

/** 固定姿勢撐 seconds 秒（棒式） */
export function holdVideo(demo: Demo, p: number, seconds: number): PoseFrame[] {
  const pose = demo.pose(p);
  return Array.from({ length: Math.round(seconds * DEMO_FPS) + 1 }, (_, i) => ({
    t: i / DEMO_FPS,
    landmarks: demo.kind === 'front' ? frontLandmarks(pose as FrontPose) : sideLandmarks(pose as Pose),
  }));
}
