/**
 * 手臂動作的假人示範
 * 彎舉：上臂固定在身側，只有前臂繞著手肘轉；三頭：上臂固定，前臂伸直。
 */
import { ANKLE, ARM, FLOOR, STAND_HIP, armAngles, farArm, legTo, lerp, side } from './build';
import { add, dir, scale, toward } from './kinematics';
import { BODY, type Demo, type Prop, type SideDemo, type Vec } from './types';

const CURL_TIMING = { down: 1, bottomHold: 0.4, up: 1.6, topHold: 0.3 };
const CURL_LABELS = { start: '手臂伸直', end: '彎到頂端' };

type Grip = 'bar' | 'db' | 'hammer' | 'cable' | 'cable-hammer';

function grip(kind: Grip, hand: Vec, fore: number, pulley?: Vec): { bar?: Vec; props?: Prop[] } {
  switch (kind) {
    case 'bar':
      return { bar: hand };
    case 'db':
      return { props: [{ kind: 'dumbbell', at: hand }] };
    case 'hammer':
      // 錘式握法：啞鈴握把在畫面中，和前臂垂直
      return { props: [{ kind: 'dumbbell', at: hand, angle: fore }] };
    case 'cable':
    case 'cable-hammer':
      return { props: [{ kind: 'cable', a: pulley!, b: hand }, { kind: 'handle', at: hand }] };
  }
}

/** 站姿彎舉 */
function standingCurl(kind: Grip, captions: SideDemo['captions']): SideDemo {
  const shoulder = toward(STAND_HIP, 0, BODY.torso);
  const pulley: Vec = { x: 150, y: 190 };
  return {
    pose: (p) => {
      const fore = lerp(176, 26, p);
      const { hand } = armAngles(shoulder, 178, fore);
      return side({ hip: STAND_HIP, torso: 0, ankle: ANKLE, arm: [178, fore], ...grip(kind, hand, fore, pulley) });
    },
    ...(kind.startsWith('cable') ? { props: [{ kind: 'frame', pts: [{ x: 156, y: 60 }, { x: 156, y: FLOOR }] }, { kind: 'pulley', at: pulley }] as Prop[] } : {}),
    timing: CURL_TIMING,
    captions,
    labels: CURL_LABELS,
  };
}

const CURL_CAPTIONS = {
  down: '手肘貼著身體，把重量彎舉到肩膀前',
  bottom: '頂端用力夾一下二頭',
  up: '慢慢放下到手臂伸直',
  top: '身體不要前後晃動借力',
};

/** 上臂靠在某個角度固定的姿勢（上斜椅、牧師椅、集中彎舉、機器） */
function supportedCurl(kind: 'incline' | 'preacher' | 'concentration' | 'machine'): SideDemo {
  const setups = {
    incline: { hip: { x: 104, y: 150 }, torso: -42, upper: 180, from: 178, to: 30, ankle: { x: 150, y: ANKLE.y } },
    preacher: { hip: { x: 70, y: 148 }, torso: 16, upper: 140, from: 136, to: 12, ankle: { x: 116, y: ANKLE.y } },
    concentration: { hip: { x: 70, y: 148 }, torso: 36, upper: 170, from: 172, to: 30, ankle: { x: 128, y: ANKLE.y } },
    machine: { hip: { x: 70, y: 148 }, torso: 6, upper: 120, from: 118, to: 6, ankle: { x: 116, y: ANKLE.y } },
  }[kind];
  const shoulder = toward(setups.hip, setups.torso, BODY.torso);
  const elbow = toward(shoulder, setups.upper, BODY.upperArm);
  const props: Prop[] = [{ kind: 'pad', a: { x: setups.hip.x - 14, y: setups.hip.y + 11 }, b: { x: setups.hip.x + 24, y: setups.hip.y + 11 }, w: 9 }];
  props.push({ kind: 'frame', pts: [{ x: setups.hip.x + 4, y: setups.hip.y + 15 }, { x: setups.hip.x + 4, y: FLOOR }] });
  if (kind === 'incline') {
    const back = dir(setups.torso - 90);
    props.push({ kind: 'pad', a: add(toward(setups.hip, setups.torso, -6), scale(back, 9)), b: add(toward(shoulder, setups.torso, 14), scale(back, 9)), w: 9 });
  }
  if (kind === 'preacher' || kind === 'machine') {
    // 手臂靠墊：在上臂下方
    const under = dir(setups.upper + 90);
    props.push({ kind: 'pad', a: add(toward(shoulder, setups.upper, 6), scale(under, 7)), b: add(elbow, scale(under, 7)), w: 8 });
    props.push({ kind: 'frame', pts: [add(elbow, scale(under, 10)), { x: elbow.x, y: FLOOR }] });
  }
  return {
    pose: (p) => {
      const fore = lerp(setups.from, setups.to, p);
      const hand = toward(elbow, fore, BODY.forearm);
      return side({
        hip: setups.hip,
        torso: setups.torso,
        ankle: setups.ankle,
        kneePrefer: (k) => -k.y,
        arm: [setups.upper, fore],
        headTilt: kind === 'concentration' ? 10 : 0,
        ...(kind === 'machine' ? { props: [{ kind: 'handle', at: hand }] } : kind === 'preacher' ? { bar: hand } : { props: [{ kind: 'dumbbell', at: hand }] }),
      });
    },
    props,
    grounded: true,
    timing: CURL_TIMING,
    captions:
      kind === 'incline'
        ? { down: '上臂垂在身體後方，只彎手肘', bottom: '頂端二頭用力', up: '慢慢放到手臂完全伸直，感覺二頭伸展', top: '背靠著椅背，肩膀不要往前' }
        : kind === 'concentration'
          ? { down: '手肘靠在大腿內側，往肩膀彎舉', bottom: '頂端轉一下小指往外，夾緊二頭', up: '慢慢放下', top: '上臂保持靠在大腿上' }
          : { down: '上臂貼著靠墊，往上彎舉', bottom: '頂端用力夾一下', up: '慢慢放下，不要完全放鬆', top: '手肘不要離開靠墊' },
    labels: CURL_LABELS,
  };
}

