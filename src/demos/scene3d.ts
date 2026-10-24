/**
 * 把平面的假人示範轉成 3D 場景，讓使用者可以轉動視角。
 *
 * 示範的姿勢仍然在平面上設計（側面或正面，力學測試也在平面上做），這裡補上看不到的那個方向：
 * - 側面示範：補上左右寬度（肩寬、髖寬、握距、站距）；遠側手腳沒給時和近側對稱。
 * - 正面示範：front() 由前後縮短比例還原了每個關節往前的距離（pose.depth）。
 * - 俯視示範：畫面是地面，前後縮短代表高度。
 *
 * 世界座標：X 朝假人前方、Y 朝上（地面 Y = 0）、Z 朝假人的右側。單位和平面示範相同。
 */
import { BODY, type Demo, type FrontLimbs, type FrontPose, type LimbDepth, type Pose, type Prop, type Vec } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 一側的手腳 */
export interface Limbs3 {
  shoulder: Vec3;
  elbow: Vec3;
  hand: Vec3;
  hip: Vec3;
  knee: Vec3;
  ankle: Vec3;
  heel: Vec3;
  toe: Vec3;
}

export interface Figure3 {
  head: Vec3;
  neck: Vec3;
  /** l = 假人的左側，r = 右側 */
  l: Limbs3;
  r: Limbs3;
}

/** 3D 器材：都用簡單的幾何形狀組成，class 對應 Mannequin 的樣式 */
export type Shape3 =
  /** 有粗細的棒子（槓、繩索、機器骨架），w = 畫面上的粗細 */
  | { kind: 'rod'; a: Vec3; b: Vec3; w: number; cls: string }
  /** 長方體（訓練椅、跳箱、護墊）：8 個角，順序見 box()；bg = 固定的器材，畫在假人後面 */
  | { kind: 'box'; corners: Vec3[]; cls: string; bg?: boolean }
  /** 圓盤（槓片、滑輪）：圓心、法向量、半徑 */
  | { kind: 'disc'; c: Vec3; n: Vec3; r: number; cls: string }
  /** 球（握把、壺鈴） */
  | { kind: 'ball'; c: Vec3; r: number; cls: string };

export interface Scene3 {
  figure: Figure3;
  shapes: Shape3[];
}

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale3 = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
export const len3 = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm3 = (a: Vec3) => scale3(a, 1 / (len3(a) || 1));
const near = (a: Vec, b: Vec) => Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6;

const FLOOR = 198;
const CENTER = 100;
const AXIS_X = v3(1, 0, 0);
const AXIS_Y = v3(0, 1, 0);
const AXIS_Z = v3(0, 0, 1);

type Box3 = Extract<Shape3, { kind: 'box' }>;

/** 長方體：從 a 到 b 的中心線，往 side 方向寬 half、往 up 方向厚 halfT */
function box(a: Vec3, b: Vec3, side: Vec3, half: number, up: Vec3, halfT: number, cls: string): Box3 {
  const s = scale3(side, half);
  const u = scale3(up, halfT);
  const corners = [a, b].flatMap((c) => [
    add3(add3(c, s), u),
    add3(sub3(c, s), u),
    sub3(sub3(c, s), u),
    sub3(add3(c, s), u),
  ]);
  return { kind: 'box', corners, cls };
}

/** 啞鈴：握把沿 axis，兩端各一片 */
function dumbbell(c: Vec3, axis: Vec3): Shape3[] {
  const d = scale3(axis, 8);
  return [
    { kind: 'rod', a: sub3(c, d), b: add3(c, d), w: 3.5, cls: 'mq-db-handle' },
    { kind: 'disc', c: sub3(c, d), n: axis, r: 6, cls: 'mq-db-plate' },
    { kind: 'disc', c: add3(c, d), n: axis, r: 6, cls: 'mq-db-plate' },
  ];
}

