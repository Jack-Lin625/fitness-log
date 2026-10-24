/**
 * 背部動作的假人示範：拉類（划船、引體向上、下拉）、背伸展、聳肩。
 * 划船時手肘往後上方、槓或握把拉向身體；引體向上手固定在槓上、身體往上。
 */
import { deadliftPose, hinge, MIDFOOT, PLATE_R } from './barbell';
import { ANKLE, ARM, FLOOR, farArm, farLeg, legAngles, lerp, side, STAND_HIP } from './build';
import { add, dir, lerpVec, scale, toward } from './kinematics';
import { BODY, type Demo, type Prop, type SideDemo, type Vec } from './types';

const ROW_TIMING = { down: 0.9, bottomHold: 0.5, up: 1.4, topHold: 0.4 };
const ROW_CAPTIONS = {
  down: '手肘往後上方拉，握把拉向身體',
  bottom: '頂端夾緊肩胛停一下',
  up: '慢慢放回到手臂伸直',
  top: '上身角度不變，背部保持平直',
};

/** 軀幹前側（胸、肚子）上的一點：沿軀幹離肩膀 along，往前凸 out */
const onFront = (shoulder: Vec, torso: number, along: number, out: number) =>
  add(toward(shoulder, torso + 180, along), scale(dir(torso + 90), out));

// ───────── 架上拉、彭德雷划船、T 槓划船 ─────────

const rackPull: SideDemo = {
  pose: (p) => deadliftPose(lerp(0, 0.42, p)),
  props: (() => {
    const low = deadliftPose(0.42).bar!;
    return [
      { kind: 'frame', pts: [{ x: MIDFOOT + 24, y: 30 }, { x: MIDFOOT + 24, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: MIDFOOT - 6, y: low.y + PLATE_R + 2 }, { x: MIDFOOT + 24, y: low.y + PLATE_R + 2 }] },
    ] satisfies Prop[];
  })(),
  timing: { down: 1.2, bottomHold: 0.5, up: 1.1, topHold: 0.6 },
  captions: {
    down: '髖往後推，把槓放回架子的安全槓上',
    bottom: '槓在膝蓋附近：背打直、胸口挺起',
    up: '髖往前推站直，槓貼著大腿',
    top: '站直鎖定，不要往後仰',
  },
  guideX: () => ({ x: MIDFOOT, label: '腳掌中心' }),
  labels: { start: '站直', end: '槓在架上' },
};

function bentRow(kind: 'pendlay' | 'tbar'): SideDemo {
  const knee = toward(ANKLE, kind === 'pendlay' ? 22 : 14, BODY.shin);
  const torso = kind === 'pendlay' ? 80 : 45;
  // 起點手臂垂直：彭德雷從地面拉起，T 槓懸空
  const { hip, shoulder } = hinge(knee, torso, 0);
  const start = toward(shoulder, 180, ARM - 1);
  const end = onFront(shoulder, torso, kind === 'pendlay' ? 26 : 30, 12);
  const pivot: Vec = { x: 8, y: FLOOR - 2 };
  return {
    pose: (p) => {
      const hand = lerpVec(start, end, p);
      return side({
        hip,
        torso,
        headTilt: 10,
        ankle: ANKLE,
        knee,
        hand,
        elbowPrefer: (e) => -e.y,
        ...(kind === 'pendlay' ? { bar: hand } : { props: [{ kind: 'frame', pts: [pivot, hand] }, { kind: 'plate', at: add(hand, { x: -12, y: 3 }), r: 11 }] }),
      });
    },
    timing: kind === 'pendlay' ? { down: 0.7, bottomHold: 0.3, up: 1, topHold: 0.6 } : ROW_TIMING,
    captions:
      kind === 'pendlay'
        ? {
            down: '從地面爆發拉起，槓碰到下胸',
            bottom: '上身維持水平，不靠起身借力',
            up: '控制著把槓放回地面',
            top: '每一下都從地面靜止開始',
          }
        : ROW_CAPTIONS,
    guideX: () => ({ x: MIDFOOT, label: '腳掌中心' }),
    labels: { start: kind === 'pendlay' ? '槓在地面' : '手臂伸直', end: '拉到身體' },
  };
}

