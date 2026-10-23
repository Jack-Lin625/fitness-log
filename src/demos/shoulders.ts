/**
 * 肩部動作的假人示範
 * 推舉：頂端手在肩膀正上方。側平舉、反向飛鳥、擴胸這類往兩側的動作用正面呈現。
 */
import { ANKLE, ARM, FLOOR, FRONT_PELVIS, STAND_HIP, farArm, farLeg, front, legTo, lerp, mirror, phase, side, type FrontSideSpec } from './build';
import { add, dir, lerpVec, scale, toward } from './kinematics';
import { BODY, type Demo, type FrontDemo, type Prop, type SideDemo, type Vec } from './types';

const PRESS_TIMING = { down: 1.1, bottomHold: 0.5, up: 1.5, topHold: 0.5 };
const PRESS_LABELS = { start: '肩膀高度', end: '推到頭頂' };

// ───────── 推舉 ─────────

const pushPress: SideDemo = {
  pose: (p) => {
    // 先快速微蹲（膝蓋往前），再用腿的力量把槓往上推
    const dip = Math.sin(Math.PI * phase(p, 0, 0.45)) * 12;
    const hip = { x: STAND_HIP.x + dip * 0.15, y: STAND_HIP.y + dip };
    const torso = -2;
    const shoulder = toward(hip, torso, BODY.torso);
    const rack = { x: shoulder.x + 9, y: shoulder.y - 4 };
    const lockout = { x: shoulder.x + 2, y: shoulder.y - (ARM - 1) };
    const bar = lerpVec(rack, lockout, phase(p, 0.3, 1));
    return side({ hip, torso, ankle: ANKLE, knee: legTo(hip, ANKLE), headTilt: 0, hand: bar, elbowPrefer: (e) => e.x, bar });
  },
  timing: { down: 1, bottomHold: 0.5, up: 1.4, topHold: 0.5 },
  captions: {
    down: '膝蓋快速微彎，接著腿往上蹬、手往上推',
    bottom: '推到頭頂，手臂伸直鎖定',
    up: '控制著放回肩膀，膝蓋微彎緩衝',
    top: '槓架在肩膀前方，核心收緊',
  },
  guideX: () => ({ x: ANKLE.x + 5, label: '腳掌中心' }),
  labels: PRESS_LABELS,
  view: { top: -40, height: 250 },
};

const SEAT_HIP: Vec = { x: 80, y: 148 };
const SEAT_ANKLE: Vec = { x: 126, y: ANKLE.y };
const uprightSeat = (hip: Vec): Prop[] => [
  { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
  { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 4 }, b: { x: hip.x - 14, y: hip.y - 62 }, w: 9 },
  { kind: 'frame', pts: [{ x: hip.x + 4, y: hip.y + 15 }, { x: hip.x + 4, y: FLOOR }] },
];

function seatedPress(kind: 'db' | 'arnold' | 'machine' | 'smith'): SideDemo {
  const torso = -3;
  const shoulder = toward(SEAT_HIP, torso, BODY.torso);
  const start = kind === 'arnold' ? { x: shoulder.x + 14, y: shoulder.y - 8 } : { x: shoulder.x + 8, y: shoulder.y - 4 };
  const lockout = { x: shoulder.x + 1, y: shoulder.y - (ARM - 1) };
  const bottom = kind === 'smith' ? { x: lockout.x, y: shoulder.y - 4 } : start;
  return {
    pose: (p) => {
      const hand = lerpVec(bottom, lockout, p);
      const props: Prop[] =
        kind === 'machine'
          ? [{ kind: 'frame', pts: [{ x: 50, y: 30 }, hand] }, { kind: 'handle', at: hand }]
          : kind === 'smith'
            ? []
            : [{ kind: 'dumbbell', at: hand }];
      return side({
        hip: SEAT_HIP,
        torso,
        ankle: SEAT_ANKLE,
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: kind === 'arnold' ? (e) => e.x + (1 - p) * 50 : (e) => e.y + e.x * 0.3,
        props,
        ...(kind === 'smith' ? { bar: hand } : {}),
      });
    },
    props: [...uprightSeat(SEAT_HIP), ...(kind === 'smith' ? [{ kind: 'frame' as const, pts: [{ x: lockout.x - 12, y: -28 }, { x: lockout.x - 12, y: FLOOR }] }] : [])],
    view: { top: -40, height: 250 },
    timing: PRESS_TIMING,
    captions:
      kind === 'arnold'
        ? { down: '掌心朝自己開始，邊推邊把掌心轉向前', bottom: '頂端掌心朝前、手臂伸直', up: '邊放下邊把掌心轉回朝自己', top: '啞鈴在臉前，手肘朝前' }
        : {
            down: kind === 'smith' ? '沿著軌道往上推' : '往頭頂推，手肘從側邊往上',
            bottom: '推到頭頂，手在肩膀正上方',
            up: '慢慢放回到約耳朵高度',
            top: '背貼著椅背，核心收緊',
          },
    labels: PRESS_LABELS,
  };
}