/** 槓鈴：槓沿 Z，兩端各一片槓片（側面看到的槓片半徑 15） */
function barbell(c: Vec3): Shape3[] {
  return [
    { kind: 'rod', a: add3(c, v3(0, 0, -56)), b: add3(c, v3(0, 0, 56)), w: 3, cls: 'mq-shaft' },
    ...[-42, 42].map((z): Shape3 => ({ kind: 'disc', c: add3(c, v3(0, 0, z)), n: AXIS_Z, r: 15, cls: 'mq-plate' })),
  ];
}

// ───────── 側面示範 ─────────

interface Widths {
  grip: number;
  stance: number;
  parallelBars: boolean;
}

/** 握距、站距：示範有指定就用指定的，否則依器材推測 */
function widthsOf(demo: Demo, pose: Pose): Widths {
  const props = [...(pose.props ?? []), ...(demo.props ?? [])];
  const has = (kind: Prop['kind']) => props.some((p) => p.kind === kind);
  let grip = BODY.shoulderHalf + 2;
  if (pose.bar) grip = 24;
  else if (has('dumbbell')) grip = BODY.shoulderHalf + 3;
  else if (has('kettlebell') || has('plate') || has('handle')) grip = 6;
  return { grip: demo.width?.grip ?? grip, stance: demo.width?.stance ?? 10, parallelBars: demo.width?.parallelBars ?? false };
}

/** 側面的點 → 世界座標（z 另外給） */
const fromSide = (p: Vec, z: number): Vec3 => v3(p.x - CENTER, FLOOR - p.y, z);