// ───────── 單臂啞鈴划船、胸靠划船 ─────────

const dbRow: SideDemo = (() => {
  // 分腿站，遠側（另一隻）手撐在前方的椅子上，近側手划船
  const hip: Vec = { x: 70, y: 118 };
  const torso = 75;
  const shoulder = toward(hip, torso, BODY.torso);
  const benchY = 146;
  const support = farArm(shoulder, { x: shoulder.x + 18, y: benchY - 2 }, (e) => e.x);
  const start = toward(shoulder, 180, ARM - 1);
  const end = onFront(shoulder, torso, 30, 10);
  return {
    pose: (p) => {
      const hand = lerpVec(start, end, p);
      return side({
        hip,
        torso,
        headTilt: 8,
        ankle: { x: 50, y: ANKLE.y },
        hand,
        elbowPrefer: (e) => -e.y,
        far: { ...support, ...farLeg(hip, { x: 104, y: ANKLE.y }) },
        props: [{ kind: 'dumbbell', at: hand }],
      });
    },
    props: [
      { kind: 'pad', a: { x: 124, y: benchY + 5 }, b: { x: 192, y: benchY + 5 }, w: 9 },
      { kind: 'frame', pts: [{ x: 134, y: benchY + 9 }, { x: 134, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: 184, y: benchY + 9 }, { x: 184, y: FLOOR }] },
    ],
    timing: ROW_TIMING,
    captions: {
      down: '手肘往後往上拉，啞鈴拉向髖部',
      bottom: '頂端停一下，背部肌肉夾緊',
      up: '慢慢放下到手臂伸直，肩膀可以微微往下',
      top: '另一手撐穩，上身不要旋轉',
    },
    labels: { start: '手臂伸直', end: '拉到髖部' },
  };
})();

const chestSupportedRow: SideDemo = (() => {
  const hip: Vec = { x: 80, y: 128 };
  const torso = 50;
  const shoulder = toward(hip, torso, BODY.torso);
  const chestSide = dir(torso + 90);
  const start = toward(shoulder, 180, ARM - 1);
  const end = onFront(shoulder, torso, 24, 4);
  return {
    pose: (p) => {
      const hand = lerpVec(start, end, p);
      return side({
        hip,
        torso,
        headTilt: -10,
        ankle: { x: 20, y: ANKLE.y },
        hand,
        elbowPrefer: (e) => -e.y,
        props: [{ kind: 'dumbbell', at: hand }],
      });
    },
    props: [
      { kind: 'pad', a: add(toward(hip, torso, 8), scale(chestSide, 10)), b: add(toward(shoulder, torso, 6), scale(chestSide, 10)), w: 9 },
      { kind: 'frame', pts: [add(hip, { x: 10, y: 14 }), { x: hip.x + 10, y: FLOOR }] },
    ],
    timing: ROW_TIMING,
    captions: {
      down: '胸口貼著椅背，手肘往後上方拉',
      bottom: '肩胛往中間夾緊',
      up: '慢慢放下，讓肩胛打開',
      top: '胸口不要離開椅背',
    },
    labels: { start: '手臂伸直', end: '拉到身體' },
  };
})();

// ───────── 坐姿划船（機器、繩索） ─────────