const kbPress: SideDemo = {
  pose: (p) => {
    const hip = STAND_HIP;
    const shoulder = toward(hip, -2, BODY.torso);
    const hand = lerpVec({ x: shoulder.x + 10, y: shoulder.y + 2 }, { x: shoulder.x + 1, y: shoulder.y - (ARM - 1) }, p);
    return side({
      hip,
      torso: -2,
      ankle: ANKLE,
      hand,
      elbowPrefer: (e) => e.x,
      far: farArm(shoulder, { x: shoulder.x + 4, y: shoulder.y + 46 }),
      props: [{ kind: 'kettlebell', at: add(hand, { x: -6, y: -2 }) }],
    });
  },
  view: { top: -40, height: 250 },
  timing: PRESS_TIMING,
  captions: { down: '壺鈴從肩膀往頭頂推', bottom: '手臂伸直，壺鈴在手腕後方', up: '慢慢放回肩膀前方', top: '另一手可以握拳，全身收緊' },
  labels: PRESS_LABELS,
};

const landminePress: SideDemo = (() => {
  const pivot: Vec = { x: 10, y: FLOOR - 2 };
  const hip: Vec = { x: 88, y: STAND_HIP.y + 3 };
  const torso = 10;
  const shoulder = toward(hip, torso, BODY.torso);
  return {
    pose: (p) => {
      const hand = lerpVec({ x: shoulder.x + 10, y: shoulder.y + 4 }, toward(shoulder, 42, ARM - 1), p);
      return side({
        hip,
        torso,
        ankle: { x: 104, y: ANKLE.y },
        hand,
        elbowPrefer: (e) => e.y,
        far: farLeg(hip, { x: 66, y: ANKLE.y }, (k) => k.x, 90),
        props: [
          { kind: 'frame', pts: [pivot, hand] },
          { kind: 'plate', at: lerpVec(pivot, hand, 0.82), r: 12 },
        ],
      });
    },
    props: [{ kind: 'bar', at: pivot }],
    timing: PRESS_TIMING,
    captions: { down: '槓端從肩膀往前上方推', bottom: '手臂伸直，肩膀往前延伸', up: '慢慢放回肩膀前方', top: '前後腳站穩，身體微微前傾' },
    labels: { start: '肩膀前方', end: '推出' },
  };
})();

// ───────── 前平舉、直立划船、臉拉、Y 字舉（側面） ─────────

const frontRaise: SideDemo = {
  pose: (p) => {
    const shoulder = toward(STAND_HIP, 0, BODY.torso);
    const hand = toward(shoulder, lerp(176, 92, p), ARM - 2);
    return side({ hip: STAND_HIP, torso: 0, ankle: ANKLE, hand, elbowPrefer: (e) => e.y, props: [{ kind: 'dumbbell', at: hand }] });
  },
  timing: { down: 1, bottomHold: 0.4, up: 1.5, topHold: 0.3 },
  captions: { down: '手臂微彎，往前舉到肩膀高度', bottom: '舉到與肩同高就好', up: '慢慢放下', top: '身體不要前後晃動借力' },
  labels: { start: '手在大腿前', end: '舉到肩高' },
};

const uprightRow: SideDemo = {
  pose: (p) => {
    const shoulder = toward(STAND_HIP, 0, BODY.torso);
    const hand = lerpVec({ x: shoulder.x + 4, y: shoulder.y + ARM - 2 }, { x: shoulder.x + 10, y: shoulder.y + 10 }, p);
    return side({ hip: STAND_HIP, torso: 0, ankle: ANKLE, hand, elbowPrefer: (e) => -e.y, bar: hand });
  },
  timing: { down: 1, bottomHold: 0.4, up: 1.5, topHold: 0.3 },
  captions: { down: '手肘帶頭往上拉，槓貼近身體', bottom: '拉到胸口下方，手肘不高過肩膀', up: '慢慢放下', top: '手臂伸直，握距約與肩同寬' },
  labels: { start: '手臂伸直', end: '拉到胸口' },
};