function liftSide(demo: Demo, pose: Pose): Scene3 {
  const w = widthsOf(demo, pose);
  const far = pose.far ?? {};
  // 手肘在肩膀和手之間，稍微往外
  const elbowZ = (BODY.shoulderHalf + w.grip) / 2 + 2;
  /** 近側是假人的右側（+Z），遠側是左側（−Z） */
  const limbs = (sign: 1 | -1, src: Pose | (Pose & typeof far)): Limbs3 => ({
    shoulder: fromSide(pose.shoulder, sign * BODY.shoulderHalf),
    elbow: fromSide(src.elbow, sign * elbowZ),
    hand: fromSide(src.hand, sign * w.grip),
    hip: fromSide(pose.hip, sign * BODY.hipHalf),
    knee: fromSide(src.knee, sign * (w.stance + BODY.hipHalf) / 2),
    ankle: fromSide(src.ankle, sign * w.stance),
    heel: fromSide(src.heel, sign * w.stance),
    toe: fromSide(src.toe, sign * (w.stance + 4)),
  });
  const farSrc = { ...pose, ...far };
  const figure: Figure3 = {
    head: fromSide(pose.head, 0),
    neck: fromSide(pose.neck, 0),
    r: limbs(1, pose),
    l: limbs(-1, farSrc),
  };
  // 遠側的手沒有另外給時和近側對稱，手上的器材也要複製一份到遠側
  const mirrored = !far.hand;
  /** 某個點在哪隻手上：回傳那隻手（兩隻手都在）或 null */
  const handsAt = (at: Vec): Vec3[] => {
    const hands: Vec3[] = [];
    if (near(at, pose.hand)) hands.push(figure.r.hand);
    if ((mirrored && near(at, pose.hand)) || (far.hand && near(at, far.hand))) hands.push(figure.l.hand);
    return hands;
  };
  /** 拿在手上的器材：兩隻手握同一個（握距窄）時在中間，否則每隻手各一個 */
  const held = (at: Vec): Vec3[] => {
    const hands = handsAt(at);
    if (hands.length === 0) return [fromSide(at, 0)];
    if (hands.length === 2 && w.grip <= 8) return [fromSide(at, 0)];
    return hands;
  };
  /** 兩隻手握著的寬握把（例如滑輪下拉的長槓） */
  const wideBar = (at: Vec) => handsAt(at).length === 2 && w.grip > 8;
  const shapes: Shape3[] = [];
  const addProp = (prop: Prop, bg = false) => {
    const push = (shape: Shape3) => shapes.push(shape.kind === 'box' && bg ? { ...shape, bg } : shape);
    switch (prop.kind) {
      case 'pad': {
        const a = fromSide(prop.a, 0);
        const b = fromSide(prop.b, 0);
        const along = norm3(sub3(b, a));
        const up = norm3(cross(AXIS_Z, along));
        push(box(a, b, AXIS_Z, (prop.w ?? 8) >= 8 ? 13 : 10, up, (prop.w ?? 8) / 2, 'mq-bench'));
        return;
      }
      case 'frame':
        // 機器、架子的骨架：左右各一組；手握著的（地雷管、T 槓）只有中間一根
        for (const z of prop.pts.some((pt) => handsAt(pt).length > 0) ? [0] : [-24, 24]) {
          prop.pts.slice(1).forEach((pt, i) => {
            shapes.push({ kind: 'rod', a: fromSide(prop.pts[i]!, z), b: fromSide(pt, z), w: 3, cls: 'mq-frame3' });
          });
        }
        return;
      case 'cable':
      case 'band':
        // 拉著長槓的繩索接在槓的中間
        for (const end of wideBar(prop.b) ? [fromSide(prop.b, 0)] : held(prop.b)) {
          const start = prop.kind === 'band' ? held(prop.a)[0]! : fromSide(prop.a, 0);
          shapes.push({ kind: 'rod', a: start, b: end, w: 1.5, cls: prop.kind === 'cable' ? 'mq-cable3' : 'mq-band3' });
        }
        return;
      case 'pulley':
        shapes.push({ kind: 'disc', c: fromSide(prop.at, 0), n: AXIS_Z, r: 4, cls: 'mq-pulley' });
        return;
      case 'bar':
        if (w.parallelBars) {
          // 雙槓：前後方向，左右各一根
          for (const z of [-w.grip, w.grip]) {
            shapes.push({ kind: 'rod', a: fromSide({ x: prop.at.x - 26, y: prop.at.y }, z), b: fromSide({ x: prop.at.x + 26, y: prop.at.y }, z), w: 4, cls: 'mq-shaft' });
          }
          return;
        }
        // 固定的橫桿（單槓）：沿左右方向
        shapes.push({ kind: 'rod', a: fromSide(prop.at, -40), b: fromSide(prop.at, 40), w: 4, cls: 'mq-shaft' });
        return;
      case 'box': {
        const a = fromSide({ x: prop.x, y: prop.y + prop.h / 2 }, 0);
        const b = fromSide({ x: prop.x + prop.w, y: prop.y + prop.h / 2 }, 0);
        push(box(a, b, AXIS_Z, 20, AXIS_Y, prop.h / 2, 'mq-box'));
        return;
      }
      case 'dumbbell': {
        const axis = prop.angle === undefined ? AXIS_Z : v3(Math.cos((prop.angle * Math.PI) / 180), -Math.sin((prop.angle * Math.PI) / 180), 0);
        for (const c of held(prop.at)) shapes.push(...dumbbell(c, axis));
        return;
      }
      case 'kettlebell':
        for (const c of held(prop.at)) {
          shapes.push({ kind: 'ball', c: add3(c, v3(0, -9, 0)), r: 7, cls: 'mq-weight' });
        }
        return;
      case 'handle':
        if (wideBar(prop.at)) {
          const [r, l] = handsAt(prop.at) as [Vec3, Vec3];
          shapes.push({ kind: 'rod', a: add3(r, v3(0, 0, 6)), b: add3(l, v3(0, 0, -6)), w: 3, cls: 'mq-shaft' });
          return;
        }
        for (const c of held(prop.at)) shapes.push({ kind: 'ball', c, r: 3, cls: 'mq-hub' });
        return;
      case 'plate':
        shapes.push({ kind: 'disc', c: held(prop.at)[0]!, n: AXIS_Z, r: prop.r ?? 15, cls: 'mq-plate' });
        return;
    }
  };
  if (demo.bench) {
    const { x1, x2, y } = demo.bench;
    shapes.push({ ...box(fromSide({ x: x1, y: y + 4 }, 0), fromSide({ x: x2, y: y + 4 }, 0), AXIS_Z, 13, AXIS_Y, 4, 'mq-bench'), bg: true });
    for (const x of [x1 + 8, x2 - 8]) {
      shapes.push({ kind: 'rod', a: fromSide({ x, y: y + 8 }, 0), b: fromSide({ x, y: FLOOR }, 0), w: 4, cls: 'mq-frame3' });
    }
  }
  demo.props?.forEach((prop) => addProp(prop, true));
  pose.props?.forEach((prop) => addProp(prop));
  if (pose.bar) shapes.push(...barbell(fromSide(pose.bar, 0)));
  return { figure, shapes };
}