// ───────── 三頭 ─────────

function pushdown(rope: boolean): SideDemo {
  const hip: Vec = { x: 90, y: STAND_HIP.y + 2 };
  const torso = 8;
  const shoulder = toward(hip, torso, BODY.torso);
  const upper = 176;
  const elbow = toward(shoulder, upper, BODY.upperArm);
  const pulley: Vec = { x: elbow.x + 30, y: 10 };
  return {
    pose: (p) => {
      const fore = lerp(42, rope ? 190 : 178, p);
      const hand = toward(elbow, fore, BODY.forearm);
      return side({
        hip,
        torso,
        ankle: ANKLE,
        arm: [upper, fore],
        props: [{ kind: 'cable', a: pulley, b: hand }, { kind: 'handle', at: hand }],
      });
    },
    props: [{ kind: 'frame', pts: [{ x: pulley.x + 6, y: 4 }, { x: pulley.x + 6, y: FLOOR }] }, { kind: 'pulley', at: pulley }],
    timing: { down: 0.9, bottomHold: 0.4, up: 1.4, topHold: 0.3 },
    captions: {
      down: rope ? '手肘貼著身體，往下壓並把繩子往兩側拉開' : '手肘貼著身體，往下壓到手臂伸直',
      bottom: '底部三頭用力夾緊',
      up: '慢慢讓前臂回到胸口高度',
      top: '上臂不動，只有手肘彎曲',
    },
    labels: { start: '前臂抬起', end: '壓到伸直' },
  };
}

