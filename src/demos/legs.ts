/**
 * 腿部動作的假人示範
 * 深蹲類：重量（槓、啞鈴）要維持在腳掌中心上方，所以上身前傾角是算出來的——
 * 槓放在背後（背蹲）身體較前傾，重量在前面（前蹲、高腳杯）身體較直立。
 */
import { hinge, hipThrustDemo, MIDFOOT, PLATE_R } from './barbell';
import {
  ANKLE,
  ARM,
  FLOOR,
  FRONT_PELVIS,
  HANG,
  LEG,
  STAND_HIP,
  farLeg,
  foot,
  front,
  legAngles,
  legTo,
  lerp,
  mirror,
  phase,
  side,
  tiptoe,
  type FrontSideSpec,
} from './build';
import { add, angleBetween, dir, lerpVec, scale, sub, toward } from './kinematics';
import { BODY, rad, type Demo, type FrontDemo, type Pose, type Prop, type SideDemo, type Vec } from './types';

const SQUAT_TIMING = { down: 1.7, bottomHold: 0.25, up: 1.1, topHold: 0.8 };
const midfootGuide = () => ({ x: MIDFOOT, label: '腳掌中心' });

// ───────── 深蹲家族 ─────────

type SquatLoad = 'front' | 'goblet' | 'hang' | 'smith';

/** 重量相對於肩膀的位置（b = 上身前傾角，弧度） */
function loadPoint(load: SquatLoad, shoulder: Vec, b: number): Vec {
  const up = { x: Math.sin(b), y: -Math.cos(b) };
  const fwd = { x: Math.cos(b), y: Math.sin(b) };
  switch (load) {
    case 'front':
      return add(shoulder, add(scale(fwd, 9), scale(up, 2)));
    case 'goblet':
      return add(shoulder, add(scale(fwd, 15), scale(up, -16)));
    case 'hang':
      return { x: shoulder.x, y: shoulder.y + ARM - 1 };
    case 'smith':
      return add(shoulder, add(scale(fwd, -5), scale(up, -2)));
  }
}

function squatFamily(load: SquatLoad, opts: { shinMax?: number; thighMax?: number; target?: number } = {}) {
  const shinMax = opts.shinMax ?? 34;
  const thighMax = opts.thighMax ?? 100;
  const target = opts.target ?? MIDFOOT;
  return (p: number): Pose => {
    const s = rad(5 + (shinMax - 5) * p);
    const t = rad(thighMax * p);
    const knee = { x: ANKLE.x + BODY.shin * Math.sin(s), y: ANKLE.y - BODY.shin * Math.cos(s) };
    const hip = { x: knee.x - BODY.thigh * Math.sin(t), y: knee.y - BODY.thigh * Math.cos(t) };
    // 二分法找上身前傾角：讓重量落在目標的正上方
    let lo = rad(-10);
    let hi = rad(80);
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const shoulder = toward(hip, (mid * 180) / Math.PI, BODY.torso);
      // 重量太前面就少前傾一點，太後面就多前傾一點
      if (loadPoint(load, shoulder, mid).x > target) hi = mid;
      else lo = mid;
    }
    const b = (lo + hi) / 2;
    const torso = (b * 180) / Math.PI;
    const shoulder = toward(hip, torso, BODY.torso);
    const weight = loadPoint(load, shoulder, b);
    const base = { hip, torso, ankle: ANKLE, knee, headTilt: load === 'front' ? -4 : 0 };
    switch (load) {
      case 'front':
        // 前架式：手肘往前抬高
        return side({ ...base, hand: add(weight, { x: -2, y: -1 }), elbowPrefer: (e) => e.x - e.y * 0.2, bar: weight });
      case 'smith':
        return side({ ...base, hand: add(weight, { x: 3, y: 1 }), elbowPrefer: (e) => e.y - e.x, bar: weight });
      case 'goblet':
        return side({ ...base, hand: add(weight, { x: -3, y: 2 }), elbowPrefer: (e) => e.y, props: [{ kind: 'dumbbell', at: weight, angle: 90 }] });
      case 'hang':
        return side({ ...base, hand: weight, elbowPrefer: (e) => e.x, props: [{ kind: 'dumbbell', at: add(weight, { x: 0, y: 6 }), angle: 90 }] });
    }
  };
}

function squatDemo(load: SquatLoad, captions: SideDemo['captions'], opts: { shinMax?: number; thighMax?: number; target?: number } = {}): SideDemo {
  const demo: SideDemo = { pose: squatFamily(load, opts), timing: SQUAT_TIMING, captions, guideX: midfootGuide };
  if (load === 'smith') demo.props = [{ kind: 'frame', pts: [{ x: (opts.target ?? MIDFOOT) - 14, y: 8 }, { x: (opts.target ?? MIDFOOT) - 14, y: FLOOR }] }];
  return demo;
}

// ───────── 哈克深蹲、腿推 ─────────

