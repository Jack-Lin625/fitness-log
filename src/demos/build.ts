/**
 * 組合姿勢的共用工具：讓每個動作只要描述「髖在哪、軀幹幾度、手要到哪裡」，
 * 其餘關節（膝、肘、頭、腳掌）依固定的骨頭長度算出來。
 * 角度慣例見 kinematics.ts：0° 朝上、90° 朝前（畫面右邊）、180° 朝下。
 */
import { add, dir, headOn, lerp, reach, scale, toward, twoLink } from './kinematics';
import { BODY, easeInOut, type FarLimbs, type FrontLimbs, type FrontPose, type Pose, type Prop, type Vec } from './types';

export const ANKLE: Vec = { x: 96, y: 192 };
export const FLOOR = 198;
export const ARM = BODY.upperArm + BODY.forearm;
export const LEG = BODY.thigh + BODY.shin;

/** 腳掌：toeDeg 是腳尖的方向（90 = 平放朝前），腳底在腳踝下方 6 */
export function foot(ankle: Vec, toeDeg = 90): { heel: Vec; toe: Vec } {
  const down = dir(toeDeg + 90);
  return {
    heel: add(toward(ankle, toeDeg + 180, BODY.footBack), scale(down, 6)),
    toe: add(toward(ankle, toeDeg, BODY.footFront), scale(down, 6)),
  };
}

/** 墊腳尖：腳尖固定在 toe，腳跟抬起 lift 度（負值 = 腳跟比腳尖低），回傳腳踝與腳掌 */
export function tiptoe(toe: Vec, lift: number) {
  const toeDeg = 90 + lift;
  const down = dir(toeDeg + 90);
  const ankle = add(toward(toe, toeDeg + 180, BODY.footFront), scale(down, -6));
  return { ankle, ...foot(ankle, toeDeg) };
}

/** 手伸向目標（搆不到時伸直指向目標），回傳肘與手；prefer 決定手肘往哪邊彎 */
export function armTo(shoulder: Vec, target: Vec, prefer: (e: Vec) => number) {
  const hand = reach(shoulder, target);
  return { elbow: twoLink(shoulder, hand, BODY.upperArm, BODY.forearm, prefer), hand };
}

/** 用角度擺手臂：上臂、前臂各自的方向 */
export function armAngles(shoulder: Vec, upperDeg: number, foreDeg: number) {
  const elbow = toward(shoulder, upperDeg, BODY.upperArm);
  return { elbow, hand: toward(elbow, foreDeg, BODY.forearm) };
}

/** 腳踝固定、髖已知，算膝蓋（prefer 預設膝蓋往前） */
export function legTo(hip: Vec, ankle: Vec, prefer: (k: Vec) => number = (k) => k.x) {
  return twoLink(hip, ankle, BODY.thigh, BODY.shin, prefer);
}

/** 用角度擺腿：大腿、小腿各自的方向 */
export function legAngles(hip: Vec, thighDeg: number, shinDeg: number) {
  const knee = toward(hip, thighDeg, BODY.thigh);
  return { knee, ankle: toward(knee, shinDeg, BODY.shin) };
}

export interface SideSpec {
  hip: Vec;
  /** 軀幹方向（髖 → 肩） */
  torso: number;
  /** 頭相對軀幹的角度（正 = 低頭、負 = 抬頭） */
  headTilt?: number;
  /** 聳肩：肩膀沿軀幹往上提 */
  shrug?: number;
  /** 近側腿：膝與踝；只給踝時膝蓋用 kneePrefer 算 */
  ankle: Vec;
  knee?: Vec;
  kneePrefer?: (k: Vec) => number;
  /** 腳尖方向（預設 90 平放）；或直接給腳跟、腳尖 */
  toeDeg?: number;
  feet?: { heel: Vec; toe: Vec };
  /** 近側手：目標位置 + 手肘方向偏好；或用角度 */
  hand?: Vec;
  elbowPrefer?: (e: Vec) => number;
  arm?: [number, number];
  /** 遠側手腳 */
  far?: FarLimbs;
  bar?: Vec;
  props?: Prop[];
}

/** 由描述組出側面姿勢 */
export function side(spec: SideSpec): Pose {
  const { hip, ankle } = spec;
  const shoulder = toward(hip, spec.torso, BODY.torso + (spec.shrug ?? 0));
  const knee = spec.knee ?? legTo(hip, ankle, spec.kneePrefer);
  const arm = spec.arm
    ? armAngles(shoulder, spec.arm[0], spec.arm[1])
    : armTo(shoulder, spec.hand ?? toward(shoulder, 180, ARM), spec.elbowPrefer ?? ((e) => e.y));
  const pose: Pose = {
    hip,
    knee,
    ankle,
    ...(spec.feet ?? foot(ankle, spec.toeDeg ?? 90)),
    shoulder,
    ...headOn(shoulder, spec.torso, spec.headTilt ?? 0),
    ...arm,
  };
  if (spec.far) pose.far = spec.far;
  if (spec.bar) pose.bar = spec.bar;
  if (spec.props) pose.props = spec.props;
  return pose;
}

