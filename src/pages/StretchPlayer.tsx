import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildRoutine, PREP_SECONDS, SWITCH_SECONDS, type Stretch } from '../data/stretches';
import { navigate } from '../hooks/useHashRoute';
import { useRepository } from '../hooks/useRepository';
import { useWakeLock } from '../hooks/useWakeLock';
import { formatDuration } from '../lib/number';
import { playBeep, unlockAudio, vibrate } from '../lib/sound';
import { parseParts } from '../lib/stretchRoute';

/** 播放流程中的一步：一個動作的一邊（或不分邊） */
interface Step {
  stretch: Stretch;
  side: '左側' | '右側' | null;
  /** 開始維持前的準備秒數（新動作 5 秒、換邊 3 秒） */
  prep: number;
}

function buildSteps(routine: Stretch[]): Step[] {
  return routine.flatMap((stretch): Step[] =>
    stretch.perSide
      ? [
          { stretch, side: '左側', prep: PREP_SECONDS },
          { stretch, side: '右側', prep: SWITCH_SECONDS },
        ]
      : [{ stretch, side: null, prep: PREP_SECONDS }],
  );
}

type Phase = 'prep' | 'hold';

/**
 * 引導拉伸（全螢幕）
 * 每一步先倒數準備，再倒數維持；時間到自動進入下一步。
 * 以「結束時間點」計時，暫停時記住剩餘時間。
 */
export function StretchPlayer({ partsParam }: { partsParam: string | undefined }) {
  const repo = useRepository();
  const settings = repo.getSettings();
  const hold = settings.stretchSeconds ?? 30;
  const steps = useMemo(() => buildSteps(buildRoutine(parseParts(partsParam))), [partsParam]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('prep');
  const [endAt, setEndAt] = useState(() => Date.now() + (steps[0]?.prep ?? 0) * 1000);
  /** 暫停中時的剩餘毫秒；null = 進行中 */
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);

  useWakeLock(!finished);

  // 解鎖音效：使用者點「開始拉伸」才進到這頁，屬於使用者操作
  useEffect(() => {
    if (settings.timerSound) unlockAudio();
  }, []);

  const cue = (beeps: number) => {
    if (settings.timerSound) playBeep(beeps);
    if (settings.timerVibrate) vibrate(beeps > 1 ? [200, 100, 200] : [200]);
  };

  const goTo = (i: number) => {
    if (i >= steps.length) {
      setFinished(true);
      cue(3);
      return;
    }
    const target = Math.max(0, i);
    setIndex(target);
    setPhase('prep');
    setPausedLeft(null);
    setEndAt(Date.now() + (steps[target]?.prep ?? 0) * 1000);
  };

  // 計時：準備結束 → 開始維持；維持結束 → 下一步
  useEffect(() => {
    if (finished || pausedLeft !== null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t < endAt) return;
      if (phase === 'prep') {
        cue(1);
        setPhase('hold');
        setEndAt(t + hold * 1000);
      } else {
        cue(2);
        goTo(index + 1);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [endAt, phase, index, pausedLeft, finished]);

  const togglePause = () => {
    if (pausedLeft === null) setPausedLeft(Math.max(0, endAt - Date.now()));
    else {
      setEndAt(Date.now() + pausedLeft);
      setPausedLeft(null);
    }
  };

  const exit = () => navigate('/tools/stretch');

  if (steps.length === 0) {
    return (
      <div class="stretch-done">
        <h1>沒有選擇部位</h1>
        <button type="button" class="btn btn-primary btn-block" onClick={exit}>
          回到拉伸設定
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div class="stretch-done">
        <h1>拉伸完成</h1>
        <p class="muted">今天的訓練辛苦了，記得補充水分。</p>
        <button type="button" class="btn btn-primary btn-block" onClick={() => navigate('/log')}>
          回到紀錄
        </button>
        <button type="button" class="btn btn-secondary btn-block" onClick={() => goTo(0)}>
          再做一次
        </button>
      </div>
    );
  }

  const step = steps[index]!;
  const next = steps[index + 1];
  const leftMs = pausedLeft ?? Math.max(0, endAt - now);
  const leftSec = Math.ceil(leftMs / 1000);
  const total = phase === 'prep' ? step.prep : hold;
  const isSwitch = phase === 'prep' && step.side === '右側';

  return (
    <div class={`stretch-player phase-${phase}`}>
      <header class="editor-bar">
        <button type="button" class="btn-text" onClick={exit}>
          ‹ 結束
        </button>
        <div class="editor-title">
          拉伸
          <span class="editor-count">
            <span class="num">{index + 1}</span> / <span class="num">{steps.length}</span>
          </span>
        </div>
        <span />
      </header>

      <div class="stretch-progress" aria-hidden="true">
        <div style={{ width: `${(index / steps.length) * 100}%` }} />
      </div>

      <section class="stretch-stage" aria-live="polite">
        <p class="stretch-phase">
          {phase === 'prep' ? (isSwitch ? '換邊' : '準備') : '保持'}
          {pausedLeft !== null && '（暫停中）'}
        </p>
        <h1 class="stretch-title">{step.stretch.name}</h1>
        <p class="stretch-meta">
          {step.side && <span class="tag tag-accent">{step.side}</span>}
          <span class="muted">{step.stretch.target}</span>
        </p>

        <div class="stretch-clock" role="timer">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="54" class="clock-track" />
            <circle
              cx="60"
              cy="60"
              r="54"
              class="clock-fill"
              style={{ strokeDashoffset: `${339.3 * (1 - leftMs / (total * 1000))}` }}
            />
          </svg>
          <span class="num stretch-seconds">{leftSec}</span>
        </div>

        <ul class="stretch-cues">
          {step.stretch.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <div class="stretch-controls">
        <button type="button" class="btn btn-secondary" disabled={index === 0} onClick={() => goTo(index - 1)}>
          上一個
        </button>
        <button type="button" class="btn btn-primary" onClick={togglePause}>
          {pausedLeft === null ? '暫停' : '繼續'}
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => goTo(index + 1)}>
          下一個
        </button>
      </div>

      <p class="stretch-next muted">
        {next
          ? `下一個：${next.stretch.name}${next.side ? `（${next.side}）` : ''}`
          : '這是最後一個動作'}
        ，剩下約 {formatDuration(leftSec + steps.slice(index + 1).reduce((s, x) => s + x.prep + hold, 0) + (phase === 'prep' ? hold : 0))}
      </p>
    </div>
  );
}