const hackSquat: SideDemo = (() => {
  const ankle: Vec = { x: 122, y: ANKLE.y };
  const rail = -22; // 滑軌方向（往上往後）
  const topHip = add(ankle, { x: -24, y: -86 });
  return {
    pose: (p) => {
      // 背靠著滑板，沿著滑軌往下
      const hip = toward(topHip, rail + 180, lerp(0, 44, p));
      const shoulder = toward(hip, rail, BODY.torso);
      return side({
        hip,
        torso: rail,
        ankle,
        hand: add(shoulder, { x: 4, y: -4 }),
        elbowPrefer: (e) => e.x,
        props: [{ kind: 'pad', a: toward(add(hip, { x: -10, y: 4 }), rail, -6), b: toward(add(shoulder, { x: -10, y: 4 }), rail, 8), w: 8 }],
      });
    },
    props: [{ kind: 'frame', pts: [toward({ x: 70, y: FLOOR }, rail, 0), toward({ x: 70, y: FLOOR }, rail, 170)] }],
    timing: SQUAT_TIMING,
    captions: {
      down: '背貼著靠墊，膝蓋順著腳尖方向往下蹲',
      bottom: '蹲到大腿約與踏板平行，臀部不離開靠墊',
      up: '整個腳掌推踏板站起',
      top: '膝蓋不要完全鎖死',
    },
    labels: { start: '站直', end: '最低點' },
  };
})();

/** 腿推（calf：腿推機提踵） */
function legPress(calf: boolean): SideDemo {
  const hip: Vec = { x: 74, y: 156 };
  const rail = 50;
  const torso = -52;
  const sole = rail - 90; // 腳底朝滑軌方向
  return {
    pose: (p) => {
      const dist = calf ? LEG - 1 : lerp(LEG - 2, 44, p);
      // 提踵：腿不動，腳尖把踏板往外推
      const toeDeg = calf ? sole + lerp(0, 28, p) : sole;
      const ankle = toward(hip, rail, dist);
      const ft = foot(ankle, toeDeg);
      const plate = toward(ft.toe, rail, 2);
      return side({
        hip,
        torso,
        ankle,
        kneePrefer: (k) => -k.y - k.x,
        feet: ft,
        hand: add(hip, { x: 4, y: -4 }),
        elbowPrefer: (e) => e.y,
        props: [{ kind: 'pad', a: toward(plate, sole, -16), b: toward(plate, sole, 26), w: 6 }],
      });
    },
    props: [
      { kind: 'pad', a: toward(add(hip, { x: -8, y: 8 }), torso, -4), b: toward(add(hip, { x: -8, y: 8 }), torso, 60), w: 9 },
      { kind: 'frame', pts: [{ x: 30, y: FLOOR }, add(hip, { x: 4, y: 14 })] },
      { kind: 'frame', pts: [toward(hip, rail, 30), toward(hip, rail, 150)] },
    ],
    grounded: false,
    timing: calf ? { down: 0.8, bottomHold: 0.6, up: 1, topHold: 0.3 } : SQUAT_TIMING,
    captions: calf
      ? {
          down: '膝蓋伸直，用腳尖把踏板往外推',
          bottom: '腳尖踩到最遠，小腿用力停一下',
          up: '慢慢讓腳跟往回，感覺小腿伸展',
          top: '只動腳踝，膝蓋保持伸直',
        }
      : {
          down: '慢慢彎膝，讓踏板往胸口靠近',
          bottom: '下背和臀部貼著椅背不捲起來',
          up: '整個腳掌推踏板',
          top: '腿伸直但膝蓋不要鎖死',
        },
    labels: calf ? { start: '腳跟往回', end: '腳尖推出' } : { start: '腿伸直', end: '最低點' },
  };
}

// ───────── 弓箭步、分腿蹲、登階 ─────────

type LungeKind = 'walking' | 'reverse' | 'smith' | 'bulgarian';

