/**
 * 核心動作的假人示範
 * 棒式類是靜態撐住，動畫示範「從準備姿勢進入正確姿勢」；其餘依動作方向選側面或正面。
 */
import { ANKLE, ARM, FLOOR, FRONT_PELVIS, HANG, STAND_HIP, armTo, foot, front, legAngles, legTo, lerp, mirror, side, type FrontSideSpec } from './build';
import { add, angleBetween, lerpVec, toward, twoLink } from './kinematics';
import { BODY, type Demo, type FrontDemo, type FrontPose, type SideDemo, type Vec } from './types';

const CORE_TIMING = { down: 1.1, bottomHold: 0.5, up: 1.3, topHold: 0.4 };

// ───────── 棒式、側棒式 ─────────

const plank: SideDemo = (() => {
  const elbow: Vec = { x: 164, y: 190 };
  const shoulder = { x: elbow.x, y: elbow.y - BODY.upperArm };
  const ft = foot({ x: 0, y: 0 }, 150);
  return {
    pose: (p) => {
      // p = 0 膝蓋跪地，p = 1 膝蓋離地、身體一直線
      const ankle: Vec = { x: 18 - ft.toe.x, y: FLOOR - ft.toe.y };
      const kneeDown = { x: shoulder.x - 98, y: 190 };
      const lineKnee = lerpVec(ankle, shoulder, BODY.shin / (BODY.shin + BODY.thigh + BODY.torso));
      // 以肩膀為中心旋轉：膝蓋到肩膀的距離不變，身體全程保持一直線
      const knee = toward(shoulder, lerp(angleBetween(shoulder, kneeDown), angleBetween(shoulder, lineKnee), p), BODY.thigh + BODY.torso - 0.5);
      // 髖：膝到肩之間，維持大腿與軀幹長度
      const hip = twoLink(knee, shoulder, BODY.thigh, BODY.torso, (h) => -h.y);
      const fixedAnkle = toward(knee, angleBetween(knee, ankle), BODY.shin);
      return side({
        hip,
        knee,
        torso: angleBetween(hip, shoulder),
        headTilt: 0,
        ankle: fixedAnkle,
        toeDeg: lerp(250, 150, p),
        arm: [180, 90],
      });
    },
    grounded: false,
    timing: { down: 1, bottomHold: 2, up: 1, topHold: 0.6 },
    captions: {
      down: '前臂撐地，膝蓋離地',
      bottom: '頭到腳跟一直線，腹部和臀部收緊，正常呼吸',
      up: '膝蓋放回地面休息',
      top: '手肘在肩膀正下方',
    },
    labels: { start: '膝蓋跪地', end: '撐起' },
  };
})();

const sidePlank: FrontDemo = (() => {
  const feet: Vec = { x: 182, y: 186 };
  const lineHip = toward(feet, -73, BODY.thigh + BODY.shin);
  const floorHip = { x: lineHip.x + 2, y: 175 };
  return {
    kind: 'front',
    floor: true,
    grounded: false,
    pose: (p) => {
      // 從正面看側躺的人：頭在左邊，右手前臂撐地（畫面下方那側）
      const pelvis = lerpVec(floorHip, lineHip, p);
      const legDeg = angleBetween(pelvis, feet);
      const spine = lerp(-62, -73, p);
      // 上面的手舉向天花板，下面的手肘撐在肩膀正下方、前臂朝前（從正面看會縮短）
      const l: FrontSideSpec = { upper: 0, fore: 0, thigh: legDeg, shin: legDeg };
      const r: FrontSideSpec = { upper: 180, fore: -90, foreFs: 0.35, thigh: legDeg, shin: legDeg };
      return front({ pelvis, spine, pelvisTilt: spine, l, r });
    },
    timing: { down: 1, bottomHold: 2, up: 1, topHold: 0.6 },
    captions: {
      down: '前臂撐地，把臀部往上抬',
      bottom: '頭到腳一直線，臀部不要往後或下垂',
      up: '慢慢放下臀部',
      top: '手肘在肩膀正下方，雙腳疊在一起',
    },
    labels: { start: '臀部在地', end: '撐起' },
  };
})();

// ───────── 捲腹、仰臥起坐、死蟲式 ─────────