// ───────── 正面、俯視示範 ─────────

/** 正面的點 + 往前的距離 → 世界座標。畫面右邊是假人的左側（−Z） */
function frontMapper(top: boolean): (p: Vec, depth: number) => Vec3 {
  // 俯視：畫面是地面，x 是身體長軸、y 是左右（假人左側在畫面上方），往前縮短代表往上（躺在高 50 的椅子上）
  if (top) return (p, depth) => v3(p.x - CENTER, 50 + depth, p.y - CENTER);
  return (p, depth) => v3(depth, FLOOR - p.y, CENTER - p.x);
}

const ZERO_DEPTH: LimbDepth = { shoulder: 0, elbow: 0, hand: 0, hip: 0, knee: 0, ankle: 0, toe: 0 };

function liftFront(demo: Demo & { kind: 'front' }, pose: FrontPose): Scene3 {
  const map = frontMapper(demo.top === true);
  const depth = pose.depth ?? { head: 0, neck: 0, l: ZERO_DEPTH, r: ZERO_DEPTH };
  const limbs = (s: FrontLimbs, d: LimbDepth): Limbs3 => {
    const ankle = map(s.ankle, d.ankle);
    const toe = map(s.toe, d.toe);
    return {
      shoulder: map(s.shoulder, d.shoulder),
      elbow: map(s.elbow, d.elbow),
      hand: map(s.hand, d.hand),
      hip: map(s.hip, d.hip),
      knee: map(s.knee, d.knee),
      ankle,
      // 正面只有腳尖：腳跟在腳踝正後方
      heel: add3(ankle, scale3(norm3(sub3(ankle, toe)), BODY.footBack)),
      toe,
    };
  };
  const figure: Figure3 = {
    head: map(pose.head, depth.head),
    neck: map(pose.neck, depth.neck),
    l: limbs(pose.l, depth.l),
    r: limbs(pose.r, depth.r),
  };
  /** 器材的點：在手上的話跟著手的深度 */
  const at = (p: Vec): Vec3 => {
    if (near(p, pose.l.hand)) return figure.l.hand;
    if (near(p, pose.r.hand)) return figure.r.hand;
    return map(p, 0);
  };
  // 往前（朝觀看者）的方向，俯視時是往上
  const outward = demo.top ? AXIS_Y : AXIS_X;
  const shapes: Shape3[] = [];
  const addProp = (prop: Prop, bg = false) => {
    const push = (shape: Shape3) => shapes.push(shape.kind === 'box' && bg ? { ...shape, bg } : shape);
    switch (prop.kind) {
      case 'pad': {
        const a = at(prop.a);
        const b = at(prop.b);
        const along = norm3(sub3(b, a));
        const sideways = norm3(cross(along, outward));
        // 正面的護墊（椅面）往前後延伸；俯視的椅面往左右延伸
        push(demo.top ? box(a, b, AXIS_Z, (prop.w ?? 8) / 2, AXIS_Y, 4, 'mq-bench') : box(a, b, outward, 13, sideways, (prop.w ?? 8) / 2, 'mq-bench'));
        return;
      }
      case 'frame':
        prop.pts.slice(1).forEach((pt, i) => shapes.push({ kind: 'rod', a: at(prop.pts[i]!), b: at(pt), w: 3, cls: 'mq-frame3' }));
        return;
      case 'cable':
      case 'band':
        shapes.push({ kind: 'rod', a: at(prop.a), b: at(prop.b), w: 1.5, cls: prop.kind === 'cable' ? 'mq-cable3' : 'mq-band3' });
        return;
      case 'pulley':
        shapes.push({ kind: 'disc', c: at(prop.at), n: outward, r: 4, cls: 'mq-pulley' });
        return;
      case 'bar':
        shapes.push({ kind: 'rod', a: add3(at(prop.at), scale3(outward, -20)), b: add3(at(prop.at), scale3(outward, 20)), w: 4, cls: 'mq-shaft' });
        return;
      case 'box': {
        const a = map({ x: prop.x, y: prop.y + prop.h / 2 }, 0);
        const b = map({ x: prop.x + prop.w, y: prop.y + prop.h / 2 }, 0);
        push(box(a, b, outward, 20, AXIS_Y, prop.h / 2, 'mq-box'));
        return;
      }
      case 'dumbbell': {
        // 正面看到圓的啞鈴：握把朝前；有角度的在畫面平面內
        const rad = ((prop.angle ?? 0) * Math.PI) / 180;
        const inPlane = sub3(map({ x: Math.cos(rad), y: Math.sin(rad) }, 0), map({ x: 0, y: 0 }, 0));
        shapes.push(...dumbbell(at(prop.at), prop.angle === undefined ? outward : norm3(inPlane)));
        return;
      }
      case 'kettlebell':
        shapes.push({ kind: 'ball', c: add3(at(prop.at), v3(0, demo.top ? 0 : -9, 0)), r: 7, cls: 'mq-weight' });
        return;
      case 'handle':
        shapes.push({ kind: 'ball', c: at(prop.at), r: 3, cls: 'mq-hub' });
        return;
      case 'plate':
        shapes.push({ kind: 'disc', c: at(prop.at), n: outward, r: prop.r ?? 15, cls: 'mq-plate' });
        return;
    }
  };
  demo.props?.forEach((prop) => addProp(prop, true));
  pose.props?.forEach((prop) => addProp(prop));
  return { figure, shapes };
}

