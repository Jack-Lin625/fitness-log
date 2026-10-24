/**
 * 胸部動作的假人示範
 * 臥推類：推到頂端時手在肩膀正上方（重量垂直落在肩關節上），放下時碰到胸口。
 * 飛鳥、夾胸這類往兩側打開的動作用正面（或俯視）呈現，才看得出手臂的弧線。
 */
import { ANKLE, ARM, FLOOR, foot, front, lerp, mirror, side, type FrontSideSpec } from './build';
import { add, dir, lerpVec, scale, toward } from './kinematics';
import { BODY, type Demo, type FrontDemo, type Pose, type Prop, type SideDemo, type Vec } from './types';

// ───────── 臥推類（側面） ─────────

type Load = 'barbell' | 'dumbbell' | 'smith';

interface LyingPressOpts {
  /** 椅背角度：0 平板、正值上斜、負值下斜 */
  incline: number;
  load: Load;
  /** 碰胸的位置：離肩膀多遠（沿軀幹） */
  touch?: number;
}

/** 躺在椅子上的身體位置與椅子 */
function lyingSetup(incline: number) {
  const torso = -88 + incline;
  const hip: Vec = incline > 5 ? { x: 112, y: 150 } : incline < -5 ? { x: 116, y: 128 } : { x: 104, y: 142 };
  const shoulder = toward(hip, torso, BODY.torso);
  const back = dir(torso - 90); // 背部那一側
  const padStart = add(toward(hip, torso, -10), scale(back, 9));
  const padEnd = add(toward(shoulder, torso, 16), scale(back, 9));
  const props: Prop[] = [{ kind: 'pad', a: padStart, b: padEnd, w: 9 }];
  if (incline > 5) {
    // 上斜椅：座墊 + 靠背支架
    props.push({ kind: 'pad', a: { x: hip.x - 14, y: hip.y + 10 }, b: { x: hip.x + 20, y: hip.y + 10 }, w: 8 });
    props.push({ kind: 'frame', pts: [{ x: hip.x, y: hip.y + 14 }, { x: hip.x, y: FLOOR }] });
    props.push({ kind: 'frame', pts: [padEnd, { x: padEnd.x + 4, y: FLOOR }] });
  } else {
    props.push({ kind: 'frame', pts: [{ x: padStart.x - 6, y: padStart.y + 4 }, { x: padStart.x - 6, y: FLOOR }] });
    props.push({ kind: 'frame', pts: [{ x: padEnd.x + 8, y: padEnd.y + 4 }, { x: padEnd.x + 8, y: FLOOR }] });
  }
  // 腳：平板、上斜踩地；下斜椅腳勾在滾筒下
  const ankle: Vec = incline < -5 ? { x: hip.x + 42, y: hip.y + 22 } : { x: hip.x + 48, y: ANKLE.y };
  if (incline < -5) props.push({ kind: 'pad', a: { x: ankle.x + 2, y: ankle.y + 9 }, b: { x: ankle.x + 3, y: ankle.y + 9 }, w: 10 });
  return { hip, shoulder, torso, ankle, props };
}

function lyingPress({ incline, load, touch = 14 }: LyingPressOpts) {
  const { hip, shoulder, torso, ankle, props } = lyingSetup(incline);
  const chestSide = dir(torso + 90);
  // 頂端：手在肩膀正上方；底部：碰到胸口（啞鈴可以放得比槓再低一點）
  const lockout = { x: shoulder.x + 2, y: shoulder.y - ARM + 1 };
  const chest = add(toward(shoulder, torso + 180, touch), scale(chestSide, load === 'dumbbell' ? 5 : 9));
  // 史密斯機的槓走固定的垂直軌道
  const bottom = load === 'smith' ? { x: lockout.x, y: chest.y } : chest;
  const staticProps = [...props];
  if (load === 'smith') staticProps.push({ kind: 'frame', pts: [{ x: lockout.x - 12, y: 8 }, { x: lockout.x - 12, y: FLOOR }] });

  const pose = (p: number): Pose => {
    const hand = lerpVec(lockout, bottom, p);
    return side({
      hip,
      torso,
      ankle,
      kneePrefer: (k) => -k.y,
      toeDeg: incline < -5 ? 30 : 90,
      hand,
      elbowPrefer: (e) => e.y,
      ...(load === 'dumbbell' ? { props: [{ kind: 'dumbbell', at: hand }] } : { bar: hand }),
    });
  };
  return { pose, props: staticProps, grounded: incline >= -5 };
}

