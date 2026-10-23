import { twoLink } from './kinematics';
import { BODY, rad, type Demo, type Pose, type Vec } from './types';

const ANKLE: Vec = { x: 96, y: 192 };
/** 槓鈴相對於肩關節往後的距離（高槓位：放在上斜方肌上） */
const BAR_BACK = 5;

/**
 * 槓鈴背蹲舉
 * p = 0 站直，p = 1 蹲到大腿約略低於水平。
 * 小腿前傾角、大腿角度由 p 決定；上半身前傾角用「槓鈴在腳掌中心正上方」反推，
 * 這就是正確深蹲時身體前傾的力學原因，所以前傾角度是算出來的，不是亂畫的。
 */
function pose(p: number): Pose {
  // 站直時小腿也有一點點前傾（重心在腳掌中心，不在腳跟）
  const s = rad(5 + 29 * p); // 小腿前傾
  const t = rad(100 * p); // 大腿從垂直往後轉
  const ankle = ANKLE;
  const knee = { x: ankle.x + BODY.shin * Math.sin(s), y: ankle.y - BODY.shin * Math.cos(s) };
  const hip = { x: knee.x - BODY.thigh * Math.sin(t), y: knee.y - BODY.thigh * Math.cos(t) };

  // 腳掌中心（重心應該落在這裡）
  const midfoot = ankle.x + 5;

  // 解上半身前傾角 b：讓 槓鈴.x = 肩.x − BAR_BACK·cos(b) ≈ 腳掌中心
  let b = 0;
  for (let i = 0; i < 6; i++) {
    const target = (midfoot - hip.x + BAR_BACK * Math.cos(b)) / BODY.torso;
    b = Math.asin(Math.max(-1, Math.min(1, target)));
  }
  const up = { x: Math.sin(b), y: -Math.cos(b) }; // 軀幹往上的方向
  const back = { x: -Math.cos(b), y: -Math.sin(b) }; // 軀幹往後的方向

  const shoulder = { x: hip.x + up.x * BODY.torso, y: hip.y + up.y * BODY.torso };
  const neck = { x: shoulder.x + up.x * BODY.neck, y: shoulder.y + up.y * BODY.neck };
  const head = {
    x: neck.x + up.x * BODY.headR + 2 * Math.cos(b),
    y: neck.y + up.y * BODY.headR,
  };
  const bar = { x: shoulder.x + back.x * BAR_BACK - up.x * 2, y: shoulder.y + back.y * BAR_BACK - up.y * 2 };
  // 手握在槓上，手肘往下往後指；用兩節肢體計算，上臂與前臂長度才會固定
  const hand = { x: bar.x + 3, y: bar.y + 1 };
  const elbow = twoLink(shoulder, hand, BODY.upperArm, BODY.forearm, (e) => e.y - e.x);

  return {
    head,
    neck,
    shoulder,
    elbow,
    hand,
    hip,
    knee,
    ankle,
    heel: { x: ankle.x - BODY.footBack, y: ankle.y + 6 },
    toe: { x: ankle.x + BODY.footFront, y: ankle.y + 6 },
    bar,
  };
}

export const squatDemo: Demo = {
  pose,
  timing: { down: 1.7, bottomHold: 0.25, up: 1.1, topHold: 0.8 },
  captions: {
    down: '吸氣撐住，臀部往後往下坐',
    bottom: '最低點：背部保持中立，腳掌踩穩',
    up: '往下推地站起，胸口和臀部一起上升',
    top: '站直、吐氣，準備下一下',
  },
  guideX: () => ({ x: ANKLE.x + 5, label: '腳掌中心' }),
};