/** 某個進度的 3D 場景 */
export function sceneAt(demo: Demo, p: number): Scene3 {
  return demo.kind === 'front' ? liftFront(demo, demo.pose(p)) : liftSide(demo, demo.pose(p));
}

/** 預設的視角（方位角、仰角，度）：和原本平面示範的方向一致 */
export function homeView(demo: Demo): { yaw: number; pitch: number } {
  if (demo.kind === 'front') return demo.top ? { yaw: 0, pitch: 90 } : { yaw: 90, pitch: 0 };
  return { yaw: 0, pitch: 0 };
}

/** 場景裡所有的點（算畫面範圍、測試用） */
export function scenePoints(scene: Scene3): Vec3[] {
  const f = scene.figure;
  const limbs = (s: Limbs3) => Object.values(s) as Vec3[];
  const pts = [f.head, f.neck, ...limbs(f.l), ...limbs(f.r)];
  for (const s of scene.shapes) {
    if (s.kind === 'rod') pts.push(s.a, s.b);
    else if (s.kind === 'box') pts.push(...s.corners);
    else pts.push(s.c);
  }
  return pts;
}

/** 畫面範圍：以場景中心的垂直軸為準，轉動方位角時畫面大小不變 */
export interface Bounds3 {
  cx: number;
  cz: number;
  /** 離中心軸最遠的水平距離 */
  radius: number;
  minY: number;
  maxY: number;
}

export function boundsOf(demo: Demo): Bounds3 {
  const pts = [0, 0.25, 0.5, 0.75, 1].flatMap((p) => scenePoints(sceneAt(demo, p)));
  // 地面也算進去（腳下要看得到地板）
  const xs = pts.map((v) => v.x);
  const zs = pts.map((v) => v.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const radius = Math.max(...pts.map((v) => Math.hypot(v.x - cx, v.z - cz)));
  return { cx, cz, radius, minY: Math.min(0, ...pts.map((v) => v.y)), maxY: Math.max(...pts.map((v) => v.y)) };
}