const crunch: SideDemo = (() => {
  const hip: Vec = { x: 112, y: 187 };
  const ankle: Vec = { x: 154, y: ANKLE.y };
  return {
    pose: (p) => {
      const torso = lerp(-88, -58, p);
      const shoulder = toward(hip, torso, BODY.torso);
      // 雙手輕放在頭兩側
      const hand = toward(shoulder, torso - 30, 14);
      return side({ hip, torso, headTilt: lerp(0, 15, p), ankle, kneePrefer: (k) => -k.y, hand, elbowPrefer: (e) => -e.y });
    },
    grounded: true,
    timing: CORE_TIMING,
    captions: { down: '吐氣，用腹肌把肩膀捲離地面', bottom: '頂端停一下，下背仍貼地', up: '慢慢放下', top: '手輕放頭側，不要拉脖子' },
    labels: { start: '躺平', end: '捲起' },
  };
})();

const declineSitup: SideDemo = (() => {
  const slope = -18; // 椅面往頭的方向下斜
  const hip: Vec = { x: 120, y: 128 };
  const ankle: Vec = { x: 162, y: 148 };
  const back = toward(hip, -90 + slope, 70);
  return {
    pose: (p) => {
      // 從躺在下斜椅上（頭比髖低）捲到上身接近直立
      const torso = lerp(-90 + slope, -10, p);
      const shoulder = toward(hip, torso, BODY.torso);
      return side({
        hip,
        torso,
        headTilt: 10,
        ankle,
        kneePrefer: (k) => -k.y,
        toeDeg: 40,
        hand: toward(shoulder, torso + 150, 14),
        elbowPrefer: (e) => -e.y,
      });
    },
    props: [
      { kind: 'pad', a: add(hip, { x: 8, y: 10 }), b: add(back, { x: 0, y: 10 }), w: 9 },
      { kind: 'pad', a: { x: ankle.x + 2, y: ankle.y + 9 }, b: { x: ankle.x + 3, y: ankle.y + 9 }, w: 10 },
      { kind: 'frame', pts: [add(back, { x: 6, y: 14 }), { x: back.x + 6, y: FLOOR }] },
      { kind: 'frame', pts: [{ x: ankle.x, y: ankle.y + 14 }, { x: ankle.x, y: FLOOR }] },
    ],
    grounded: false,
    timing: CORE_TIMING,
    captions: { down: '腳勾好，吐氣把上身捲起來', bottom: '坐到上身接近直立', up: '慢慢往後放，背一節一節貼回椅面', top: '躺回椅面，不要甩動借力' },
    labels: { start: '躺下', end: '坐起' },
  };
})();

const deadBug: SideDemo = (() => {
  const hip: Vec = { x: 106, y: 187 };
  const torso = -90;
  return {
    pose: (p) => {
      const shoulder = toward(hip, torso, BODY.torso);
      // 近側手往頭後方放下，遠側腳往前伸直（對側手腳同時動）
      const farLegPos = legAngles(hip, lerp(0, 66, p), lerp(90, 70, p));
      const tabletop = legAngles(hip, 0, 90);
      return side({
        hip,
        torso,
        ankle: tabletop.ankle,
        knee: tabletop.knee,
        toeDeg: 0,
        arm: [lerp(0, -84, p), lerp(0, -84, p)],
        far: { elbow: toward(shoulder, 0, BODY.upperArm), hand: toward(shoulder, 0, ARM), knee: farLegPos.knee, ankle: farLegPos.ankle, ...foot(farLegPos.ankle, lerp(0, 70, p) - 90) },
      });
    },
    grounded: false,
    view: { top: -10, height: 220 },
    timing: { down: 1.6, bottomHold: 0.4, up: 1.3, topHold: 0.4 },
    captions: {
      down: '下背貼地，一手往頭後、對側腳往前伸',
      bottom: '手腳接近地面但不碰地',
      up: '慢慢收回，換另一側',
      top: '手指天花板，膝蓋彎 90 度在髖的正上方',
    },
    labels: { start: '桌面式', end: '伸展' },
  };
})();

// ───────── 懸垂舉腿、雙槓提膝 ─────────

const BAR: Vec = { x: 66, y: -12 };

