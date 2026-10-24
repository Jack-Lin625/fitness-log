import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { clampPitch, makeCamera, type Camera, type View } from '../demos/camera';
import { add3, boundsOf, homeView, sceneAt, scale3, sub3, type Bounds3, type Figure3, type Scene3, type Shape3, type Vec3 } from '../demos/scene3d';
import { BODY, easeInOut, type Demo } from '../demos/types';

type Phase = 'down' | 'bottom' | 'up' | 'top';

/** 時間（秒）→ 進度 p 與階段 */
function progressAt(demo: Demo, time: number): { p: number; phase: Phase } {
  const { down, bottomHold, up, topHold } = demo.timing;
  const total = down + bottomHold + up + topHold;
  let t = time % total;
  if (t < down) return { p: easeInOut(t / down), phase: 'down' };
  t -= down;
  if (t < bottomHold) return { p: 1, phase: 'bottom' };
  t -= bottomHold;
  if (t < up) return { p: 1 - easeInOut(t / up), phase: 'up' };
  return { p: 0, phase: 'top' };
}

/** 一個要畫的東西：依遠近排序後由遠到近畫 */
interface Item {
  depth: number;
  el: JSX.Element;
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const mid = (pts: Vec3[]): Vec3 => scale3(pts.reduce(add3, { x: 0, y: 0, z: 0 }), 1 / pts.length);

/** 一個圓（法向量 n）上的點 */
function circlePoints(c: Vec3, n: Vec3, r: number, count = 20): Vec3[] {
  // 找兩個和 n 垂直的方向
  const helper = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u0 = { x: n.y * helper.z - n.z * helper.y, y: n.z * helper.x - n.x * helper.z, z: n.x * helper.y - n.y * helper.x };
  const ul = Math.hypot(u0.x, u0.y, u0.z);
  const u = scale3(u0, 1 / ul);
  const w = { x: n.y * u.z - n.z * u.y, y: n.z * u.x - n.x * u.z, z: n.x * u.y - n.y * u.x };
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2;
    return add3(c, add3(scale3(u, Math.cos(t) * r), scale3(w, Math.sin(t) * r)));
  });
}

const BOX_FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];

/** 長方體看得到的面（各自依遠近排序） */
function boxFaces(cam: Camera, corners: Vec3[], cls: string, key: string): Item[] {
  const center = mid(corners);
  const items: Item[] = [];
  BOX_FACES.forEach((face, i) => {
    const pts = face.map((j) => corners[j]!);
    const c = mid(pts);
    if (dot(sub3(c, center), cam.toward) <= 1e-6) return;
    const proj = pts.map(cam.project);
    items.push({
      depth: cam.project(c).depth,
      el: <polygon key={`${key}-${i}`} points={proj.map((p) => `${p.x},${p.y}`).join(' ')} class={cls} />,
    });
  });
  return items;
}