function pressDemo(opts: LyingPressOpts, captions: SideDemo['captions']): SideDemo {
  const { pose, props, grounded } = lyingPress(opts);
  return {
    pose,
    props,
    grounded,
    timing: { down: 1.5, bottomHold: 0.3, up: 1.1, topHold: 0.6 },
    captions,
    labels: { start: '手臂伸直', end: '碰到胸口' },
  };
}

const PRESS_CAPTIONS = {
  down: '吸氣撐住，慢慢放到胸口',
  bottom: '輕觸胸口，肩胛保持夾緊',
  up: '腳推地，往肩膀正上方推',
  top: '手臂伸直，準備下一下',
};

// ───────── 機械胸推（坐姿） ─────────

const SEAT_HIP: Vec = { x: 70, y: 148 };
const SEAT_ANKLE: Vec = { x: 116, y: ANKLE.y };

function seatProps(back: number): Prop[] {
  const backTop = toward(SEAT_HIP, back, 62);
  return [
    { kind: 'pad', a: { x: SEAT_HIP.x - 10, y: SEAT_HIP.y + 11 }, b: { x: SEAT_HIP.x + 26, y: SEAT_HIP.y + 11 }, w: 9 },
    { kind: 'pad', a: toward({ x: SEAT_HIP.x - 10, y: SEAT_HIP.y }, back, 4), b: { x: backTop.x - 10, y: backTop.y }, w: 9 },
    { kind: 'frame', pts: [{ x: SEAT_HIP.x + 4, y: SEAT_HIP.y + 15 }, { x: SEAT_HIP.x + 4, y: FLOOR }] },
  ];
}

function machinePress(incline: boolean): SideDemo {
  const back = -14;
  const shoulder = toward(SEAT_HIP, back, BODY.torso);
  const start = { x: shoulder.x + 12, y: shoulder.y + 6 };
  const end = incline ? toward(shoulder, 58, ARM - 1) : toward(shoulder, 92, ARM - 1);
  const pivot: Vec = { x: 186, y: incline ? 150 : 40 };
  return {
    pose: (p) => {
      const hand = lerpVec(end, start, p);
      return side({
        hip: SEAT_HIP,
        torso: back,
        ankle: SEAT_ANKLE,
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: (e) => e.y,
        props: [
          { kind: 'frame', pts: [pivot, hand] },
          { kind: 'handle', at: hand },
        ],
      });
    },
    props: [...seatProps(back), { kind: 'frame', pts: [{ x: 186, y: 30 }, { x: 186, y: FLOOR }] }],
    timing: { down: 1.4, bottomHold: 0.3, up: 1.1, topHold: 0.5 },
    captions: {
      down: '慢慢讓握把回到胸前',
      bottom: '胸口有伸展感，背部貼著靠墊',
      up: incline ? '往前上方推出' : '往前推出，手臂不要完全鎖死',
      top: '胸口用力夾，肩膀不要往前',
    },
    labels: { start: '推出', end: '回到胸前' },
  };
}

// ───────── 飛鳥、夾胸（俯視、正面） ─────────

/** 俯視躺在椅子上：頭在左邊，假人的左側在畫面上方 */
const TOP_PELVIS: Vec = { x: 128, y: 100 };

function lyingFly(incline: boolean): FrontDemo {
  return {
    kind: 'front',
    top: true,
    floor: false,
    grounded: false,
    pose: (p) => {
      // p = 0 手在胸口上方（從上面看幾乎看不到手臂長度），p = 1 手臂往兩側打開
      const fs = lerp(0.18, 0.95, p);
      const l: FrontSideSpec = { upper: -8, fore: 0, upperFs: fs, foreFs: fs, thigh: 90, shin: 90, shinFs: 0.25, back: ['shin'] };
      const pose = front({
        pelvis: TOP_PELVIS,
        spine: -90,
        torsoFs: incline ? 0.86 : 1,
        l,
        r: { ...l, upper: -172, fore: 180 },
      });
      pose.props = [
        { kind: 'dumbbell', at: pose.l.hand, angle: 0 },
        { kind: 'dumbbell', at: pose.r.hand, angle: 0 },
      ];
      return pose;
    },
    props: [{ kind: 'pad', a: { x: 40, y: 100 }, b: { x: 140, y: 100 }, w: 26 }],
    view: { top: 10, height: 180 },
    timing: { down: 1.8, bottomHold: 0.4, up: 1.3, topHold: 0.4 },
    captions: {
      down: '手肘微彎固定，往兩側畫弧打開',
      bottom: '打開到胸口有伸展感就停',
      up: '像抱大樹一樣往中間合起來',
      top: '啞鈴在胸口上方，胸肌夾緊',
    },
    labels: { start: '合起（從上方看）', end: '打開' },
  };
}