function hangingRaise(kind: 'leg' | 'knee' | 'captain'): SideDemo {
  const captain = kind === 'captain';
  return {
    pose: (p) => {
      const shoulder = captain ? { x: 70, y: 32 } : { x: BAR.x - 2, y: BAR.y + ARM - 1 };
      const torso = captain ? -2 : lerp(-2, -10, p);
      const hip = toward(shoulder, torso + 180, BODY.torso);
      const legs =
        kind === 'leg'
          ? legAngles(hip, lerp(178, 92, p), lerp(178, 90, p))
          : legAngles(hip, lerp(176, 70, p), lerp(184, 170, p));
      return side({
        hip,
        torso,
        ankle: legs.ankle,
        knee: legs.knee,
        toeDeg: kind === 'leg' ? lerp(176, 0, p) : 200,
        ...(captain ? { arm: [180, 90] as [number, number] } : { hand: BAR, elbowPrefer: (e: Vec) => e.x }),
      });
    },
    props: captain
      ? [
          { kind: 'pad', a: { x: 70, y: 65 }, b: { x: 104, y: 65 }, w: 7 },
          { kind: 'pad', a: { x: 54, y: 4 }, b: { x: 54, y: 82 }, w: 9 },
          { kind: 'frame', pts: [{ x: 48, y: 2 }, { x: 48, y: FLOOR }] },
          { kind: 'frame', pts: [{ x: 104, y: 69 }, { x: 104, y: FLOOR }] },
        ]
      : [
          { kind: 'frame', pts: [{ x: BAR.x - 40, y: BAR.y }, { x: BAR.x + 40, y: BAR.y }] },
          { kind: 'bar', at: BAR },
          { kind: 'frame', pts: [{ x: 20, y: BAR.y - 6 }, { x: 20, y: FLOOR }] },
        ],
    grounded: false,
    view: captain ? { top: -10, height: 220 } : { top: -40, height: 250 },
    timing: CORE_TIMING,
    captions:
      kind === 'leg'
        ? { down: '腿伸直往前抬，骨盆往上捲', bottom: '抬到腿與地面平行或更高', up: '慢慢放下，身體不要晃', top: '肩膀往下壓，不要放鬆懸掛' }
        : { down: '膝蓋往胸口抬，骨盆往上捲', bottom: '頂端腹部用力停一下', up: '慢慢放下', top: '身體穩定，不要擺盪借力' },
    labels: { start: '腿垂下', end: kind === 'leg' ? '抬到水平' : '膝蓋到胸口' },
  };
}

// ───────── 繩索捲腹、機械捲腹、健腹輪 ─────────

const cableCrunch: SideDemo = (() => {
  const knee: Vec = { x: 92, y: 190 };
  const ankle = toward(knee, -90, BODY.shin);
  const hip = toward(knee, 4, BODY.thigh);
  const pulley: Vec = { x: 150, y: 8 };
  return {
    pose: (p) => {
      const torso = lerp(12, 88, p);
      const shoulder = toward(hip, torso, BODY.torso);
      // 繩子握在頭兩側
      const hand = toward(shoulder, torso + 40, 16);
      return side({
        hip,
        knee,
        torso,
        headTilt: lerp(10, 30, p),
        ankle,
        toeDeg: 262,
        hand,
        elbowPrefer: (e) => e.x,
        props: [{ kind: 'cable', a: pulley, b: hand }, { kind: 'handle', at: hand }],
      });
    },
    props: [{ kind: 'frame', pts: [{ x: 156, y: 4 }, { x: 156, y: FLOOR }] }, { kind: 'pulley', at: pulley }],
    grounded: false,
    timing: CORE_TIMING,
    captions: { down: '用腹肌把上身往下捲，手肘往膝蓋', bottom: '捲到底，腹部用力', up: '慢慢回到直立', top: '跪姿，臀部位置不動' },
    labels: { start: '跪直', end: '捲到底' },
  };
})();

