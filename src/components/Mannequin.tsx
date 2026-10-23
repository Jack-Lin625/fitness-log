import { useEffect, useRef, useState } from 'preact/hooks';
import { easeInOut, type Demo, type FrontPose, type Pose, type Prop, type Vec } from '../demos/types';

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

const line = (a: Vec, b: Vec) => `M${a.x} ${a.y}L${b.x} ${b.y}`;
const poly = (...pts: Vec[]) => pts.map((v, i) => `${i ? 'L' : 'M'}${v.x} ${v.y}`).join('');

/** 會被身體擋住的器材（先畫）；其他（啞鈴、握把）畫在手上 */
const BEHIND = new Set<Prop['kind']>(['pad', 'frame', 'cable', 'pulley', 'box', 'bar']);

/** 畫一個器材 */
function PropShape({ prop }: { prop: Prop }) {
  switch (prop.kind) {
    case 'pad':
      return <path d={line(prop.a, prop.b)} class="mq-pad" style={{ strokeWidth: prop.w ?? 8 }} />;
    case 'frame':
      return <path d={poly(...prop.pts)} class="mq-frame" />;
    case 'cable':
      return <path d={line(prop.a, prop.b)} class="mq-cable" />;
    case 'pulley':
      return <circle cx={prop.at.x} cy={prop.at.y} r="4" class="mq-pulley" />;
    case 'bar':
      return <circle cx={prop.at.x} cy={prop.at.y} r="3.5" class="mq-hub" />;
    case 'box':
      return <rect x={prop.x} y={prop.y} width={prop.w} height={prop.h} rx="2" class="mq-box" />;
    case 'band':
      return <path d={line(prop.a, prop.b)} class="mq-band" />;
    case 'handle':
      return <circle cx={prop.at.x} cy={prop.at.y} r="3" class="mq-hub" />;
    case 'plate':
      return (
        <>
          <circle cx={prop.at.x} cy={prop.at.y} r={prop.r ?? 15} class="mq-plate" />
          <circle cx={prop.at.x} cy={prop.at.y} r="3" class="mq-hub" />
        </>
      );
    case 'kettlebell':
      return (
        <>
          <path d={`M${prop.at.x - 4} ${prop.at.y + 3}Q${prop.at.x} ${prop.at.y - 4} ${prop.at.x + 4} ${prop.at.y + 3}`} class="mq-kb-handle" />
          <circle cx={prop.at.x} cy={prop.at.y + 9} r="7" class="mq-weight" />
        </>
      );
    case 'dumbbell': {
      if (prop.angle === undefined) return <circle cx={prop.at.x} cy={prop.at.y} r="6.5" class="mq-weight" />;
      const a = (prop.angle * Math.PI) / 180;
      const d = { x: Math.cos(a) * 8, y: Math.sin(a) * 8 };
      const e1 = { x: prop.at.x - d.x, y: prop.at.y - d.y };
      const e2 = { x: prop.at.x + d.x, y: prop.at.y + d.y };
      return (
        <>
          <path d={line(e1, e2)} class="mq-db-handle" />
          <path d={line(e1, e1)} class="mq-db-end" />
          <path d={line(e2, e2)} class="mq-db-end" />
        </>
      );
    }
  }
}

function Props({ props, front }: { props: Prop[] | undefined; front: boolean }) {
  if (!props) return null;
  return (
    <>
      {props
        .filter((pr) => BEHIND.has(pr.kind) === front)
        .map((pr, i) => (
          <PropShape key={i} prop={pr} />
        ))}
    </>
  );
}

/** 地面、訓練椅、輔助線、靜態器材 */
function Scene(props: { demo: Demo; guide: { x: number; label: string } | null }) {
  const { demo, guide } = props;
  const bench = demo.bench;
  return (
    <>
      {demo.floor !== false && <path d="M10 198H190" class="mq-floor" />}
      {bench && (
        <>
          <path d={`M${bench.x1 + 8} ${bench.y + 6}V198M${bench.x2 - 8} ${bench.y + 6}V198`} class="mq-bench-leg" />
          <rect x={bench.x1} y={bench.y} width={bench.x2 - bench.x1} height="8" rx="3" class="mq-bench" />
        </>
      )}
      <Props props={demo.props} front={true} />
      {guide && (
        <>
          <path d={`M${guide.x} 4V198`} class="mq-guide" />
          <text x={guide.x + 4} y="2" class="mq-guide-label">
            {guide.label}
          </text>
        </>
      )}
    </>
  );
}

