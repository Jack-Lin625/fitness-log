import { useEffect, useRef, useState } from 'preact/hooks';
import { easeInOut, type Demo, type Pose, type Vec } from '../demos/types';

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

/** 畫出一個姿勢 */
function Figure(props: { pose: Pose; guide: { x: number; label: string } | null; bench: Demo['bench'] }) {
  const { pose, guide, bench } = props;
  return (
    <>
      <path d="M10 198H190" class="mq-floor" />
      {bench && (
        <>
          <path d={`M${bench.x1 + 8} ${bench.y + 6}V198M${bench.x2 - 8} ${bench.y + 6}V198`} class="mq-bench-leg" />
          <rect x={bench.x1} y={bench.y} width={bench.x2 - bench.x1} height="8" rx="3" class="mq-bench" />
        </>
      )}
      {guide && (
        <>
          <path d={`M${guide.x} 4V198`} class="mq-guide" />
          <text x={guide.x + 4} y="2" class="mq-guide-label">
            {guide.label}
          </text>
        </>
      )}
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
  const pose = demo.pose(p);
  const guide = guides && demo.guideX ? demo.guideX(pose) : null;
  const view = demo.view ?? { top: -10, height: 220 };

  return (
    <div class="mq">
      <div class="mq-stage">
        <svg viewBox={`0 ${view.top} 200 ${view.height}`} role="img" aria-label={`${label}動作示範動畫`}>
          <Figure pose={pose} guide={guide} bench={demo.bench} />
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