/** 器材 → 要畫的東西 */
function shapeItems(cam: Camera, shape: Shape3, key: string): Item[] {
  switch (shape.kind) {
    case 'rod': {
      // 長的棒子切成幾段，排序時才不會整根被手腳蓋住或蓋住手腳
      const n = Math.max(1, Math.ceil(Math.hypot(shape.a.x - shape.b.x, shape.a.y - shape.b.y, shape.a.z - shape.b.z) / 14));
      return Array.from({ length: n }, (_, i) => {
        const a = cam.project(add3(shape.a, scale3(sub3(shape.b, shape.a), i / n)));
        const b = cam.project(add3(shape.a, scale3(sub3(shape.b, shape.a), (i + 1) / n)));
        return {
          depth: (a.depth + b.depth) / 2,
          el: <path key={`${key}-${i}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} class={shape.cls} style={{ strokeWidth: shape.w * a.k }} />,
        };
      });
    }
    case 'box':
      return boxFaces(cam, shape.corners, shape.cls, key);
    case 'disc': {
      const pts = circlePoints(shape.c, shape.n, shape.r).map(cam.project);
      return [{ depth: cam.project(shape.c).depth, el: <polygon key={key} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} class={shape.cls} /> }];
    }
    case 'ball': {
      const c = cam.project(shape.c);
      return [{ depth: c.depth, el: <circle key={key} cx={c.x} cy={c.y} r={shape.r * c.k} class={shape.cls} /> }];
    }
  }
}

/** 假人 → 要畫的東西；遠側的手腳顏色較淡 */
function figureItems(cam: Camera, f: Figure3): Item[] {
  const items: Item[] = [];
  const sideDepth = (s: Figure3['l']) => (cam.project(s.shoulder).depth + cam.project(s.hip).depth) / 2;
  const diff = sideDepth(f.r) - sideDepth(f.l);
  const farSide = diff > 0 ? 'l' : 'r';
  const fade = 1 - 0.55 * Math.min(1, Math.abs(diff) / (2 * BODY.shoulderHalf));

  const bone = (a: Vec3, b: Vec3, cls: string, w: number, key: string, opacity = 1) => {
    const pa = cam.project(a);
    const pb = cam.project(b);
    items.push({
      depth: (pa.depth + pb.depth) / 2,
      el: (
        <path
          key={key}
          d={`M${pa.x} ${pa.y}L${pb.x} ${pb.y}`}
          class={`mq-limb ${cls}`}
          style={{ strokeWidth: w * ((pa.k + pb.k) / 2), opacity: opacity < 1 ? opacity : undefined }}
        />
      ),
    });
  };
  const joint = (p: Vec3, key: string, opacity = 1) => {
    const pp = cam.project(p);
    // 關節畫在同一個位置的骨頭上面
    items.push({
      depth: pp.depth + 0.5,
      el: <circle key={key} cx={pp.x} cy={pp.y} r={2.6 * pp.k} class="mq-joint" style={{ opacity: opacity < 1 ? opacity : undefined }} />,
    });
  };

  for (const side of ['l', 'r'] as const) {
    const s = f[side];
    const o = side === farSide ? fade : 1;
    bone(s.heel, s.toe, 'mq-foot', 8, `${side}-foot`, o);
    bone(s.ankle, s.knee, '', 11, `${side}-shin`, o);
    bone(s.knee, s.hip, '', 11, `${side}-thigh`, o);
    bone(s.shoulder, s.elbow, 'mq-arm', 8, `${side}-upper`, o);
    bone(s.elbow, s.hand, 'mq-arm', 8, `${side}-fore`, o);
    for (const j of ['knee', 'hip', 'shoulder', 'elbow', 'ankle'] as const) joint(s[j], `${side}-${j}`, o);
  }

  // 軀幹：肩膀與髖四個點圍起來的面
  const torso = [f.l.shoulder, f.r.shoulder, f.r.hip, f.l.hip].map(cam.project);
  items.push({
    depth: torso.reduce((n, p) => n + p.depth, 0) / 4,
    el: <polygon key="torso" points={torso.map((p) => `${p.x},${p.y}`).join(' ')} class="mq-torso3" style={{ strokeWidth: 9 * torso[0]!.k }} />,
  });
  bone(mid([f.l.shoulder, f.r.shoulder]), f.neck, 'mq-neck', 7, 'neck');
  const head = cam.project(f.head);
  items.push({ depth: head.depth, el: <circle key="head" cx={head.x} cy={head.y} r={BODY.headR * head.k} class="mq-head" /> });
  return items;
}

/** 地面：場景下方的圓 */
function Floor({ cam, b }: { cam: Camera; b: Bounds3 }) {
  const pts = circlePoints({ x: b.cx, y: 0, z: b.cz }, { x: 0, y: 1, z: 0 }, b.radius * 1.04, 48).map(cam.project);
  return <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} class="mq-floor3" />;
}

/** 側面示範的輔助線（例如腳掌中心）：只有從側面附近看時才有意義 */
const guideVisible = (view: View) => Math.abs(Math.sin((view.yaw * Math.PI) / 180)) < 0.5 && view.pitch < 45;

function Guide({ cam, demo, b }: { cam: Camera; demo: Demo; b: Bounds3 }) {
  if (!demo.guideX) return null;
  const g = demo.guideX();
  const bottom = cam.project({ x: g.x - 100, y: 0, z: 0 });
  const top = cam.project({ x: g.x - 100, y: b.maxY, z: 0 });
  // 文字放在地面旁邊，才不會擋到頭
  return (
    <>
      <path d={`M${bottom.x} ${bottom.y}L${top.x} ${top.y}`} class="mq-guide" />
      <text x={bottom.x + 4} y={bottom.y - 3} class="mq-guide-label">
        {g.label}
      </text>
    </>
  );
}

/** 某個進度、某個視角的 3D 畫面 */
function Stage({ demo, scene, view, bounds, guides }: { demo: Demo; scene: Scene3; view: View; bounds: Bounds3; guides: boolean }) {
  const cam = makeCamera(view, bounds);
  // 固定的器材（訓練椅、機器座椅）先畫，人在上面
  const background = scene.shapes.filter((s) => s.kind === 'box' && s.bg);
  const sorted = [
    ...scene.shapes.filter((s) => !(s.kind === 'box' && s.bg)).flatMap((s, i) => shapeItems(cam, s, `s${i}`)),
    ...figureItems(cam, scene.figure),
  ].sort((a, b) => a.depth - b.depth);
  const bg = background.flatMap((s, i) => shapeItems(cam, s, `b${i}`)).sort((a, b) => a.depth - b.depth);
  return (
    <>
      <Floor cam={cam} b={bounds} />
      {bg.map((it) => it.el)}
      {sorted.map((it) => it.el)}
      {guides && guideVisible(view) && <Guide cam={cam} demo={demo} b={bounds} />}
    </>
  );
}

const PRESETS: { label: string; view: (home: View) => View }[] = [
  { label: '斜前方', view: () => ({ yaw: 40, pitch: 15 }) },
  { label: '側面', view: () => ({ yaw: 0, pitch: 0 }) },
  { label: '正面', view: () => ({ yaw: 90, pitch: 0 }) },
  { label: '背面', view: () => ({ yaw: -90, pitch: 0 }) },
  { label: '上方', view: () => ({ yaw: 0, pitch: 90 }) },
];

/** 一開始的視角：原本平面示範的方向稍微轉一點，看得出立體 */
const startView = (home: View): View => (home.pitch === 90 ? { yaw: 0, pitch: 60 } : { yaw: home.yaw + 25, pitch: 12 });

interface Props {
  demo: Demo;
  label: string;
}

/**
 * 假人動作示範（3D）
 * - 自動循環播放；可暫停、慢速、顯示輔助線
 * - 拖動滑桿可以停在任何位置仔細看
 * - 在畫面上拖曳可以轉動視角，也可以直接選側面、正面、背面、上方
 * - 系統設定「減少動態效果」時，預設暫停
 */
export function Mannequin({ demo, label }: Props) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduce);
  const [slow, setSlow] = useState(false);
  const [guides, setGuides] = useState(true);
  const [manual, setManual] = useState(0);
  const [state, setState] = useState<{ p: number; phase: Phase }>({ p: 0, phase: 'top' });
  const home = useMemo(() => homeView(demo), [demo]);
  const [view, setView] = useState<View>(() => startView(home));
  const bounds = useMemo(() => boundsOf(demo), [demo]);
  const timeRef = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number; view: View } | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      timeRef.current += ((now - last) / 1000) * (slow ? 0.5 : 1);
      last = now;
      setState(progressAt(demo, timeRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, slow, demo]);

  const p = playing ? state.p : manual;
  const phase: Phase = playing ? state.phase : manual > 0.95 ? 'bottom' : manual < 0.05 ? 'top' : 'down';
  const scene = sceneAt(demo, p);
  const vb = makeCamera(view, bounds).viewBox;

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setView({ yaw: d.view.yaw - (e.clientX - d.x) * 0.6, pitch: clampPitch(d.view.pitch + (e.clientY - d.y) * 0.5) });
  };
  const endDrag = () => (drag.current = null);

  return (
    <div class="mq">
      <div class="mq-stage">
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          role="img"
          aria-label={`${label}動作示範動畫，可以拖曳轉動視角`}
          class="mq-3d"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <Stage demo={demo} scene={scene} view={view} bounds={bounds} guides={guides} />
        </svg>
        <p class="mq-caption" aria-live="polite">
          {demo.captions[phase]}
        </p>
      </div>

      <div class="chips mq-views" role="group" aria-label="視角">
        {PRESETS.map((pr) => (
          <button key={pr.label} type="button" class="chip chip-sm" onClick={() => setView(pr.view(home))}>
            {pr.label}
          </button>
        ))}
      </div>
      <p class="muted small-text mq-hint">在畫面上拖曳可以轉動視角</p>

      <input
        type="range"
        class="mq-slider"
        min="0"
        max="100"
        value={Math.round(p * 100)}
        aria-label="拖動查看每個位置"
        onInput={(e) => {
          setPlaying(false);
          setManual(Number(e.currentTarget.value) / 100);
        }}
      />
      <div class="mq-slider-labels" aria-hidden="true">
        <span>{demo.labels?.start ?? '起始'}</span>
        <span>{demo.labels?.end ?? '最低點'}</span>
      </div>

      <div class="mq-controls">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onClick={() => {
            if (!playing) timeRef.current = 0;
            setPlaying(!playing);
          }}
        >
          {playing ? '暫停' : '播放'}
        </button>
        <button type="button" class={slow ? 'chip chip-sm is-active-soft' : 'chip chip-sm'} aria-pressed={slow} onClick={() => setSlow(!slow)}>
          慢速
        </button>
        {demo.guideX && (
          <button type="button" class={guides ? 'chip chip-sm is-active-soft' : 'chip chip-sm'} aria-pressed={guides} onClick={() => setGuides(!guides)}>
            輔助線
          </button>
        )}
      </div>
    </div>
  );
}