const machineCrunch: SideDemo = (() => {
  const hip: Vec = { x: 72, y: 148 };
  return {
    pose: (p) => {
      const torso = lerp(-6, 38, p);
      const shoulder = toward(hip, torso, BODY.torso);
      const hand = toward(shoulder, torso + 60, 18);
      return side({
        hip,
        torso,
        headTilt: lerp(0, 20, p),
        ankle: { x: 118, y: ANKLE.y },
        kneePrefer: (k) => -k.y,
        hand,
        elbowPrefer: (e) => -e.y,
        props: [{ kind: 'pad', a: add(shoulder, { x: 6, y: -4 }), b: add(shoulder, { x: 16, y: 6 }), w: 7 }],
      });
    },
    props: [
      { kind: 'pad', a: { x: hip.x - 12, y: hip.y + 11 }, b: { x: hip.x + 24, y: hip.y + 11 }, w: 9 },
      { kind: 'pad', a: { x: hip.x - 14, y: hip.y + 2 }, b: { x: hip.x - 16, y: hip.y - 50 }, w: 8 },
      { kind: 'frame', pts: [{ x: hip.x + 4, y: hip.y + 15 }, { x: hip.x + 4, y: FLOOR }] },
    ],
    timing: CORE_TIMING,
    captions: { down: '用腹肌把上身往前捲', bottom: '捲到底停一下', up: '慢慢回到直立', top: '腳踩穩，不要用手拉' },
    labels: { start: '坐直', end: '捲到底' },
  };
})();

const abWheel: SideDemo = (() => {
  // 膝蓋跪地、小腿往後上方翹起
  const knee: Vec = { x: 58, y: 190 };
  const ankle = toward(knee, -60, BODY.shin);
  const wheelY = 190;
  return {
    pose: (p) => {
      const hip = toward(knee, lerp(22, 62, p), BODY.thigh);
      const torso = lerp(96, 86, p);
      const shoulder = toward(hip, torso, BODY.torso);
      // 手臂伸直，輪子在地上
      const dy = wheelY - shoulder.y;
      const reachX = Math.sqrt(Math.max(0, (ARM - 1) ** 2 - dy ** 2));
      const target = { x: shoulder.x + Math.min(reachX, lerp(4, 32, p)), y: wheelY };
      const { hand } = armTo(shoulder, target, (e) => -e.y);
      return side({ hip, knee, torso, headTilt: 10, ankle, toeDeg: -60 - 90, hand, elbowPrefer: (e) => -e.y, props: [{ kind: 'plate', at: hand, r: 7 }] });
    },
    grounded: false,
    timing: { down: 1.8, bottomHold: 0.3, up: 1.4, topHold: 0.4 },
    captions: { down: '核心收緊，輪子慢慢往前推', bottom: '推到能控制的最遠處，腰不下塌', up: '用腹肌把輪子拉回來', top: '跪姿，輪子在肩膀下方' },
    labels: { start: '輪子在下方', end: '推到最遠' },
  };
})();

// ───────── 正面：俄羅斯轉體、伐木、側彎 ─────────

/** 正面：把雙手放到同一個目標（手肘用兩節肢體算） */
function handsTo(pose: FrontPose, target: Vec): FrontPose {
  const reachTo = (shoulder: Vec, prefer: (e: Vec) => number) => {
    const d = Math.hypot(target.x - shoulder.x, target.y - shoulder.y);
    const t = d > ARM - 0.5 ? lerpVec(shoulder, target, (ARM - 0.5) / d) : target;
    return { elbow: twoLink(shoulder, t, BODY.upperArm, BODY.forearm, prefer), hand: t };
  };
  return {
    ...pose,
    l: { ...pose.l, ...reachTo(pose.l.shoulder, (e) => e.y + e.x * 0.3) },
    r: { ...pose.r, ...reachTo(pose.r.shoulder, (e) => e.y - e.x * 0.3) },
  };
}

const russianTwist: FrontDemo = {
  kind: 'front',
  pose: (p) => {
    // 坐姿 V 字，雙手一起從左側轉到右側
    const pelvis: Vec = { x: 100, y: 172 };
    const spine = lerp(-10, 10, p);
    // 膝蓋往前上方抬（從正面看大腿變短、膝蓋比髖高一點）
    const legs: FrontSideSpec = { ...HANG, thigh: 30, thighFs: 0.45, shin: 172, shinFs: 0.5 };
    const base = front({ pelvis, spine, torsoFs: 0.85, l: legs, r: mirror(legs) });
    const target = { x: lerp(62, 138, p), y: 160 };
    const pose = handsTo(base, target);
    pose.props = [{ kind: 'plate', at: target, r: 9 }];
    return pose;
  },
  grounded: false,
  timing: { down: 1, bottomHold: 0.3, up: 1, topHold: 0.3 },
  captions: { down: '上身往後傾，雙手一起轉到另一側', bottom: '轉到側邊，用腹斜肌帶動', up: '轉回另一側', top: '背打直，腳可以踩地或抬起' },
  labels: { start: '轉到右側', end: '轉到左側' },
};