function lunge(kind: LungeKind): SideDemo {
  const bulgarian = kind === 'bulgarian';
  const frontAnkle: Vec = { x: bulgarian ? 128 : 124, y: ANKLE.y };
  // 後腳：一般弓箭步腳尖踩地、腳跟抬起；保加利亞分腿蹲腳背放在椅子上
  const backToe: Vec = { x: 56, y: FLOOR };
  const back = bulgarian ? { ankle: { x: 30, y: 144 }, toeDeg: 262 } : null;
  const top: Vec = bulgarian ? { x: 96, y: 112 } : { x: 88, y: 116 };
  const bottom: Vec = bulgarian ? { x: 84, y: 150 } : { x: 80, y: 148 };
  const load = kind === 'smith' ? 'bar' : 'dumbbell';
  return {
    pose: (p) => {
      const hip = lerpVec(top, bottom, p);
      const tip = back ? null : tiptoe(backToe, lerp(35, 62, p));
      const backAnkle = back?.ankle ?? tip!.ankle;
      const backFoot = back ? foot(back.ankle, back.toeDeg) : { heel: tip!.heel, toe: tip!.toe };
      const torso = bulgarian ? lerp(2, 14, p) : 2;
      const pose = side({
        hip,
        torso,
        ankle: frontAnkle,
        arm: load === 'bar' ? [150, 30] : [180, 180],
        far: { knee: legTo(hip, backAnkle, (k) => k.y + k.x * 0.2), ankle: backAnkle, ...backFoot },
      });
      if (load === 'bar') {
        const bar = add(pose.shoulder, { x: -5, y: -2 });
        return { ...side({ hip, torso, ankle: frontAnkle, hand: add(bar, { x: 3, y: 1 }), elbowPrefer: (e) => e.y - e.x, far: pose.far! }), bar };
      }
      return { ...pose, props: [{ kind: 'dumbbell', at: pose.hand }] };
    },
    props: bulgarian
      ? [
          { kind: 'pad', a: { x: 6, y: 155 }, b: { x: 48, y: 155 }, w: 9 },
          { kind: 'frame', pts: [{ x: 26, y: 159 }, { x: 26, y: FLOOR }] },
        ]
      : kind === 'smith'
        ? [{ kind: 'frame', pts: [{ x: 70, y: 8 }, { x: 70, y: FLOOR }] }]
        : [],
    grounded: false,
    timing: { down: 1.5, bottomHold: 0.3, up: 1.1, topHold: 0.6 },
    captions: {
      down: bulgarian ? '後腳放在椅子上，身體直直往下沉' : kind === 'reverse' ? '往後跨一大步，身體直直往下' : '往前跨一大步，身體直直往下',
      bottom: '後膝接近地面，前膝在腳的正上方',
      up: '前腳的腳跟推地站起',
      top: kind === 'walking' ? '後腳往前跨，換腳繼續走' : '站穩，上身保持直立',
    },
    labels: { start: '站起', end: '最低點' },
  };
}

const stepUp: SideDemo = (() => {
  const box: Prop = { kind: 'box', x: 100, y: 154, w: 66, h: FLOOR - 154 };
  const frontAnkle: Vec = { x: 122, y: 148 };
  return {
    pose: (p) => {
      const hip = lerpVec({ x: 96, y: 118 }, { x: 118, y: 148 - LEG + 1 }, p);
      const farAnkle = lerpVec({ x: 62, y: ANKLE.y }, { x: 106, y: 148 }, phase(p, 0, 0.7));
      const pose = side({
        hip,
        torso: lerp(16, 2, p),
        ankle: frontAnkle,
        arm: [180, 180],
        far: farLeg(hip, farAnkle),
      });
      return { ...pose, props: [{ kind: 'dumbbell', at: pose.hand }] };
    },
    props: [box],
    grounded: false,
    view: { top: -40, height: 250 },
    timing: { down: 1.2, bottomHold: 0.4, up: 1.4, topHold: 0.5 },
    captions: {
      down: '整個腳掌踩在箱子上，用前腳推上去',
      bottom: '在箱子上站直，臀部夾緊',
      up: '慢慢把後腳放回地面',
      top: '後腳只是輕觸地面，不靠它跳',
    },
    labels: { start: '準備', end: '站上箱子' },
  };
})();

// ───────── 髖鉸鏈：羅馬尼亞、直腿、相撲、六角槓、早安 ─────────

function rdlFamily(kind: 'db' | 'stiff' | 'good-morning'): SideDemo {
  const knee = toward(ANKLE, kind === 'stiff' ? 3 : 8, BODY.shin);
  const maxTorso = kind === 'stiff' ? 82 : 72;
  return {
    pose: (p) => {
      const torso = lerp(0, maxTorso, p);
      if (kind === 'good-morning') {
        // 槓在上背：讓槓（約在肩膀位置）落在腳掌中心上方
        // 槓在上背；臀部往後推時，身體的重量在後面平衡前面的槓
        const { hip, shoulder } = hinge(knee, torso, 0);
        const bar = add(shoulder, scale(dir(torso - 90), 5));
        return side({ hip, knee, torso, ankle: ANKLE, headTilt: 4, hand: add(bar, { x: 2, y: 2 }), elbowPrefer: (e) => e.y - e.x, bar });
      }
      const armDeg = lerp(0, 10, p);
      const { hip, shoulder } = hinge(knee, torso, armDeg);
      const hand = toward(shoulder, 180 + armDeg, ARM - 1);
      return side({
        hip,
        knee,
        torso,
        ankle: ANKLE,
        headTilt: 4,
        hand,
        elbowPrefer: (e) => e.x,
        ...(kind === 'db' ? { props: [{ kind: 'dumbbell', at: hand }] } : { bar: hand }),
      });
    },
    timing: { down: 2, bottomHold: 0.4, up: 1.3, topHold: 0.6 },
    captions:
      kind === 'good-morning'
        ? {
            down: '槓放上背，膝蓋微彎，臀部往後推、上身往前倒',
            bottom: '上身接近水平或腿後緊繃就停',
            up: '臀部往前推，抬起上身',
            top: '站直，背部全程保持平直',
          }
        : {
            down: kind === 'stiff' ? '膝蓋幾乎打直，臀部往後推' : '膝蓋角度固定，臀部往後推，重量沿著腿下滑',
            bottom: '腿後有伸展感就停，背仍保持平直',
            up: '臀部往前推，站直',
            top: '站直，臀部夾緊',
          },
    guideX: midfootGuide,
    labels: { start: '站直', end: '最低點' },
  };
}

