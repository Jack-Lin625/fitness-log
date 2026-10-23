/**
 * 槓鈴大重量動作的假人示範
 * 和深蹲一樣，身體角度由力學限制算出（例如槓鈴維持在腳掌中心上方），不是隨手畫的。
 * 座標與角度慣例見 demos/types.ts、demos/kinematics.ts。
 */
import { headOn, lerp, lerpVec, reach, toward, twoLink, feet, sub } from './kinematics';
import { BODY, type Demo, type Pose, type Vec } from './types';

const ANKLE: Vec = { x: 96, y: 192 };
/** 腳掌中心：槓鈴與重心應該落在這條線上 */
export const MIDFOOT = ANKLE.x + 5;
const FLOOR = 198;
/** 畫面上槓片的半徑（和 Mannequin 的 mq-plate 一致） */
export const PLATE_R = 15;
const ARM = BODY.upperArm + BODY.forearm;

const midfootGuide = () => ({ x: MIDFOOT, label: '腳掌中心' });

/** 向量的角度（0° 朝上、90° 朝前） */
const angleOf = (v: Vec) => (Math.atan2(v.x, -v.y) * 180) / Math.PI;

/** 手臂伸直時手肘的位置 */
const straightElbow = (shoulder: Vec, hand: Vec) => lerpVec(shoulder, hand, BODY.upperArm / ARM);

/** 站姿下半身：已知髖與腳踝，膝蓋往前彎 */
function standingLegs(hip: Vec) {
  return { knee: twoLink(ANKLE, hip, BODY.shin, BODY.thigh, (k) => k.x), ankle: ANKLE, ...feet(ANKLE) };
}

/**
 * 髖關節鉸鏈（羅馬尼亞硬舉、划船）：
 * 已知膝蓋、軀幹前傾角與手臂角度，解出讓槓鈴落在腳掌中心正上方的髖位置。
 */
export function hinge(knee: Vec, torsoDeg: number, armDeg: number) {
  const armRad = (armDeg * Math.PI) / 180;
  const torsoRad = (torsoDeg * Math.PI) / 180;
  const hipX = MIDFOOT + ARM * Math.sin(armRad) - BODY.torso * Math.sin(torsoRad);
  const dx = Math.max(-BODY.thigh + 0.5, Math.min(BODY.thigh - 0.5, hipX - knee.x));
  const hip = { x: knee.x + dx, y: knee.y - Math.sqrt(BODY.thigh ** 2 - dx ** 2) };
  const shoulder = toward(hip, torsoDeg, BODY.torso);
  return { hip, shoulder };
}

// ───────── 硬舉 ─────────

export function deadliftPose(p: number): Pose {
  // 槓鈴：站直時在大腿前方，最低點槓片貼地；全程在腳掌中心正上方
  const bar = { x: MIDFOOT, y: lerp(96, FLOOR - PLATE_R, p) };
  // 手臂垂直握槓，最低點時肩膀略在槓的前方
  const shoulder = toward(bar, lerp(0, 8, p), ARM);
  // 髖的高度隨深度下降，軀幹長度固定 → 算出髖往後多少
  const hipY = lerp(104, 165, p);
  const dy = Math.min(BODY.torso, hipY - shoulder.y);
  const hip = { x: shoulder.x - Math.sqrt(BODY.torso ** 2 - dy ** 2), y: hipY };
  const torso = angleOf(sub(shoulder, hip));
  return {
    ...standingLegs(hip),
    hip,
    shoulder,
    ...headOn(shoulder, torso, 6),
    elbow: straightElbow(shoulder, bar),
    hand: bar,
    bar,
  };
}

export const deadliftDemo: Demo = {
  pose: deadliftPose,
  timing: { down: 1.6, bottomHold: 0.5, up: 1.3, topHold: 0.6 },
  captions: {
    down: '髖先往後推，槓沿著腿放回地面',
    bottom: '槓在地面：小腿貼槓、胸口挺起、背打直',
    up: '推地站起，槓貼著腿往上',
    top: '站直鎖定，臀部夾緊，不要往後仰',
  },
  guideX: midfootGuide,
  labels: { start: '站直', end: '槓在地面' },
};