/** 側面姿勢 */
function SideFigure({ pose }: { pose: Pose }) {
  const far = pose.far;
  const farLeg = far && (far.knee || far.ankle);
  const farArm = far && (far.elbow || far.hand);
  return (
    <>
      <Props props={pose.props} front={true} />
      {/* 遠側的手腳（顏色較淡，畫在身體後面） */}
      {farLeg && (
        <>
          <path d={line(far.heel ?? pose.heel, far.toe ?? pose.toe)} class="mq-limb mq-foot mq-far" />
          <path d={poly(far.ankle ?? pose.ankle, far.knee ?? pose.knee, pose.hip)} class="mq-limb mq-far" />
        </>
      )}
      {farArm && <path d={poly(pose.shoulder, far.elbow ?? pose.elbow, far.hand ?? pose.hand)} class="mq-limb mq-arm mq-far" />}
      {/* 腳、腿 */}
      <path d={line(pose.heel, pose.toe)} class="mq-limb mq-foot" />
      <path d={poly(pose.ankle, pose.knee, pose.hip)} class="mq-limb" />
      {/* 軀幹、頭 */}
      <path d={line(pose.hip, pose.shoulder)} class="mq-limb mq-torso" />
      <path d={line(pose.shoulder, pose.neck)} class="mq-limb mq-neck" />
      <circle cx={pose.head.x} cy={pose.head.y} r="10" class="mq-head" />
      {/* 手臂 */}
      <path d={poly(pose.shoulder, pose.elbow, pose.hand)} class="mq-limb mq-arm" />
      {/* 關節 */}
      {[pose.knee, pose.hip, pose.shoulder, pose.elbow, pose.ankle].map((j, i) => (
        <circle key={i} cx={j.x} cy={j.y} r="2.6" class="mq-joint" />
      ))}
      <Props props={pose.props} front={false} />
      {/* 槓鈴（側面看到槓片正面） */}
      {pose.bar && (
        <>
          <circle cx={pose.bar.x} cy={pose.bar.y} r="15" class="mq-plate" />
          <circle cx={pose.bar.x} cy={pose.bar.y} r="3.5" class="mq-hub" />
        </>
      )}
    </>
  );
}

/** 正面姿勢 */
function FrontFigure({ pose }: { pose: FrontPose }) {
  const { l, r } = pose;
  const sides = [r, l];
  return (
    <>
      <Props props={pose.props} front={true} />
      {sides.map((s, i) => (
        <g key={i}>
          <path d={line(s.ankle, s.toe)} class="mq-limb mq-foot" />
          <path d={poly(s.ankle, s.knee, s.hip)} class="mq-limb" />
        </g>
      ))}
      {/* 骨盆、脊椎、肩膀 */}
      <path d={line(r.hip, l.hip)} class="mq-limb mq-torso" />
      <path d={line(pose.pelvis, pose.neck)} class="mq-limb mq-torso" />
      <path d={line(r.shoulder, l.shoulder)} class="mq-limb mq-torso" />
      <circle cx={pose.head.x} cy={pose.head.y} r="10" class="mq-head" />
      {sides.map((s, i) => (
        <path key={i} d={poly(s.shoulder, s.elbow, s.hand)} class="mq-limb mq-arm" />
      ))}
      {sides.flatMap((s, i) =>
        [s.knee, s.hip, s.shoulder, s.elbow, s.ankle].map((j, k) => <circle key={`${i}-${k}`} cx={j.x} cy={j.y} r="2.6" class="mq-joint" />),
      )}
      <Props props={pose.props} front={false} />
    </>
  );
}

/** 某個進度的靜態畫面（不含控制列） */
export function DemoFrame({ demo, p, guides = true }: { demo: Demo; p: number; guides?: boolean }) {
  const view = demo.view ?? { top: -10, height: 220 };
  const guide = guides && demo.guideX ? demo.guideX() : null;
  return (
    <svg viewBox={`0 ${view.top} 200 ${view.height}`}>
      <Scene demo={demo} guide={guide} />
      {demo.kind === 'front' ? <FrontFigure pose={demo.pose(p)} /> : <SideFigure pose={demo.pose(p)} />}
    </svg>
  );
}

interface Props {
  demo: Demo;
  label: string;
}

/**
 * 假人動作示範
 * - 自動循環播放；可暫停、慢速、顯示輔助線
 * - 拖動滑桿可以停在任何位置仔細看
 * - 系統設定「減少動態效果」時，預設暫停
 */
export function Mannequin({ demo, label }: Props) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduce);
  const [slow, setSlow] = useState(false);
  const [guides, setGuides] = useState(true);
  const [manual, setManual] = useState(0);
  const [state, setState] = useState<{ p: number; phase: Phase }>({ p: 0, phase: 'top' });
  const timeRef = useRef(0);

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
  const guide = guides && demo.guideX ? demo.guideX() : null;
  const view = demo.view ?? { top: -10, height: 220 };

  return (
    <div class="mq">
      <div class="mq-stage">
        <svg viewBox={`0 ${view.top} 200 ${view.height}`} role="img" aria-label={`${label}動作示範動畫`}>
          <Scene demo={demo} guide={guide} />
          {demo.kind === 'front' ? <FrontFigure pose={demo.pose(p)} /> : <SideFigure pose={demo.pose(p)} />}
        </svg>
        <p class="mq-caption" aria-live="polite">
          {demo.captions[phase]}
        </p>
      </div>

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