const facePull: SideDemo = (() => {
  const pulley: Vec = { x: 188, y: 34 };
  const hip: Vec = { x: 92, y: STAND_HIP.y };
  const torso = -6;
  const shoulder = toward(hip, torso, BODY.torso);
  return {
    pose: (p) => {
      const hand = lerpVec(toward(shoulder, 78, ARM - 1), add(shoulder, { x: 14, y: -18 }), p);
      return side({
        hip,
        torso,
        ankle: ANKLE,
        hand,
        elbowPrefer: (e) => -e.y - e.x * 0.5,
        props: [{ kind: 'cable', a: pulley, b: hand }, { kind: 'handle', at: hand }],
      });
    },
    props: [{ kind: 'frame', pts: [{ x: 194, y: 20 }, { x: 194, y: FLOOR }] }, { kind: 'pulley', at: pulley }],
    timing: { down: 1, bottomHold: 0.6, up: 1.4, topHold: 0.3 },
    captions: { down: '繩子拉向臉，手肘往外往後', bottom: '雙手拉到耳朵兩側，肩胛夾緊', up: '慢慢讓手臂往前伸直', top: '身體站穩，不要往後倒' },
    labels: { start: '手臂伸直', end: '拉到臉旁' },
  };
})();

const inclineYRaise: SideDemo = (() => {
  const hip: Vec = { x: 80, y: 128 };
  const torso = 50;
  const shoulder = toward(hip, torso, BODY.torso);
  const chestSide = dir(torso + 90);
  return {
    pose: (p) => {
      // 手臂伸直，從垂下舉到和身體一直線（Y 字）
      const hand = toward(shoulder, lerp(178, torso + 6, p), ARM - 2);
      return side({
        hip,
        torso,
        headTilt: -6,
        ankle: { x: 20, y: ANKLE.y },
        hand,
        elbowPrefer: (e) => e.y,
        props: [{ kind: 'dumbbell', at: hand }],
      });
    },
    props: [
      { kind: 'pad', a: add(toward(hip, torso, 8), scale(chestSide, 10)), b: add(toward(shoulder, torso, 6), scale(chestSide, 10)), w: 9 },
      { kind: 'frame', pts: [add(hip, { x: 10, y: 14 }), { x: hip.x + 10, y: FLOOR }] },
    ],
    timing: { down: 1, bottomHold: 0.6, up: 1.4, topHold: 0.3 },
    captions: { down: '拇指朝上，手臂往前上方舉成 Y 字', bottom: '手臂和身體一直線，下斜方用力', up: '慢慢放下', top: '胸口貼著椅背，用很輕的重量' },
    labels: { start: '手臂垂下', end: '舉成 Y 字' },
  };
})();

// ───────── 側平舉、反向飛鳥、彈力帶擴胸（正面） ─────────