// ───────── 羅馬尼亞硬舉 ─────────

function rdlPose(p: number): Pose {
  // 膝蓋微彎且固定，動作全部在髖（站直時膝蓋略在髖的前方，不會反折）
  const knee = toward(ANKLE, 7, BODY.shin);
  const torsoDeg = lerp(0, 70, p);
  const armDeg = lerp(0, 10, p);
  const { hip, shoulder } = hinge(knee, torsoDeg, armDeg);
  const bar = toward(shoulder, 180 + armDeg, ARM);
  return {
    knee,
    ankle: ANKLE,
    ...feet(ANKLE),
    hip,
    shoulder,
    ...headOn(shoulder, torsoDeg, 4),
    elbow: straightElbow(shoulder, bar),
    hand: bar,
    bar,
  };
}

export const rdlDemo: Demo = {
  pose: rdlPose,
  timing: { down: 2, bottomHold: 0.4, up: 1.3, topHold: 0.6 },
  captions: {
    down: '膝蓋角度固定，臀部往後推，槓沿著大腿下滑',
    bottom: '腿後有伸展感就停，背仍保持平直',
    up: '臀部往前推，站直',
    top: '站直，臀部夾緊',
  },
  guideX: midfootGuide,
  labels: { start: '站直', end: '最低點' },
};

// ───────── 槓鈴划船 ─────────

const ROW_TORSO = 50;
/** 手臂自然下垂時肩膀略在槓的前方；若垂直，髖要退很遠，膝蓋會彎成半蹲 */
const ROW_ARM = 10;
const rowKnee = toward(ANKLE, 5, BODY.shin);
const rowBody = hinge(rowKnee, ROW_TORSO, ROW_ARM);

function rowPose(p: number): Pose {
  const { hip, shoulder } = rowBody;
  // 起點：手臂伸直，槓在腳掌中心上方；終點：槓拉到肚臍附近（軀幹前側）
  const hang = toward(shoulder, 180 + ROW_ARM, ARM);
  const belly = toward(lerpVec(shoulder, hip, 0.6), ROW_TORSO + 90, 10);
  const bar = lerpVec(hang, belly, p);
  return {
    knee: rowKnee,
    ankle: ANKLE,
    ...feet(ANKLE),
    hip,
    shoulder,
    ...headOn(shoulder, ROW_TORSO, 8),
    // 手肘往後上方
    elbow: twoLink(shoulder, bar, BODY.upperArm, BODY.forearm, (e) => -e.y),
    hand: bar,
    bar,
  };
}

export const rowDemo: Demo = {
  pose: rowPose,
  timing: { down: 0.9, bottomHold: 0.5, up: 1.4, topHold: 0.4 },
  captions: {
    down: '手肘往後上方拉，槓拉向肚臍',
    bottom: '頂端夾緊肩胛停一下',
    up: '慢慢放下到手臂伸直',
    top: '上身角度不變，背部保持平直',
  },
  guideX: midfootGuide,
  labels: { start: '手臂伸直', end: '拉到肚臍' },
};

// ───────── 肩推 ─────────

const pressKnee = toward(ANKLE, 2, BODY.shin);
const pressHip = toward(pressKnee, 0, BODY.thigh);

function pressPose(p: number): Pose {
  const swing = Math.sin(Math.PI * p);
  // 槓經過臉時，身體微微後仰、頭往後讓出路線
  const torsoDeg = -3 - 4 * swing;
  const shoulder = toward(pressHip, torsoDeg, BODY.torso);
  const rack = { x: shoulder.x + 9, y: shoulder.y - 4 };
  const lockout = { x: shoulder.x + 2, y: shoulder.y - ARM + 1 };
  const bar = lerpVec(rack, lockout, p);
  return {
    knee: pressKnee,
    ankle: ANKLE,
    ...feet(ANKLE),
    hip: pressHip,
    shoulder,
    ...headOn(shoulder, torsoDeg - 10 * swing),
    // 手肘在槓的前下方
    elbow: twoLink(shoulder, bar, BODY.upperArm, BODY.forearm, (e) => e.x),
    hand: bar,
    bar,
  };
}