/** 正面：坐姿（蝴蝶機）或站姿（繩索）的夾胸；hands 決定手的高度路線 */
function standingFly(kind: 'pec-deck' | 'cable' | 'low' | 'high' | 'rear-pec' | 'rear-cable'): FrontDemo {
  const seated = kind === 'pec-deck' || kind === 'rear-pec';
  const pelvis = seated ? { x: 100, y: 133 } : { x: 100, y: FLOOR - 5 - BODY.thigh - BODY.shin };
  const reverse = kind === 'rear-pec' || kind === 'rear-cable';
  // 起點、終點：上臂往側面的角度與看起來的長度
  const openAngle = kind === 'low' ? 140 : kind === 'high' ? 50 : 92;
  const closeAngle = kind === 'low' ? 160 : kind === 'high' ? 150 : 95;
  const pulleyY = kind === 'low' ? 190 : kind === 'high' ? 20 : 60;
  return {
    kind: 'front',
    pose: (p) => {
      const t = reverse ? 1 - p : p; // 反向飛鳥：從合起往外打開
      const fs = lerp(1, -0.25, t);
      const angle = lerp(openAngle, closeAngle, t);
      const l: FrontSideSpec = seated
        ? { upper: angle, fore: reverse ? angle : 0, upperFs: fs, foreFs: reverse ? fs : 1, thigh: 165, thighFs: 0.35, shin: 178 }
        : { upper: angle, fore: angle + 8, upperFs: fs, foreFs: fs };
      const pose = front({ pelvis, l, r: mirror(l) });
      const props: Prop[] = [];
      if (!seated) {
        props.push({ kind: 'cable', a: { x: reverse ? 14 : 192, y: pulleyY }, b: pose.l.hand });
        props.push({ kind: 'cable', a: { x: reverse ? 186 : 8, y: pulleyY }, b: pose.r.hand });
        props.push({ kind: 'handle', at: pose.l.hand }, { kind: 'handle', at: pose.r.hand });
      } else {
        props.push({ kind: 'pad', a: pose.l.elbow, b: pose.l.hand, w: 5 }, { kind: 'pad', a: pose.r.elbow, b: pose.r.hand, w: 5 });
      }
      pose.props = props;
      return pose;
    },
    props: seated
      ? [
          { kind: 'pad', a: { x: 80, y: 144 }, b: { x: 120, y: 144 }, w: 9 },
          { kind: 'frame', pts: [{ x: 100, y: 150 }, { x: 100, y: FLOOR }] },
        ]
      : [
          { kind: 'frame', pts: [{ x: 196, y: 10 }, { x: 196, y: FLOOR }] },
          { kind: 'frame', pts: [{ x: 4, y: 10 }, { x: 4, y: FLOOR }] },
        ],
    grounded: !seated,
    timing: { down: 1.2, bottomHold: 0.4, up: 1.5, topHold: 0.3 },
    captions: reverse
      ? {
          down: '手臂微彎，往兩側後方打開',
          bottom: '肩膀後側用力，肩胛不要聳起',
          up: '慢慢回到前面',
          top: '手在前方，肩膀放鬆往下',
        }
      : {
          down: kind === 'low' ? '由下往上、往中間畫弧' : kind === 'high' ? '由上往下、往中間畫弧' : '手肘微彎，往中間畫弧合起',
          bottom: '手在胸前合起，胸肌夾緊',
          up: '慢慢打開，感覺胸口伸展',
          top: '打開到肩膀前側，手肘保持微彎',
        },
    labels: reverse ? { start: '手在前方', end: '往後打開' } : { start: '打開', end: '合起' },
  };
}