function lateralRaise(kind: 'db' | 'cable' | 'machine'): FrontDemo {
  const seated = kind === 'machine';
  const pelvis = seated ? { x: 100, y: 133 } : FRONT_PELVIS;
  return {
    kind: 'front',
    pose: (p) => {
      const angle = lerp(170, 94, p);
      const l: FrontSideSpec =
        kind === 'machine'
          ? { upper: angle, fore: 180, foreFs: 0.35, thigh: 165, thighFs: 0.35, shin: 178 }
          : { upper: angle, fore: angle - 6 };
      const r: FrontSideSpec = kind === 'cable' ? { upper: -150, fore: -140 } : mirror(l);
      const pose = front({ pelvis, l, r });
      const props: Prop[] = [];
      if (kind === 'db') props.push({ kind: 'dumbbell', at: pose.l.hand }, { kind: 'dumbbell', at: pose.r.hand });
      if (kind === 'cable') props.push({ kind: 'cable', a: { x: 12, y: 190 }, b: pose.l.hand }, { kind: 'handle', at: pose.l.hand }, { kind: 'bar', at: pose.r.hand });
      if (kind === 'machine') {
        props.push({ kind: 'pad', a: lerpVec(pose.l.shoulder, pose.l.elbow, 0.6), b: pose.l.elbow, w: 6 });
        props.push({ kind: 'pad', a: lerpVec(pose.r.shoulder, pose.r.elbow, 0.6), b: pose.r.elbow, w: 6 });
      }
      pose.props = props;
      return pose;
    },
    props: seated
      ? [
          { kind: 'pad', a: { x: 80, y: 144 }, b: { x: 120, y: 144 }, w: 9 },
          { kind: 'frame', pts: [{ x: 100, y: 150 }, { x: 100, y: FLOOR }] },
        ]
      : kind === 'cable'
        ? [{ kind: 'frame', pts: [{ x: 6, y: 40 }, { x: 6, y: FLOOR }] }, { kind: 'pulley', at: { x: 12, y: 190 } }]
        : [],
    grounded: !seated,
    timing: { down: 1, bottomHold: 0.4, up: 1.6, topHold: 0.3 },
    captions: {
      down: kind === 'machine' ? '用手肘推護墊往兩側抬' : '手肘微彎，往兩側抬起',
      bottom: '抬到與肩同高，肩膀不要聳起',
      up: '慢慢放下，控制住重量',
      top: '身體不要晃動借力',
    },
    labels: { start: '手在身側', end: '抬到肩高' },
  };
}

const dbRearDeltFly: FrontDemo = {
  kind: 'front',
  pose: (p) => {
    // 從正面看彎腰的人：軀幹看起來變短，頭在肩膀前下方
    const angle = lerp(176, 96, p);
    const l: FrontSideSpec = { upper: angle, fore: angle - 4, thigh: 177, shin: 182 };
    const pose = front({ pelvis: FRONT_PELVIS, torsoFs: 0.38, l, r: mirror(l) });
    const center = lerpVec(pose.l.shoulder, pose.r.shoulder, 0.5);
    pose.neck = add(center, { x: 0, y: 4 });
    pose.head = add(center, { x: 0, y: 12 });
    pose.props = [
      { kind: 'dumbbell', at: pose.l.hand },
      { kind: 'dumbbell', at: pose.r.hand },
    ];
    return pose;
  },
  timing: { down: 1, bottomHold: 0.4, up: 1.5, topHold: 0.3 },
  captions: { down: '上身前傾，手臂微彎往兩側打開', bottom: '肩膀後側用力，肩胛不要夾太用力', up: '慢慢放下', top: '背打直，頭和脊椎一直線' },
  labels: { start: '手垂下', end: '往兩側打開' },
};

const bandPullApart: FrontDemo = {
  kind: 'front',
  pose: (p) => {
    // 手臂伸直在胸前，往兩側拉開（從正面看，手從中間往外）
    const fs = lerp(0.1, 1, p);
    const l: FrontSideSpec = { upper: 92, fore: 92, upperFs: fs, foreFs: fs };
    const pose = front({ pelvis: FRONT_PELVIS, l, r: mirror(l) });
    pose.props = [{ kind: 'band', a: pose.r.hand, b: pose.l.hand }];
    return pose;
  },
  timing: { down: 0.9, bottomHold: 0.6, up: 1.3, topHold: 0.3 },
  captions: { down: '手臂伸直，把彈力帶往兩側拉開', bottom: '彈力帶碰到胸口，肩胛夾緊', up: '慢慢回到前面', top: '手在胸前，肩膀放鬆往下' },
  labels: { start: '手在前方', end: '拉開' },
};

export const SHOULDER_DEMOS: Record<string, Demo> = {
  'push-press': pushPress,
  'db-shoulder-press': seatedPress('db'),
  'arnold-press': seatedPress('arnold'),
  'kb-press': kbPress,
  'machine-shoulder-press': seatedPress('machine'),
  'smith-shoulder-press': seatedPress('smith'),
  'landmine-press': landminePress,
  'lateral-raise': lateralRaise('db'),
  'cable-lateral-raise': lateralRaise('cable'),
  'machine-lateral-raise': lateralRaise('machine'),
  'front-raise': frontRaise,
  'upright-row': uprightRow,
  'db-rear-delt-fly': dbRearDeltFly,
  'face-pull': facePull,
  'incline-y-raise': inclineYRaise,
  'band-pull-apart': bandPullApart,
};