/** 相撲硬舉、六角槓硬舉：髖比較低、上身比較直立，重量仍在腳掌中心上方 */
function uprightPull(kind: 'sumo' | 'trap'): SideDemo {
  const lowHip = kind === 'sumo' ? 158 : 152;
  return {
    pose: (p) => {
      const bar = { x: MIDFOOT, y: lerp(95.5, FLOOR - PLATE_R, p) };
      const shoulder = toward(bar, lerp(0, kind === 'sumo' ? 2 : 4, p), ARM - 0.5);
      const hipY = lerp(104, lowHip, p);
      const dy = Math.min(BODY.torso - 0.01, hipY - shoulder.y);
      const hip = { x: shoulder.x - Math.sqrt(BODY.torso ** 2 - dy ** 2), y: hipY };
      return side({
        hip,
        torso: angleBetween(hip, shoulder),
        ankle: ANKLE,
        headTilt: 6,
        hand: bar,
        elbowPrefer: (e) => e.x,
        bar,
      });
    },
    timing: { down: 1.6, bottomHold: 0.5, up: 1.3, topHold: 0.6 },
    captions: {
      down: kind === 'sumo' ? '腳站很寬、腳尖朝外，臀部往下往後' : '站在六角槓中間，臀部往下往後',
      bottom: kind === 'sumo' ? '手在兩腿之間握槓，胸口挺起' : '握住兩側握把，背打直',
      up: '推地站起，膝蓋順著腳尖方向',
      top: '站直鎖定，臀部夾緊',
    },
    guideX: midfootGuide,
    labels: { start: '站直', end: '槓在地面' },
  };
}

// ───────── 臀推、臀橋、後踢、壺鈴擺盪 ─────────

const machineHipThrust: SideDemo = {
  ...(hipThrustDemo as SideDemo),
  pose: (p) => {
    const { bar, ...rest } = (hipThrustDemo as SideDemo).pose(p);
    const pad = bar!;
    return { ...rest, props: [{ kind: 'pad', a: add(pad, { x: -10, y: 2 }), b: add(pad, { x: 10, y: 2 }), w: 8 }] };
  },
  captions: {
    down: '髖部頂著護墊往上推，腳跟推地',
    bottom: '頂端：肩膀到膝蓋一直線，臀部夾緊',
    up: '慢慢放下',
    top: '下巴微收，準備下一下',
  },
};

const gluteBridge: SideDemo = (() => {
  const shoulder: Vec = { x: 58, y: 189 };
  const ankle: Vec = { x: 146, y: ANKLE.y };
  return {
    pose: (p) => {
      const a = lerp(92, 66, p); // 肩 → 髖的方向
      const hip = toward(shoulder, a, BODY.torso);
      return side({
        hip,
        torso: a + 180,
        headTilt: 0,
        ankle,
        kneePrefer: (k) => -k.y,
        hand: { x: shoulder.x + 40, y: 192 },
        elbowPrefer: (e) => -e.y,
      });
    },
    timing: { down: 1, bottomHold: 0.8, up: 1.2, topHold: 0.4 },
    captions: {
      down: '腳跟推地，把臀部往上抬',
      bottom: '頂端：肩膀到膝蓋一直線，臀部用力夾緊',
      up: '慢慢放下',
      top: '臀部輕碰地面，背部不要拱起',
    },
    labels: { start: '臀部在地', end: '抬到最高' },
  };
})();

const cableKickback: SideDemo = (() => {
  const torso = 28;
  const hip: Vec = { x: 92, y: STAND_HIP.y };
  const shoulder = toward(hip, torso, BODY.torso);
  const pulley: Vec = { x: 170, y: 190 };
  return {
    pose: (p) => {
      // 近側腿往後踢，遠側腿站著
      const thigh = lerp(174, 238, p);
      const shin = thigh + lerp(10, 4, p);
      const { knee, ankle } = legAngles(hip, thigh, shin);
      return side({
        hip,
        torso,
        ankle,
        knee,
        toeDeg: shin - 90,
        hand: { x: shoulder.x + 30, y: shoulder.y + 18 },
        elbowPrefer: (e) => e.y,
        far: farLeg(hip, { x: hip.x + 6, y: ANKLE.y }),
        props: [{ kind: 'cable', a: pulley, b: ankle }],
      });
    },
    props: [
      { kind: 'frame', pts: [{ x: 174, y: 40 }, { x: 174, y: FLOOR }] },
      { kind: 'pulley', at: pulley },
      { kind: 'bar', at: { x: shoulder.x + 30, y: shoulder.y + 18 } },
    ],
    grounded: false,
    timing: { down: 1, bottomHold: 0.5, up: 1.3, topHold: 0.3 },
    captions: {
      down: '用臀部把腿往後上方踢',
      bottom: '頂端停一下，臀部夾緊，下背不要拱',
      up: '慢慢放回',
      top: '身體微微前傾，手扶著架子',
    },
    labels: { start: '腿在下方', end: '往後踢' },
  };
})();