function overheadExtension(kind: 'cable' | 'db'): SideDemo {
  const cable = kind === 'cable';
  const hip: Vec = cable ? { x: 88, y: STAND_HIP.y + 3 } : { x: 80, y: 148 };
  const torso = cable ? 22 : -2;
  const shoulder = toward(hip, torso, BODY.torso);
  const upper = cable ? 30 : 4;
  const elbow = toward(shoulder, upper, BODY.upperArm);
  const pulley: Vec = { x: 12, y: 150 };
  return {
    pose: (p) => {
      const fore = lerp(upper + 160, upper, p);
      const hand = toward(elbow, fore, BODY.forearm);
      return side({
        hip,
        torso,
        ankle: cable ? ANKLE : { x: 126, y: ANKLE.y },
        kneePrefer: cable ? (k) => k.x : (k) => -k.y,
        arm: [upper, fore],
        ...(cable
          ? { props: [{ kind: 'cable', a: pulley, b: hand }, { kind: 'handle', at: hand }], far: { knee: legTo(hip, { x: 66, y: ANKLE.y }), ankle: { x: 66, y: ANKLE.y } } }
          : { props: [{ kind: 'dumbbell', at: hand, angle: fore + 90 }] }),
      });
    },
    props: cable
      ? [{ kind: 'frame', pts: [{ x: 6, y: 40 }, { x: 6, y: FLOOR }] }, { kind: 'pulley', at: pulley }]
      : [
          { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
          { kind: 'frame', pts: [{ x: hip.x + 4, y: hip.y + 15 }, { x: hip.x + 4, y: FLOOR }] },
        ],
    view: { top: -40, height: 250 },
    timing: { down: 1.4, bottomHold: 0.3, up: 1, topHold: 0.4 },
    captions: {
      down: '上臂不動，慢慢讓重量往頭後方放',
      bottom: '頭後方感覺三頭伸展',
      up: '往上伸直手臂',
      top: '手肘朝前，不要往兩側打開',
    },
    labels: { start: '頭後方', end: '手臂伸直' },
  };
}

const skullCrusher: SideDemo = (() => {
  const hip: Vec = { x: 104, y: 142 };
  const torso = -88;
  const shoulder = toward(hip, torso, BODY.torso);
  const upper = -12; // 上臂稍微往頭的方向傾斜
  const elbow = toward(shoulder, upper, BODY.upperArm);
  return {
    pose: (p) => {
      const fore = lerp(upper, upper - 120, p);
      const hand = toward(elbow, fore, BODY.forearm);
      return side({ hip, torso, ankle: { x: 152, y: ANKLE.y }, kneePrefer: (k) => -k.y, arm: [upper, fore], bar: hand });
    },
    props: [
      { kind: 'pad', a: { x: 22, y: 151 }, b: { x: 126, y: 151 }, w: 9 },
      { kind: 'frame', pts: [{ x: 34, y: 155 }, { x: 34, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: 116, y: 155 }, { x: 116, y: FLOOR }] },
    ],
    timing: { down: 1.4, bottomHold: 0.3, up: 1, topHold: 0.4 },
    captions: { down: '上臂固定，只彎手肘把槓放到額頭上方', bottom: '槓在額頭上方，三頭伸展', up: '伸直手肘把槓推回', top: '手臂伸直，上臂稍微往頭的方向傾斜' },
    labels: { start: '手臂伸直', end: '槓到額頭' },
  };
})();

const dbKickback: SideDemo = (() => {
  const hip: Vec = { x: 70, y: 118 };
  const torso = 75;
  const shoulder = toward(hip, torso, BODY.torso);
  const upper = torso + 180 + 8; // 上臂貼著身體往後
  return {
    pose: (p) => {
      const fore = lerp(182, upper - 6, p);
      const { hand } = armAngles(shoulder, upper, fore);
      return side({
        hip,
        torso,
        headTilt: 8,
        ankle: { x: 50, y: ANKLE.y },
        arm: [upper, fore],
        far: { ...farArm(shoulder, { x: shoulder.x + 18, y: 144 }, (e) => e.x), knee: legTo(hip, { x: 104, y: ANKLE.y }), ankle: { x: 104, y: ANKLE.y } },
        props: [{ kind: 'dumbbell', at: hand }],
      });
    },
    props: [
      { kind: 'pad', a: { x: 124, y: 151 }, b: { x: 192, y: 151 }, w: 9 },
      { kind: 'frame', pts: [{ x: 134, y: 155 }, { x: 134, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: 184, y: 155 }, { x: 184, y: FLOOR }] },
    ],
    timing: { down: 0.9, bottomHold: 0.5, up: 1.3, topHold: 0.3 },
    captions: { down: '上臂貼著身體不動，把前臂往後伸直', bottom: '手臂伸直，三頭夾緊', up: '慢慢讓前臂回到垂直', top: '上身前傾，另一手撐在椅子上' },
    labels: { start: '前臂垂下', end: '往後伸直' },
  };
})();

const machineTriceps: SideDemo = (() => {
  const hip: Vec = { x: 80, y: 148 };
  const torso = 2;
  const shoulder = toward(hip, torso, BODY.torso);
  return {
    pose: (p) => {
      const hand = { x: shoulder.x + lerp(14, 4, p), y: shoulder.y + lerp(14, 46, p) };
      return side({ hip, torso, ankle: { x: 126, y: ANKLE.y }, kneePrefer: (k) => -k.y, hand, elbowPrefer: (e) => -e.x, props: [{ kind: 'handle', at: hand }, { kind: 'frame', pts: [hand, { x: hand.x + 30, y: hand.y }] }] });
    },
    props: [
      { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
      { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 4 }, b: { x: hip.x - 14, y: hip.y - 62 }, w: 9 },
      { kind: 'frame', pts: [{ x: hip.x + 4, y: hip.y + 15 }, { x: hip.x + 4, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: 150, y: 70 }, { x: 150, y: FLOOR }] },
    ],
    timing: { down: 0.9, bottomHold: 0.4, up: 1.4, topHold: 0.3 },
    captions: { down: '把握把往下推到手臂伸直', bottom: '底部三頭夾緊', up: '慢慢讓握把回到胸口側邊', top: '肩膀往下，手肘往後' },
    labels: { start: '手在胸側', end: '推到伸直' },
  };
})();

const benchDip: SideDemo = (() => {
  const handOnBench: Vec = { x: 58, y: 146 };
  const ankle: Vec = { x: 150, y: 186 };
  return {
    pose: (p) => {
      const shoulder = { x: handOnBench.x + lerp(4, 12, p), y: handOnBench.y - lerp(ARM - 1, 22, p) };
      const torso = -6;
      const hip = toward(shoulder, torso + 180, BODY.torso);
      return side({
        hip,
        torso,
        ankle,
        kneePrefer: (k) => -k.y,
        toeDeg: 20,
        hand: handOnBench,
        elbowPrefer: (e) => -e.x,
      });
    },
    props: [
      { kind: 'pad', a: { x: 10, y: 151 }, b: { x: 62, y: 151 }, w: 9 },
      { kind: 'frame', pts: [{ x: 20, y: 155 }, { x: 20, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: 54, y: 155 }, { x: 54, y: FLOOR }] },
    ],
    grounded: false,
    timing: { down: 1.3, bottomHold: 0.3, up: 1, topHold: 0.4 },
    captions: { down: '手撐在椅子邊，身體貼近椅子往下沉', bottom: '上臂約與地面平行，肩膀不要往前掉', up: '推回到手臂伸直', top: '腳跟著地，背貼近椅子' },
    labels: { start: '撐起', end: '最低點' },
  };
})();

function wristCurl(reverse: boolean): SideDemo {
  const hip: Vec = { x: 66, y: 148 };
  const torso = 34;
  // 前臂靠在大腿上，手腕超出膝蓋
  const knee = toward(hip, 90, BODY.thigh);
  const hand = add(knee, { x: 10, y: -7 });
  return {
    pose: (p) => {
      const wrist = reverse ? lerp(160, 60, p) : lerp(150, 20, p);
      return side({
        hip,
        torso,
        headTilt: 20,
        ankle: { x: 114, y: ANKLE.y },
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: (e) => e.y,
        props: [{ kind: 'dumbbell', at: toward(hand, wrist, 7) }],
      });
    },
    props: [
      { kind: 'pad', a: { x: hip.x - 14, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
      { kind: 'frame', pts: [{ x: hip.x + 4, y: hip.y + 15 }, { x: hip.x + 4, y: FLOOR }] },
    ],
    timing: { down: 0.8, bottomHold: 0.4, up: 1.2, topHold: 0.3 },
    captions: reverse
      ? { down: '掌心朝下，只用手腕把啞鈴往上抬', bottom: '頂端停一下，前臂上側用力', up: '慢慢放下', top: '前臂靠穩在大腿上' }
      : { down: '掌心朝上，只用手腕把啞鈴往上捲', bottom: '頂端停一下，前臂用力', up: '慢慢放下，讓手腕往下伸展', top: '前臂靠穩在大腿上' },
    labels: { start: '手腕放下', end: '手腕捲起' },
  };
}

export const ARM_DEMOS: Record<string, Demo> = {
  'barbell-curl': standingCurl('bar', CURL_CAPTIONS),
  'ez-curl': standingCurl('bar', { ...CURL_CAPTIONS, down: '握曲槓斜握處，手肘貼著身體往上彎' }),
  'db-curl': standingCurl('db', { ...CURL_CAPTIONS, down: '邊往上彎邊把掌心轉向上' }),
  'hammer-curl': standingCurl('hammer', { ...CURL_CAPTIONS, down: '掌心朝內（像拿鎚子），往上彎舉' }),
  'reverse-curl': standingCurl('bar', { ...CURL_CAPTIONS, down: '掌心朝下握槓，往上彎舉', bottom: '頂端前臂上側用力' }),
  'cable-curl': standingCurl('cable', { ...CURL_CAPTIONS, top: '繩索全程保持張力，手臂不要完全放鬆' }),
  'cable-hammer-curl': standingCurl('cable-hammer', { ...CURL_CAPTIONS, down: '用繩把、掌心朝內往上彎舉' }),
  'incline-db-curl': supportedCurl('incline'),
  'preacher-curl': supportedCurl('preacher'),
  'concentration-curl': supportedCurl('concentration'),
  'machine-curl': supportedCurl('machine'),
  'triceps-pushdown': pushdown(false),
  'rope-pushdown': pushdown(true),
  'cable-overhead-triceps': overheadExtension('cable'),
  'overhead-triceps-ext': overheadExtension('db'),
  'skull-crusher': skullCrusher,
  'db-kickback': dbKickback,
  'machine-triceps': machineTriceps,
  'bench-dip': benchDip,
  'wrist-curl': wristCurl(false),
  'reverse-wrist-curl': wristCurl(true),
};