// ───────── 仰臥拉舉、雙槓、伏地挺身 ─────────

const pullover: SideDemo = (() => {
  const { hip, shoulder, torso, ankle, props } = lyingSetup(0);
  return {
    pose: (p) => {
      // 手臂幾乎伸直，從胸口上方往頭後方畫弧
      const armDeg = lerp(2, -80, p);
      const hand = toward(shoulder, armDeg, ARM - 3);
      return side({
        hip,
        torso,
        ankle,
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: (e) => -e.x - e.y,
        props: [{ kind: 'dumbbell', at: hand, angle: 90 }],
      });
    },
    props,
    timing: { down: 1.8, bottomHold: 0.4, up: 1.4, topHold: 0.4 },
    captions: {
      down: '手肘微彎固定，啞鈴往頭後方放下',
      bottom: '放到手臂接近和身體平行，胸側有伸展感',
      up: '用胸口與背部把啞鈴拉回胸口上方',
      top: '啞鈴回到胸口正上方',
    },
    labels: { start: '胸口上方', end: '頭後方' },
  };
})();

/** 雙槓撐體：手撐在雙槓上，身體往下沉（assist：膝蓋跪在輔助踏板上） */
function dip(assist: boolean): SideDemo {
  const hand: Vec = { x: 104, y: 92 };
  return {
    pose: (p) => {
      // 手臂伸直時肩在手的正上方；下沉時肩膀往前下、手肘往後
      const lean = lerp(8, 22, p);
      const shoulder = { x: hand.x - lerp(0, 10, p), y: hand.y - lerp(ARM - 1, 22, p) };
      const hip = toward(shoulder, 180 + lean, BODY.torso);
      // 小腿往後彎、腳踝交叉在身體後方
      const knee = toward(hip, assist ? 180 : 165, BODY.thigh);
      const ankle = toward(knee, assist ? 270 : 250, BODY.shin);
      const pose = side({
        hip,
        torso: lean,
        headTilt: 6,
        ankle,
        knee,
        toeDeg: assist ? 180 : 200,
        hand,
        elbowPrefer: (e) => -e.x,
      });
      if (assist) pose.props = [{ kind: 'pad', a: { x: knee.x - 18, y: knee.y + 8 }, b: { x: knee.x + 4, y: knee.y + 8 }, w: 6 }];
      return pose;
    },
    props: [
      { kind: 'frame', pts: [{ x: hand.x + 6, y: hand.y + 3 }, { x: hand.x + 6, y: FLOOR }] },
      { kind: 'bar', at: { x: hand.x, y: hand.y + 3 } },
      ...(assist ? [{ kind: 'frame' as const, pts: [{ x: 40, y: FLOOR }, { x: 40, y: 60 }, { x: hand.x - 6, y: 60 }] }] : []),
    ],
    grounded: false,
    timing: { down: 1.5, bottomHold: 0.3, up: 1.1, topHold: 0.5 },
    captions: {
      down: '身體微微前傾，慢慢往下沉',
      bottom: '上臂約與地面平行，肩膀不要聳起',
      up: '推回到手臂伸直',
      top: '頂端鎖定，胸口挺起',
    },
    labels: { start: '撐起', end: '最低點' },
  };
}