const kbSwing: SideDemo = {
  pose: (p) => {
    const knee = toward(ANKLE, lerp(4, 16, p), BODY.shin);
    const hip = toward(knee, lerp(-2, -52, p), BODY.thigh);
    const torso = lerp(-2, 64, p);
    const shoulder = toward(hip, torso, BODY.torso);
    const hand = toward(shoulder, lerp(92, 198, p), ARM - 1);
    return side({ hip, knee, torso, ankle: ANKLE, headTilt: lerp(0, 10, p), hand, elbowPrefer: (e) => -e.y, props: [{ kind: 'kettlebell', at: hand }] });
  },
  timing: { down: 0.6, bottomHold: 0.1, up: 0.6, topHold: 0.25 },
  captions: {
    down: '壺鈴往兩腿之間盪，臀部往後推',
    bottom: '最低點：背平直，像硬舉的髖鉸鏈',
    up: '臀部用力往前推，把壺鈴盪起來',
    top: '站直、臀部夾緊，手只是跟著擺',
  },
  guideX: midfootGuide,
  labels: { start: '盪到胸口', end: '盪到兩腿間' },
};

// ───────── 腿部機器 ─────────

const SEAT_HIP: Vec = { x: 64, y: 140 };

function seatedLegMachine(kind: 'extension' | 'curl'): SideDemo {
  const back = kind === 'curl' ? -22 : -8;
  const knee = toward(SEAT_HIP, 90, BODY.thigh);
  return {
    pose: (p) => {
      const shinDeg = kind === 'extension' ? lerp(176, 92, p) : lerp(96, 206, p);
      const ankle = toward(knee, shinDeg, BODY.shin);
      const shoulder = toward(SEAT_HIP, back, BODY.torso);
      const padSide = kind === 'extension' ? shinDeg + 90 : shinDeg - 90;
      return side({
        hip: SEAT_HIP,
        knee,
        torso: back,
        ankle,
        toeDeg: shinDeg - 90,
        hand: kind === 'extension' ? add(SEAT_HIP, { x: 8, y: 8 }) : add(shoulder, { x: 30, y: 30 }),
        elbowPrefer: (e) => e.y,
        props: [
          { kind: 'pad', a: add(toward(ankle, shinDeg, -6), scale(dir(padSide), 9)), b: add(toward(ankle, shinDeg, -6), scale(dir(padSide), 9)), w: 12 },
          { kind: 'frame', pts: [add(knee, { x: 4, y: 0 }), add(toward(ankle, shinDeg, -6), scale(dir(padSide), 9))] },
        ],
      });
    },
    props: [
      { kind: 'pad', a: { x: SEAT_HIP.x - 14, y: SEAT_HIP.y + 11 }, b: { x: knee.x - 4, y: SEAT_HIP.y + 11 }, w: 9 },
      { kind: 'pad', a: toward({ x: SEAT_HIP.x - 12, y: SEAT_HIP.y + 4 }, back, 0), b: toward({ x: SEAT_HIP.x - 12, y: SEAT_HIP.y + 4 }, back, 62), w: 9 },
      ...(kind === 'curl' ? [{ kind: 'pad' as const, a: add(knee, { x: -22, y: -10 }), b: add(knee, { x: -2, y: -10 }), w: 7 }] : []),
      { kind: 'frame', pts: [{ x: SEAT_HIP.x + 10, y: SEAT_HIP.y + 15 }, { x: SEAT_HIP.x + 10, y: FLOOR }] },
    ],
    grounded: false,
    timing: { down: 1, bottomHold: 0.5, up: 1.5, topHold: 0.3 },
    captions:
      kind === 'extension'
        ? { down: '用大腿前側把小腿往上踢直', bottom: '頂端停一下，股四頭用力', up: '慢慢放下，不要讓配重片撞擊', top: '臀部貼著座位，膝蓋對準機器轉軸' }
        : { down: '用腿後把小腿往下往後勾', bottom: '勾到最底，停一下', up: '慢慢讓小腿回到前方', top: '大腿被護墊固定，臀部不要抬起' },
    labels: kind === 'extension' ? { start: '膝蓋彎曲', end: '腿踢直' } : { start: '腿伸直', end: '勾到底' },
  };
}