/** 站直時的髖位置（膝蓋微彎） */
export const STAND_HIP: Vec = { x: ANKLE.x - 1, y: ANKLE.y - LEG + 0.6 };

/** 遠側腿：腳踝位置已知，算膝蓋與腳掌 */
export function farLeg(hip: Vec, ankle: Vec, prefer: (k: Vec) => number = (k) => k.x, toeDeg = 90): FarLimbs {
  return { knee: legTo(hip, ankle, prefer), ankle, ...foot(ankle, toeDeg) };
}

/** 遠側手：目標位置已知 */
export function farArm(shoulder: Vec, target: Vec, prefer: (e: Vec) => number = (e) => e.y): FarLimbs {
  return armTo(shoulder, target, prefer);
}

/** 分段的進度：p 在 [a, b] 之間從 0 走到 1（加上緩動） */
export const phase = (p: number, a: number, b: number) => easeInOut(Math.min(1, Math.max(0, (p - a) / (b - a))));

export { lerp };

// ───────── 正面 ─────────

/**
 * 正面一側手腳的角度（畫面平面內，0 = 朝上、90 = 畫面右邊）。
 * *Fs 是往前後伸時從正面看到的縮短比例（1 = 完全在畫面平面內，0 = 正對觀看者）；
 * 負值代表投影跨過另一邊（例如夾胸時手往身體中線收）。
 */
export interface FrontSideSpec {
  upper: number;
  fore: number;
  thigh?: number;
  shin?: number;
  upperFs?: number;
  foreFs?: number;
  thighFs?: number;
  shinFs?: number;
}

export interface FrontSpec {
  pelvis: Vec;
  /** 脊椎方向（骨盆 → 肩膀中心），0 = 直立 */
  spine?: number;
  /** 軀幹的前後縮短（彎腰時從正面看軀幹變短） */
  torsoFs?: number;
  /** 骨盆左右傾斜 */
  pelvisTilt?: number;
  /** 假人左側（畫面右邊）、右側（畫面左邊） */
  l: FrontSideSpec;
  r: FrontSideSpec;
  props?: Prop[];
}

/** 正面站姿時骨盆的高度：腳尖剛好在地面 */
export const FRONT_PELVIS: Vec = { x: 100, y: FLOOR - 5 - LEG };

function frontLimbs(shoulder: Vec, hip: Vec, s: FrontSideSpec, outward: number): FrontLimbs {
  const elbow = toward(shoulder, s.upper, BODY.upperArm * (s.upperFs ?? 1));
  const hand = toward(elbow, s.fore, BODY.forearm * (s.foreFs ?? 1));
  // 預設雙腳微微張開（往外 3 度）
  const knee = toward(hip, s.thigh ?? 180 - outward * 3, BODY.thigh * (s.thighFs ?? 1));
  const ankle = toward(knee, s.shin ?? 180 - outward * 3, BODY.shin * (s.shinFs ?? 1));
  return { shoulder, elbow, hand, hip, knee, ankle, toe: { x: ankle.x + outward * 6, y: ankle.y + 5 } };
}

export function front(spec: FrontSpec): FrontPose {
  const spine = spec.spine ?? 0;
  const tilt = spec.pelvisTilt ?? 0;
  const center = toward(spec.pelvis, spine, BODY.torso * (spec.torsoFs ?? 1));
  const neck = toward(center, spine, BODY.neck);
  const pose: FrontPose = {
    pelvis: spec.pelvis,
    neck,
    head: toward(neck, spine, BODY.headR),
    l: frontLimbs(toward(center, spine + 90, BODY.shoulderHalf), toward(spec.pelvis, tilt + 90, BODY.hipHalf), spec.l, 1),
    r: frontLimbs(toward(center, spine - 90, BODY.shoulderHalf), toward(spec.pelvis, tilt - 90, BODY.hipHalf), spec.r, -1),
  };
  if (spec.props) pose.props = spec.props;
  return pose;
}

/** 正面手臂自然下垂 */
export const HANG: FrontSideSpec = { upper: 180, fore: 180 };
/** 鏡像：給假人左側的角度，算出右側的角度 */
export const mirror = (s: FrontSideSpec): FrontSideSpec => ({
  ...s,
  upper: -s.upper,
  fore: -s.fore,
  ...(s.thigh !== undefined ? { thigh: -s.thigh } : {}),
  ...(s.shin !== undefined ? { shin: -s.shin } : {}),
});