const SEAT_HIP: Vec = { x: 70, y: 148 };
const SEAT_ANKLE: Vec = { x: 116, y: ANKLE.y };
const seatPad = (hip: Vec): Prop[] => [
  { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
  { kind: 'frame', pts: [{ x: hip.x + 4, y: hip.y + 15 }, { x: hip.x + 4, y: FLOOR }] },
];

function machineRow(high: boolean): SideDemo {
  const torso = 4;
  const shoulder = toward(SEAT_HIP, torso, BODY.torso);
  const start = high ? toward(shoulder, 42, ARM - 1) : toward(shoulder, 94, ARM - 1);
  const end = high ? { x: shoulder.x + 4, y: shoulder.y + 16 } : { x: shoulder.x + 6, y: shoulder.y + 14 };
  const pivot: Vec = { x: 182, y: high ? 20 : 150 };
  return {
    pose: (p) => {
      const hand = lerpVec(start, end, p);
      return side({
        hip: SEAT_HIP,
        torso,
        ankle: SEAT_ANKLE,
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: (e) => -e.x,
        props: [{ kind: 'frame', pts: [pivot, hand] }, { kind: 'handle', at: hand }],
      });
    },
    props: [
      ...seatPad(SEAT_HIP),
      { kind: 'pad', a: { x: shoulder.x + 16, y: shoulder.y + 8 }, b: { x: shoulder.x + 16, y: shoulder.y + 38 }, w: 8 },
      { kind: 'frame', pts: [{ x: shoulder.x + 22, y: shoulder.y + 24 }, { x: 182, y: shoulder.y + 24 }, { x: 182, y: FLOOR }] },
    ],
    timing: ROW_TIMING,
    captions: {
      down: high ? '手肘往下往後拉，像在做下拉' : '胸口貼著靠墊，手肘往後拉',
      bottom: '肩胛往後下方夾緊',
      up: '慢慢讓握把回到前面',
      top: '手臂伸直，肩胛往前打開',
    },
    labels: { start: '手臂伸直', end: '拉到身體' },
  };
}

function cableRow(single: boolean): SideDemo {
  const hip: Vec = { x: 58, y: 172 };
  const ankle: Vec = { x: 134, y: 170 };
  const pulley: Vec = { x: 186, y: 168 };
  return {
    pose: (p) => {
      // 起點上身微微前傾、手臂伸直；拉到底時上身直立
      const torso = lerp(18, -4, p);
      const shoulder = toward(hip, torso, BODY.torso);
      const hand = lerpVec(toward(shoulder, 98, ARM - 1), onFront(shoulder, torso, 30, 12), p);
      const pose = side({
        hip,
        torso,
        ankle,
        kneePrefer: (k) => -k.y,
        toeDeg: 15,
        hand,
        elbowPrefer: (e) => -e.x,
        props: [
          { kind: 'cable', a: pulley, b: hand },
          { kind: 'handle', at: hand },
        ],
      });
      if (single) pose.far = farArm(pose.shoulder, add(pose.knee, { x: -6, y: -8 }), (e) => e.y);
      return pose;
    },
    props: [
      { kind: 'pad', a: { x: 30, y: hip.y + 12 }, b: { x: 110, y: hip.y + 12 }, w: 8 },
      { kind: 'pad', a: { x: ankle.x + 8, y: ankle.y - 18 }, b: { x: ankle.x + 8, y: ankle.y + 10 }, w: 6 },
      { kind: 'frame', pts: [{ x: 190, y: 120 }, { x: 190, y: FLOOR }] },
      { kind: 'pulley', at: pulley },
    ],
    grounded: false,
    timing: ROW_TIMING,
    captions: {
      down: single ? '單手往後拉，手肘貼近身體' : '挺胸，手肘貼近身體往後拉',
      bottom: '握把拉到肚子，肩胛夾緊',
      up: '慢慢讓手臂往前伸直',
      top: '上身只微微前傾，背不要拱',
    },
    labels: { start: '手臂伸直', end: '拉到肚子' },
  };
}

// ───────── 引體向上、下拉 ─────────

const PULL_BAR: Vec = { x: 100, y: -12 };

function pullUp(kind: 'pull-up' | 'chin-up' | 'neutral' | 'assisted'): SideDemo {
  return {
    pose: (p) => {
      const hand = PULL_BAR;
      // 肩膀：起點在手的正下方（手臂伸直），頂端到槓的後下方
      const shoulder = lerpVec({ x: hand.x - 2, y: hand.y + ARM - 1 }, { x: hand.x - 10, y: hand.y + 16 }, p);
      const torso = lerp(-4, -14, p);
      const hip = toward(shoulder, torso + 180, BODY.torso);
      const assisted = kind === 'assisted';
      const { knee, ankle } = legAngles(hip, assisted ? 182 : 172, assisted ? 270 : 222);
      const pose = side({
        hip,
        torso,
        headTilt: -8,
        ankle,
        knee,
        toeDeg: 200,
        hand,
        elbowPrefer: kind === 'chin-up' ? (e) => e.x : (e) => e.x * 0.3 + e.y,
      });
      if (assisted) pose.props = [{ kind: 'pad', a: { x: knee.x - 22, y: knee.y + 8 }, b: { x: knee.x + 4, y: knee.y + 8 }, w: 6 }];
      return pose;
    },
    props: [
      { kind: 'frame', pts: [{ x: 60, y: PULL_BAR.y }, { x: 140, y: PULL_BAR.y }] },
      { kind: 'bar', at: PULL_BAR },
      { kind: 'frame', pts: [{ x: 160, y: PULL_BAR.y - 6 }, { x: 160, y: FLOOR }] },
    ],
    grounded: false,
    view: { top: -40, height: 250 },
    timing: { down: 1.1, bottomHold: 0.4, up: 1.5, topHold: 0.4 },
    captions: {
      down: kind === 'chin-up' ? '反手握，手肘往下往前拉' : '手肘往下往後拉，胸口往槓靠近',
      bottom: '下巴過槓，肩膀往下壓',
      up: '慢慢放下到手臂伸直',
      top: kind === 'assisted' ? '膝蓋跪在踏板上，手臂伸直' : '手臂伸直、肩膀不要放鬆到聳起',
    },
    labels: { start: '懸垂', end: '下巴過槓' },
  };
}

function pulldown(kind: 'wide' | 'close' | 'reverse' | 'single'): SideDemo {
  const thighPad: Vec = { x: 112, y: 132 };
  return {
    pose: (p) => {
      const torso = lerp(-4, -16, p);
      const shoulder = toward(SEAT_HIP, torso, BODY.torso);
      const top = toward(shoulder, 6, ARM - 1);
      const bottom = { x: shoulder.x + (kind === 'close' ? 14 : 10), y: shoulder.y + (kind === 'close' ? 4 : -4) };
      const hand = lerpVec(top, bottom, p);
      const pose = side({
        hip: SEAT_HIP,
        torso,
        headTilt: -6,
        ankle: SEAT_ANKLE,
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: kind === 'wide' ? (e) => e.y - e.x * 0.3 : (e) => e.x,
        props: [
          { kind: 'cable', a: { x: top.x, y: 10 }, b: hand },
          { kind: 'handle', at: hand },
        ],
      });
      if (kind === 'single') pose.far = farArm(pose.shoulder, add(pose.knee, { x: -14, y: -8 }), (e) => e.y);
      return pose;
    },
    props: [
      ...seatPad(SEAT_HIP),
      { kind: 'pad', a: { x: thighPad.x - 14, y: thighPad.y }, b: { x: thighPad.x + 6, y: thighPad.y }, w: 8 },
      { kind: 'frame', pts: [{ x: 150, y: FLOOR }, { x: 150, y: 6 }, { x: 70, y: 6 }] },
      { kind: 'pulley', at: { x: 76, y: 8 } },
    ],
    timing: ROW_TIMING,
    captions: {
      down: kind === 'close' ? '手肘往下往後拉，握把拉到胸口' : '手肘往下往後拉，槓拉到上胸',
      bottom: '胸口挺起，肩胛往下往後收',
      up: '慢慢讓手臂往上伸直',
      top: '頂端感覺背部伸展，臀部不離開座位',
    },
    labels: { start: '手臂伸直', end: '拉到胸口' },
  };
}

const straightArmPulldown: SideDemo = (() => {
  const torso = 22;
  const hip: Vec = { x: 82, y: STAND_HIP.y + 6 };
  const shoulder = toward(hip, torso, BODY.torso);
  const pulley: Vec = { x: 188, y: 12 };
  return {
    pose: (p) => {
      // 手臂伸直，從前上方往下畫弧到大腿前
      const hand = toward(shoulder, lerp(55, 168, p), ARM - 2);
      return side({
        hip,
        torso,
        headTilt: 6,
        ankle: ANKLE,
        hand,
        elbowPrefer: (e) => -e.y,
        props: [
          { kind: 'cable', a: pulley, b: hand },
          { kind: 'handle', at: hand },
        ],
      });
    },
    props: [{ kind: 'frame', pts: [{ x: 194, y: 6 }, { x: 194, y: FLOOR }] }, { kind: 'pulley', at: pulley }],
    timing: ROW_TIMING,
    captions: {
      down: '手臂保持伸直，往下畫弧到大腿前',
      bottom: '背闊肌夾緊，不要用三頭往下壓',
      up: '慢慢讓手臂回到前上方',
      top: '上身微微前傾，背部打直',
    },
    labels: { start: '手在前上方', end: '壓到大腿' },
  };
})();

const invertedRow: SideDemo = (() => {
  const ankle: Vec = { x: 16, y: 186 };
  const bodyLen = BODY.shin + BODY.thigh + BODY.torso;
  const a0 = (14 * Math.PI) / 180;
  const shoulder0 = { x: ankle.x + bodyLen * Math.cos(a0), y: ankle.y - bodyLen * Math.sin(a0) };
  const bar: Vec = { x: shoulder0.x + 2, y: shoulder0.y - (ARM - 1) };
  const angleFor = (p: number) => lerp(a0, (30 * Math.PI) / 180, p);
  return {
    pose: (p) => {
      const a = angleFor(p);
      const along = (len: number): Vec => ({ x: ankle.x + Math.cos(a) * len, y: ankle.y - Math.sin(a) * len });
      const torso = 90 - (a * 180) / Math.PI;
      return side({
        hip: along(BODY.shin + BODY.thigh),
        knee: along(BODY.shin),
        torso,
        headTilt: -10,
        ankle,
        toeDeg: 10,
        hand: bar,
        elbowPrefer: (e) => e.y,
      });
    },
    props: [
      { kind: 'bar', at: bar },
      { kind: 'frame', pts: [{ x: bar.x + 4, y: bar.y }, { x: bar.x + 4, y: FLOOR }] },
    ],
    grounded: false,
    timing: ROW_TIMING,
    captions: {
      down: '身體一直線，把胸口拉向槓',
      bottom: '胸口靠近槓，肩胛夾緊',
      up: '慢慢放下到手臂伸直',
      top: '腳跟著地，臀部不下垂',
    },
    labels: { start: '手臂伸直', end: '胸口到槓' },
  };
})();

// ───────── 背伸展、超人式、聳肩 ─────────

const backExtension: SideDemo = (() => {
  const ankle: Vec = { x: 36, y: 182 };
  const hip = toward(ankle, 48, BODY.thigh + BODY.shin - 0.6);
  return {
    pose: (p) => {
      // p = 0 上身直直往下垂，p = 1 回到和腿一直線
      const torso = lerp(178, 48, 1 - p);
      const shoulder = toward(hip, torso, BODY.torso);
      return side({
        hip,
        torso,
        headTilt: 6,
        ankle,
        toeDeg: 130,
        hand: onFront(shoulder, torso, -2, 6),
        // 雙手交叉在胸前，手肘朝髖部那一側（上身垂下時手肘才不會穿過地板）
        elbowPrefer: (e) => -Math.hypot(e.x - hip.x, e.y - hip.y),
      });
    },
    props: [
      { kind: 'pad', a: toward(add(hip, { x: 8, y: 8 }), 228, 8), b: toward(add(hip, { x: 8, y: 8 }), 48, 10), w: 9 },
      { kind: 'pad', a: { x: ankle.x + 2, y: ankle.y + 9 }, b: { x: ankle.x + 3, y: ankle.y + 9 }, w: 10 },
      { kind: 'frame', pts: [{ x: ankle.x + 4, y: FLOOR }, add(hip, { x: 14, y: 14 }), { x: hip.x + 30, y: FLOOR }] },
    ],
    grounded: false,
    timing: { down: 1.5, bottomHold: 0.3, up: 1.2, topHold: 0.6 },
    captions: {
      down: '從髖部往下彎，背保持平直',
      bottom: '腿後有伸展感就停',
      up: '臀部夾緊，把上身抬回和腿一直線',
      top: '身體一直線，不要過度往後仰',
    },
    labels: { start: '一直線', end: '往下彎' },
  };
})();

const superman: SideDemo = (() => {
  const hip: Vec = { x: 114, y: 186 };
  return {
    pose: (p) => {
      // 趴在地上，同時抬起胸口、手臂和腿
      const torso = lerp(90, 76, p);
      const legDeg = lerp(-90, -78, p);
      const knee = toward(hip, legDeg, BODY.thigh);
      const ankle = toward(knee, legDeg, BODY.shin);
      const shoulder = toward(hip, torso, BODY.torso);
      return side({
        hip,
        torso,
        headTilt: 10,
        ankle,
        knee,
        toeDeg: legDeg - 5,
        // 手肘微彎、雙手在頭的前方
        hand: toward(shoulder, torso - lerp(0, 8, p), 24),
        elbowPrefer: (e) => -e.y,
      });
    },
    grounded: false,
    timing: { down: 1, bottomHold: 1, up: 1, topHold: 0.6 },
    captions: {
      down: '吐氣，同時抬起手臂、胸口和雙腳',
      bottom: '停 1～2 秒，臀部和下背夾緊',
      up: '慢慢放回地面',
      top: '趴好，手往前伸直',
    },
    labels: { start: '趴下', end: '抬起' },
  };
})();

function shrug(load: 'barbell' | 'dumbbell'): SideDemo {
  const hip = STAND_HIP;
  return {
    pose: (p) => {
      const lift = lerp(0, 7, p);
      const pose = side({ hip, torso: 0, shrug: lift, ankle: ANKLE, arm: [load === 'barbell' ? 172 : 178, load === 'barbell' ? 172 : 178] });
      return load === 'barbell' ? { ...pose, bar: { x: pose.hand.x + 6, y: pose.hand.y } } : { ...pose, props: [{ kind: 'dumbbell', at: pose.hand }] };
    },
    flex: ['torso'],
    timing: { down: 0.8, bottomHold: 0.8, up: 1, topHold: 0.4 },
    captions: {
      down: '肩膀直直往耳朵方向提起',
      bottom: '頂端停一下，上斜方肌夾緊',
      up: '慢慢放下，肩膀完全放鬆',
      top: '手臂伸直，不要用手臂彎曲幫忙',
    },
    labels: { start: '肩膀放下', end: '肩膀提起' },
  };
}

export const BACK_DEMOS: Record<string, Demo> = {
  'rack-pull': rackPull,
  'pendlay-row': bentRow('pendlay'),
  'tbar-row': bentRow('tbar'),
  'db-row': dbRow,
  'chest-supported-db-row': chestSupportedRow,
  'machine-row': machineRow(false),
  'machine-high-row': machineRow(true),
  'seated-cable-row': cableRow(false),
  'single-arm-cable-row': cableRow(true),
  'pull-up': pullUp('pull-up'),
  'chin-up': pullUp('chin-up'),
  'neutral-pull-up': pullUp('neutral'),
  'assisted-pull-up': pullUp('assisted'),
  'lat-pulldown': pulldown('wide'),
  'close-grip-pulldown': pulldown('close'),
  'reverse-grip-pulldown': pulldown('reverse'),
  'single-arm-pulldown': pulldown('single'),
  'straight-arm-pulldown': straightArmPulldown,
  'inverted-row': invertedRow,
  'back-extension': backExtension,
  superman,
  'barbell-shrug': shrug('barbell'),
  'db-shrug': shrug('dumbbell'),
};