/** 伏地挺身：腳尖撐地、身體一直線繞著腳尖轉；handY 是手撐的高度（上斜時手放在椅子上） */
function pushUp(handY: number, narrow: boolean): SideDemo {
  // 腳尖踩地、腳跟抬起（腳尖朝前下方 60 度）
  const TOE_DEG = 150;
  const ft = foot({ x: 0, y: 0 }, TOE_DEG);
  const ankle: Vec = { x: 20 - ft.toe.x, y: FLOOR - ft.toe.y };
  const bodyLen = BODY.shin + BODY.thigh + BODY.torso;
  const handTop = (() => {
    // 頂端：手臂垂直，肩 = 手 + 上方 ARM；身長固定 → 解出手的 x
    const sy = handY - (ARM - 1);
    const dx = Math.sqrt(bodyLen ** 2 - (ankle.y - sy) ** 2);
    return { x: ankle.x + dx, y: handY };
  })();
  const deg = (sy: number) => Math.asin((ankle.y - sy) / bodyLen); // 身體與地面的夾角
  return {
    pose: (p) => {
      const sy = lerp(handY - (ARM - 1), handY - (narrow ? 14 : 12), p);
      const a = deg(sy);
      const along = (len: number): Vec => ({ x: ankle.x + Math.cos(a) * len, y: ankle.y - Math.sin(a) * len });
      const knee = along(BODY.shin);
      const hip = along(BODY.shin + BODY.thigh);
      const torsoDeg = 90 - (a * 180) / Math.PI;
      return side({
        hip,
        torso: torsoDeg,
        headTilt: -6,
        ankle,
        knee,
        toeDeg: TOE_DEG,
        hand: handTop,
        elbowPrefer: narrow ? (e) => -e.x - e.y : (e) => -e.x + e.y,
      });
    },
    props: handY < FLOOR - 10 ? [{ kind: 'pad', a: { x: handTop.x - 14, y: handY + 5 }, b: { x: handTop.x + 18, y: handY + 5 }, w: 9 }, { kind: 'frame', pts: [{ x: handTop.x, y: handY + 9 }, { x: handTop.x, y: FLOOR }] }] : [],
    grounded: false,
    timing: { down: 1.3, bottomHold: 0.2, up: 1, topHold: 0.5 },
    captions: {
      down: narrow ? '手肘貼近身體往後彎，胸口靠近雙手' : '身體一直線，手肘約 45 度往後彎',
      bottom: '胸口接近地面，核心收緊、臀部不下垂',
      up: '推地回到手臂伸直',
      top: '肩膀在手的正上方',
    },
    labels: { start: '撐起', end: '最低點' },
  };
}

export const CHEST_DEMOS: Record<string, Demo> = {
  'incline-bench-press': pressDemo({ incline: 30, load: 'barbell', touch: 8 }, { ...PRESS_CAPTIONS, down: '吸氣撐住，槓放到上胸（鎖骨下方）' }),
  'decline-bench-press': pressDemo({ incline: -15, load: 'barbell', touch: 22 }, { ...PRESS_CAPTIONS, down: '腳勾好，槓放到下胸' }),
  'db-bench-press': pressDemo({ incline: 0, load: 'dumbbell' }, { ...PRESS_CAPTIONS, down: '啞鈴往兩側下放到胸口高度' }),
  'db-incline-press': pressDemo({ incline: 30, load: 'dumbbell', touch: 8 }, { ...PRESS_CAPTIONS, down: '啞鈴下放到上胸兩側' }),
  'db-decline-press': pressDemo({ incline: -15, load: 'dumbbell', touch: 22 }, { ...PRESS_CAPTIONS, down: '啞鈴下放到下胸兩側' }),
  'smith-bench-press': pressDemo({ incline: 0, load: 'smith', touch: 18 }, { ...PRESS_CAPTIONS, up: '沿著軌道推回頂端' }),
  'smith-incline-press': pressDemo({ incline: 30, load: 'smith', touch: 10 }, { ...PRESS_CAPTIONS, up: '沿著軌道推回頂端' }),
  'close-grip-bench': pressDemo(
    { incline: 0, load: 'barbell', touch: 20 },
    { down: '手肘貼近身體，槓放到下胸', bottom: '輕觸胸口，手肘不要往外張', up: '用三頭把槓推回肩膀上方', top: '手臂伸直鎖定' },
  ),
  'machine-chest-press': machinePress(false),
  'incline-machine-press': machinePress(true),
  'db-fly': lyingFly(false),
  'db-incline-fly': lyingFly(true),
  'pec-deck-fly': standingFly('pec-deck'),
  'cable-fly': standingFly('cable'),
  'low-cable-fly': standingFly('low'),
  'high-cable-fly': standingFly('high'),
  'rear-delt-fly': standingFly('rear-pec'),
  'cable-rear-delt-fly': standingFly('rear-cable'),
  'db-pullover': pullover,
  dips: dip(false),
  'assisted-dip': dip(true),
  'push-up': pushUp(FLOOR - 6, false),
  'diamond-push-up': pushUp(FLOOR - 6, true),
  'incline-push-up': pushUp(138, false),
};