const lyingLegCurl: SideDemo = (() => {
  const hip: Vec = { x: 106, y: 150 };
  const knee = toward(hip, -90, BODY.thigh);
  return {
    pose: (p) => {
      const shinDeg = lerp(-88, 18, p);
      const ankle = toward(knee, shinDeg, BODY.shin);
      const shoulder = toward(hip, 90, BODY.torso);
      return side({
        hip,
        knee,
        torso: 90,
        headTilt: 80,
        ankle,
        toeDeg: shinDeg - 90,
        hand: add(shoulder, { x: 22, y: 2 }),
        elbowPrefer: (e) => e.y,
        props: [{ kind: 'pad', a: add(toward(ankle, shinDeg, -6), scale(dir(shinDeg - 90), 9)), b: add(toward(ankle, shinDeg, -6), scale(dir(shinDeg - 90), 9)), w: 12 }],
      });
    },
    props: [
      { kind: 'pad', a: { x: 34, y: 161 }, b: { x: 156, y: 161 }, w: 9 },
      { kind: 'frame', pts: [{ x: 50, y: 165 }, { x: 50, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: 140, y: 165 }, { x: 140, y: FLOOR }] },
    ],
    grounded: false,
    timing: { down: 1, bottomHold: 0.5, up: 1.5, topHold: 0.3 },
    captions: {
      down: '用腿後把腳跟往臀部勾',
      bottom: '勾到最高，停一下',
      up: '慢慢放下，腿不要完全放鬆',
      top: '髖部貼著椅墊，不要抬臀',
    },
    labels: { start: '腿伸直', end: '勾起' },
  };
})();

const nordicCurl: SideDemo = (() => {
  const knee: Vec = { x: 72, y: 188 };
  const ankle = toward(knee, -90, BODY.shin);
  return {
    pose: (p) => {
      // 膝蓋到肩膀維持一直線，慢慢往前倒
      const a = lerp(4, 72, p);
      const hip = toward(knee, a, BODY.thigh);
      const shoulder = toward(hip, a, BODY.torso);
      return side({
        hip,
        knee,
        torso: a,
        ankle,
        toeDeg: 262,
        hand: toward(shoulder, a + lerp(110, 80, p), ARM - 4),
        elbowPrefer: (e) => e.y,
      });
    },
    props: [
      { kind: 'pad', a: { x: 14, y: 196 }, b: { x: 80, y: 196 }, w: 5 },
      { kind: 'pad', a: { x: ankle.x - 2, y: ankle.y - 9 }, b: { x: ankle.x + 2, y: ankle.y - 9 }, w: 9 },
    ],
    grounded: false,
    timing: { down: 2.4, bottomHold: 0.2, up: 1.6, topHold: 0.5 },
    captions: {
      down: '膝蓋到肩膀一直線，用腿後撐著慢慢往前倒',
      bottom: '撐不住時用手接住地面',
      up: '用手輕推，再用腿後把身體拉回來',
      top: '跪直，腳踝固定住',
    },
    labels: { start: '跪直', end: '往前倒' },
  };
})();

// ───────── 髖外展、內收（正面） ─────────

function hipMachine(kind: 'abduction' | 'adduction'): FrontDemo {
  const pelvis: Vec = { x: 100, y: 130 };
  return {
    kind: 'front',
    pose: (p) => {
      const open = kind === 'abduction' ? p : 1 - p;
      const l: FrontSideSpec = { upper: 170, fore: 175, thigh: lerp(166, 116, open), thighFs: lerp(0.45, 0.75, open), shin: 178 };
      const pose = front({ pelvis, l, r: mirror(l) });
      const side = kind === 'abduction' ? 1 : -1; // 護墊在膝蓋外側或內側
      pose.props = [
        { kind: 'pad', a: add(pose.l.knee, { x: side * 8, y: -6 }), b: add(pose.l.knee, { x: side * 8, y: 14 }), w: 6 },
        { kind: 'pad', a: add(pose.r.knee, { x: -side * 8, y: -6 }), b: add(pose.r.knee, { x: -side * 8, y: 14 }), w: 6 },
      ];
      return pose;
    },
    props: [
      { kind: 'pad', a: { x: 76, y: 142 }, b: { x: 124, y: 142 }, w: 9 },
      { kind: 'frame', pts: [{ x: 100, y: 148 }, { x: 100, y: FLOOR }] },
    ],
    grounded: false,
    timing: { down: 1, bottomHold: 0.5, up: 1.4, topHold: 0.3 },
    captions:
      kind === 'abduction'
        ? { down: '膝蓋往外推開', bottom: '打開到最大，臀部外側用力', up: '慢慢合回', top: '上身靠穩椅背，不要前後晃' }
        : { down: '膝蓋往內夾', bottom: '夾到底，大腿內側用力', up: '慢慢打開', top: '打開到大腿內側有伸展感' },
    labels: kind === 'abduction' ? { start: '合起', end: '打開' } : { start: '打開', end: '夾起' },
  };
}