export const pressDemo: Demo = {
  pose: pressPose,
  timing: { down: 1.1, bottomHold: 0.5, up: 1.5, topHold: 0.5 },
  captions: {
    down: '頭往後讓，槓直直往上推',
    bottom: '推到頂端，頭回到手臂之間',
    up: '控制著放回肩膀前方',
    top: '吸氣撐住，臀部和腹部收緊',
  },
  guideX: midfootGuide,
  labels: { start: '架在肩上', end: '推到頭頂' },
  view: { top: -40, height: 250 },
};

// ───────── 臥推 ─────────

const BENCH_SHOULDER: Vec = { x: 48, y: 140 };
const BENCH_HIP = toward(BENCH_SHOULDER, 92, BODY.torso);
const BENCH_ANKLE: Vec = { x: 150, y: 192 };

function benchPose(p: number): Pose {
  const shoulder = BENCH_SHOULDER;
  // 頂端在肩膀正上方，最低點落在胸口下緣
  const lockout = { x: shoulder.x + 4, y: shoulder.y - ARM + 1 };
  const chest = { x: shoulder.x + 16, y: shoulder.y - 9 };
  const bar = lerpVec(lockout, chest, p);
  return {
    knee: twoLink(BENCH_HIP, BENCH_ANKLE, BODY.thigh, BODY.shin, (k) => -k.y),
    ankle: BENCH_ANKLE,
    ...feet(BENCH_ANKLE),
    hip: BENCH_HIP,
    shoulder,
    ...headOn(shoulder, angleOf(sub(shoulder, BENCH_HIP))),
    // 手肘往下（地面方向）
    elbow: twoLink(shoulder, bar, BODY.upperArm, BODY.forearm, (e) => e.y),
    hand: bar,
    bar,
  };
}

export const benchDemo: Demo = {
  pose: benchPose,
  timing: { down: 1.5, bottomHold: 0.3, up: 1.1, topHold: 0.6 },
  captions: {
    down: '吸氣撐住，槓放到胸口下緣',
    bottom: '輕觸胸口，肩胛保持夾緊',
    up: '腳推地，把槓推回肩膀上方',
    top: '手臂伸直，準備下一下',
  },
  bench: { x1: 22, x2: 126, y: 146 },
  labels: { start: '手臂伸直', end: '槓碰胸口' },
};

// ───────── 臀推 ─────────

/** 上背靠在椅子邊緣，當作支點 */
const THRUST_SHOULDER: Vec = { x: 60, y: 140 };
const THRUST_ANKLE: Vec = { x: 161, y: 192 };

function hipThrustPose(p: number): Pose {
  const torsoDeg = lerp(130, 92, p);
  const shoulder = THRUST_SHOULDER;
  const hip = toward(shoulder, torsoDeg, BODY.torso);
  // 槓鈴壓在髖部上方
  const bar = toward(hip, torsoDeg - 90, 13);
  const hand = reach(shoulder, bar);
  return {
    knee: twoLink(hip, THRUST_ANKLE, BODY.thigh, BODY.shin, (k) => -k.y),
    ankle: THRUST_ANKLE,
    ...feet(THRUST_ANKLE),
    hip,
    shoulder,
    // 下巴微收：頭朝前上方，不往後仰
    ...headOn(shoulder, torsoDeg - 180 + 35),
    elbow: twoLink(shoulder, hand, BODY.upperArm, BODY.forearm, (e) => -e.y),
    hand,
    bar,
  };
}

export const hipThrustDemo: Demo = {
  pose: hipThrustPose,
  timing: { down: 1, bottomHold: 0.6, up: 1.4, topHold: 0.4 },
  captions: {
    down: '腳跟推地，把髖往上頂',
    bottom: '頂端：肩膀到膝蓋一直線，臀部夾緊',
    up: '慢慢放下，下巴保持微收',
    top: '臀部放低，準備下一下',
  },
  bench: { x1: 8, x2: 64, y: 146 },
  labels: { start: '臀部在下', end: '頂到最高' },
};