const woodchop: FrontDemo = {
  kind: 'front',
  pose: (p) => {
    const pulley: Vec = { x: 186, y: 22 };
    const spine = lerp(8, -8, p);
    const base = front({ pelvis: FRONT_PELVIS, spine, l: HANG, r: mirror(HANG) });
    const target = lerpVec({ x: 150, y: 34 }, { x: 62, y: 118 }, p);
    const pose = handsTo(base, target);
    pose.props = [{ kind: 'cable', a: pulley, b: target }, { kind: 'handle', at: target }];
    return pose;
  },
  props: [{ kind: 'frame', pts: [{ x: 192, y: 10 }, { x: 192, y: FLOOR }] }, { kind: 'pulley', at: { x: 186, y: 22 } }],
  timing: { down: 0.9, bottomHold: 0.3, up: 1.4, topHold: 0.3 },
  captions: { down: '手臂伸直，從高處往對側斜下方拉', bottom: '轉動軀幹到對側髖部', up: '慢慢回到起點', top: '腳站穩，用軀幹轉動而不是手臂' },
  labels: { start: '高處', end: '斜下方' },
};

const sideBend: FrontDemo = {
  kind: 'front',
  pose: (p) => {
    const spine = lerp(4, -20, p);
    const pose = front({ pelvis: FRONT_PELVIS, spine, l: { upper: spine + 150, fore: spine - 40 }, r: { upper: spine + 180, fore: spine + 180 } });
    pose.props = [{ kind: 'dumbbell', at: pose.r.hand }];
    return pose;
  },
  timing: CORE_TIMING,
  captions: { down: '往拿啞鈴那一側慢慢彎', bottom: '彎到另一側腰有伸展感', up: '用另一側腰的力量拉回直立', top: '只往側邊彎，不往前後倒' },
  labels: { start: '站直', end: '側彎' },
};

// ───────── 抗旋轉推 ─────────

const pallofPress: SideDemo = (() => {
  const hip = STAND_HIP;
  const shoulder = toward(hip, 0, BODY.torso);
  const pulley: Vec = { x: 30, y: shoulder.y + 14 };
  return {
    pose: (p) => {
      const hand = lerpVec({ x: shoulder.x + 10, y: shoulder.y + 14 }, toward(shoulder, 98, ARM - 1), p);
      return side({
        hip,
        torso: 0,
        ankle: ANKLE,
        knee: legTo(hip, ANKLE),
        hand,
        elbowPrefer: (e) => e.y,
        props: [{ kind: 'cable', a: pulley, b: hand }, { kind: 'handle', at: hand }],
      });
    },
    props: [{ kind: 'frame', pts: [{ x: 24, y: 40 }, { x: 24, y: FLOOR }] }, { kind: 'pulley', at: pulley }],
    timing: { down: 0.9, bottomHold: 1.2, up: 0.9, topHold: 0.4 },
    captions: { down: '繩索在身體側邊，雙手往正前方推出', bottom: '撐住 1～2 秒，身體不被拉著轉', up: '慢慢收回胸前', top: '腳與肩同寬，核心收緊' },
    labels: { start: '手在胸前', end: '推出' },
  };
})();

export const CORE_DEMOS: Record<string, Demo> = {
  plank,
  'side-plank': sidePlank,
  crunch,
  'decline-situp': declineSitup,
  'hanging-leg-raise': hangingRaise('leg'),
  'hanging-knee-raise': hangingRaise('knee'),
  'captains-chair-raise': hangingRaise('captain'),
  'cable-crunch': cableCrunch,
  'machine-crunch': machineCrunch,
  'ab-wheel': abWheel,
  'russian-twist': russianTwist,
  'cable-woodchop': woodchop,
  'pallof-press': pallofPress,
  'db-side-bend': sideBend,
  'dead-bug': deadBug,
};