const cableHipAbduction: FrontDemo = {
  kind: 'front',
  pose: (p) => {
    const lift = lerp(178, 138, p);
    const pose = front({
      pelvis: FRONT_PELVIS,
      pelvisTilt: lerp(0, 4, p),
      l: { ...HANG, thigh: lift, shin: lift },
      r: { upper: -120, fore: -110 },
    });
    pose.props = [
      { kind: 'cable', a: { x: 10, y: 192 }, b: pose.l.ankle },
      { kind: 'bar', at: pose.r.hand },
    ];
    return pose;
  },
  props: [
    { kind: 'frame', pts: [{ x: 6, y: 40 }, { x: 6, y: FLOOR }] },
    { kind: 'pulley', at: { x: 10, y: 192 } },
  ],
  grounded: false,
  timing: { down: 1, bottomHold: 0.5, up: 1.3, topHold: 0.3 },
  captions: {
    down: '腿伸直往側邊抬起',
    bottom: '抬到約 30～45 度，臀部外側用力',
    up: '慢慢放回',
    top: '上身保持直立，不要往側邊倒',
  },
  labels: { start: '腿在下方', end: '往側邊抬' },
};

// ───────── 提踵、跳箱 ─────────

/** 提踵：腳尖固定，腳跟抬起；整個人跟著腳踝往上 */
function calfRaise(kind: 'standing' | 'step' | 'single' | 'seated'): SideDemo {
  const step = kind !== 'standing';
  const toe: Vec = { x: 118, y: step ? 184 : FLOOR };
  // 台階只踩到腳掌前段，腳跟懸空才能往下放
  const block: Prop[] = step ? [{ kind: 'box', x: 104, y: toe.y, w: 44, h: FLOOR - toe.y }] : [];
  if (kind === 'seated') {
    const hip: Vec = { x: 62, y: 118 };
    return {
      pose: (p) => {
        const tip = tiptoe(toe, lerp(-12, 26, p));
        const pose = side({ hip, torso: 6, ankle: tip.ankle, kneePrefer: (k) => -k.y, feet: tip, hand: add(hip, { x: 52, y: -14 }), elbowPrefer: (e) => e.y });
        return { ...pose, props: [{ kind: 'pad', a: add(pose.knee, { x: -14, y: -8 }), b: add(pose.knee, { x: 4, y: -8 }), w: 8 }] };
      },
      props: [
        ...block,
        { kind: 'pad', a: { x: hip.x - 14, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
        { kind: 'frame', pts: [{ x: hip.x, y: hip.y + 15 }, { x: hip.x, y: FLOOR }] },
      ],
      grounded: false,
      timing: { down: 0.8, bottomHold: 0.7, up: 1.2, topHold: 0.4 },
      captions: { down: '用腳尖推，把腳跟抬到最高', bottom: '頂端停 1 秒', up: '慢慢放下，讓腳跟低於腳尖', top: '底部感覺小腿伸展' },
      labels: { start: '腳跟放低', end: '腳跟抬起' },
    };
  }
  return {
    pose: (p) => {
      const tip = tiptoe(toe, step ? lerp(-14, 28, p) : lerp(0, 30, p));
      const hip = add(tip.ankle, sub(STAND_HIP, ANKLE));
      const pose = side({
        hip,
        torso: 0,
        ankle: tip.ankle,
        feet: tip,
        ...(kind === 'standing' ? { hand: add(hip, { x: 4, y: -54 }), elbowPrefer: (e: Vec) => e.y } : { arm: [180, 180] as [number, number] }),
      });
      if (kind === 'single') {
        // 另一腳往後勾起，手拿啞鈴
        const farKnee = toward(hip, 186, BODY.thigh);
        const farAnkle = toward(farKnee, 250, BODY.shin);
        return { ...pose, far: { knee: farKnee, ankle: farAnkle, ...foot(farAnkle, 200) }, props: [{ kind: 'dumbbell', at: pose.hand }] };
      }
      if (kind === 'standing') {
        return { ...pose, props: [{ kind: 'pad', a: add(pose.shoulder, { x: -8, y: -9 }), b: add(pose.shoulder, { x: 8, y: -9 }), w: 7 }] };
      }
      return pose;
    },
    props: [...block, ...(kind === 'standing' ? [{ kind: 'frame' as const, pts: [{ x: 60, y: FLOOR }, { x: 60, y: 30 }] }] : [])],
    grounded: false,
    timing: { down: 0.8, bottomHold: 0.7, up: 1.2, topHold: 0.4 },
    captions: {
      down: '用腳尖推，把腳跟抬到最高',
      bottom: '頂端停 1 秒，小腿用力',
      up: step ? '慢慢放下，讓腳跟低於台階' : '慢慢放下',
      top: '膝蓋伸直但不鎖死',
    },
    labels: { start: '腳跟放低', end: '腳跟抬起' },
  };
}

const boxJump: SideDemo = (() => {
  const boxTop = 152;
  /** 站姿：腳踝位置 + 蹲的深度（0～1）+ 手臂角度 */
  const stance = (ankle: Vec, depth: number, armDeg: number, tuck = 0): Pose => {
    const s = 5 + 30 * depth;
    const t = 95 * depth + tuck;
    const knee = toward(ankle, s, BODY.shin);
    const hip = toward(knee, -t, BODY.thigh);
    const torso = 40 * depth;
    return side({ hip, knee, torso, ankle, arm: [armDeg, armDeg - 10] });
  };
  const keys = [
    { p: 0, ankle: { x: 56, y: ANKLE.y }, depth: 0, arm: 180 },
    { p: 0.3, ankle: { x: 56, y: ANKLE.y }, depth: 0.75, arm: 230 },
    { p: 0.62, ankle: { x: 108, y: boxTop - 22 }, depth: 0.55, arm: 60 },
    { p: 1, ankle: { x: 140, y: boxTop - 6 }, depth: 0.35, arm: 120 },
  ];
  return {
    pose: (p) => {
      const i = Math.max(0, keys.findIndex((k, j) => p >= k.p && p <= (keys[j + 1]?.p ?? 1)));
      const a = keys[i]!;
      const b = keys[Math.min(i + 1, keys.length - 1)]!;
      const t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
      return stance(lerpVec(a.ankle, b.ankle, t), lerp(a.depth, b.depth, t), lerp(a.arm, b.arm, t));
    },
    props: [{ kind: 'box', x: 116, y: boxTop, w: 60, h: FLOOR - boxTop }],
    grounded: false,
    view: { top: -40, height: 250 },
    timing: { down: 1.4, bottomHold: 0.8, up: 1.4, topHold: 0.6 },
    captions: {
      down: '手往後擺、半蹲，接著手往前上方擺用力跳',
      bottom: '輕輕落在箱子中間，膝蓋微彎緩衝',
      up: '從箱子上走下來，不要往後跳下',
      top: '站在箱子前，準備下一下',
    },
    labels: { start: '準備', end: '站上箱子' },
  };
})();

export const LEGS_DEMOS: Record<string, Demo> = {
  'front-squat': squatDemo('front', {
    down: '手肘抬高撐住槓，往下蹲',
    bottom: '上身比背蹲更直立，手肘不要往下掉',
    up: '手肘往上頂，站起來',
    top: '站直、吐氣，準備下一下',
  }),
  'smith-squat': squatDemo(
    'smith',
    { down: '槓沿著軌道往下，臀部往後坐', bottom: '最低點：腳在槓的前方，背部挺直', up: '推地站起', top: '站直，手扶穩槓' },
    { target: MIDFOOT - 12 },
  ),
  'hack-squat': hackSquat,
  'leg-press': legPress(false),
  'goblet-squat': squatDemo('goblet', {
    down: '啞鈴捧在胸前，手肘往兩膝之間下沉',
    bottom: '最低點：上身直立，手肘碰到膝蓋內側',
    up: '推地站起',
    top: '站直，啞鈴貼著胸口',
  }),
  'sumo-squat': squatDemo(
    'hang',
    { down: '腳站很寬、腳尖朝外，直直往下蹲', bottom: '啞鈴垂在兩腿之間，膝蓋順著腳尖方向', up: '推地站起，臀部夾緊', top: '站直，上身保持直立' },
    { shinMax: 24, thighMax: 92 },
  ),
  'bulgarian-split-squat': lunge('bulgarian'),
  'walking-lunge': lunge('walking'),
  'reverse-lunge': lunge('reverse'),
  'smith-lunge': lunge('smith'),
  'step-up': stepUp,
  'db-romanian-deadlift': rdlFamily('db'),
  'stiff-leg-deadlift': rdlFamily('stiff'),
  'good-morning': rdlFamily('good-morning'),
  'sumo-deadlift': uprightPull('sumo'),
  'trap-bar-deadlift': uprightPull('trap'),
  'machine-hip-thrust': machineHipThrust,
  'glute-bridge': gluteBridge,
  'cable-kickback': cableKickback,
  'kb-swing': kbSwing,
  'leg-extension': seatedLegMachine('extension'),
  'leg-curl': seatedLegMachine('curl'),
  'lying-leg-curl': lyingLegCurl,
  'nordic-curl': nordicCurl,
  'hip-abduction': hipMachine('abduction'),
  'hip-adduction': hipMachine('adduction'),
  'cable-hip-abduction': cableHipAbduction,
  'calf-raise': calfRaise('standing'),
  'seated-calf-raise': calfRaise('seated'),
  'leg-press-calf-raise': legPress(true),
  'db-calf-raise': calfRaise('single'),
  'box-jump': boxJump,
};
