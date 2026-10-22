import { useEffect, useMemo, useState } from 'preact/hooks';
import { MUSCLE_LABELS } from '../data/catalog';
import { buildRoutine, PREP_SECONDS, SWITCH_SECONDS, type Stretch } from '../data/stretches';
import { buildWarmup } from '../data/warmups';
import { navigate } from '../hooks/useHashRoute';
import { useRepository } from '../hooks/useRepository';
import { useWakeLock } from '../hooks/useWakeLock';
import { formatDuration } from '../lib/number';
import { playBeep, unlockAudio, vibrate } from '../lib/sound';
import { parseMuscles } from '../lib/stretchRoute';

export type RoutineMode = 'stretch' | 'warmup';

/** 播放流程中的一步：一個動作的一邊（或不分邊） */
interface Step {
  item: Stretch;
  side: '左側' | '右側' | null;
  /** 開始前的準備秒數 */
  prep: number;
  /** 進行／維持的秒數 */
  duration: number;
}

/** 兩種模式的文字與節奏 */
const MODE = {
  stretch: { title: '拉伸', active: '保持', prep: PREP_SECONDS, switchPrep: SWITCH_SECONDS, setupPath: '/tools/stretch' },
  warmup: { title: '熱身', active: '進行', prep: 5, switchPrep: 3, setupPath: '/tools/warmup' },
} as const;

/**
 * 引導播放（全螢幕）：練前熱身與練後拉伸共用
 * 每一步先倒數準備，再倒數進行；時間到自動進入下一步。
 * 以「結束時間點」計時，暫停時記住剩餘時間。
 */
export function RoutinePlayer({ mode, musclesParam }: { mode: RoutineMode; musclesParam: string | undefined }) {
  const repo = useRepository();
  const settings = repo.getSettings();
  const cfg = MODE[mode];
  const hold = settings.stretchSeconds ?? 30;
  const roller = settings.stretchRoller ?? false;
  const hasDraft = repo.getDraft() !== null;

  const steps = useMemo((): Step[] => {
    const muscles = parseMuscles(musclesParam);
    const items: (Stretch & { seconds?: number })[] =
      mode === 'warmup' ? buildWarmup(muscles) : buildRoutine(muscles, { roller });
    return items.flatMap((item): Step[] => {
      const duration = item.seconds ?? hold;
      return item.perSide
        ? [
            { item, side: '左側', prep: cfg.prep, duration },
            { item, side: '右側', prep: cfg.switchPrep, duration },
          ]
        : [{ item, side: null, prep: cfg.prep, duration }];
    });
  }, [musclesParam, mode, roller, hold]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'prep' | 'active'>('prep');
  const [endAt, setEndAt] = useState(() => Date.now() + (steps[0]?.prep ?? 0) * 1000);
  /** 暫停中時的剩餘毫秒；null = 進行中 */
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);

  useWakeLock(!finished);

  // 解鎖音效：使用者點按鈕才進到這頁，屬於使用者操作
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

  // 計時：準備結束 → 開始；結束 → 下一步
  useEffect(() => {
    if (finished || pausedLeft !== null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t < endAt) return;
      if (phase === 'prep') {
        cue(1);
        setPhase('active');
        setEndAt(t + (steps[index]?.duration ?? hold) * 1000);
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

  // 熱身時若有進行中的訓練，結束後回到訓練畫面
  const backToWorkout = mode === 'warmup' && hasDraft;
  const exit = () => navigate(backToWorkout ? '/log/session' : cfg.setupPath);

  if (steps.length === 0) {
    return (
      <div class="stretch-done">
        <h1>沒有選擇肌群</h1>
        <button type="button" class="btn btn-primary btn-block" onClick={() => navigate(cfg.setupPath)}>
          回到{cfg.title}設定
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div class="stretch-done">
        <h1>{cfg.title}完成</h1>
        <p class="muted">
          {mode === 'warmup'
            ? '身體熱起來了。第一個動作記得先做幾組輕重量的熱身組再上正式重量。'
            : '今天的訓練辛苦了，記得補充水分。'}
        </p>
        {mode === 'warmup' ? (
          <button
            type="button"
            class="btn btn-primary btn-block"
            onClick={() => navigate(hasDraft ? '/log/session' : '/log')}
          >
            {hasDraft ? '回到訓練' : '開始訓練'}
          </button>
        ) : (
          <button type="button" class="btn btn-primary btn-block" onClick={() => navigate('/log')}>
            回到紀錄
          </button>
        )}
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
  const total = phase === 'prep' ? step.prep : step.duration;
  const isSwitch = phase === 'prep' && step.side === '右側';
  const remaining =
    leftSec + (phase === 'prep' ? step.duration : 0) + steps.slice(index + 1).reduce((s, x) => s + x.prep + x.duration, 0);

  return (
    <div class={`stretch-player phase-${phase === 'active' ? 'hold' : 'prep'}`}>
      <header class="editor-bar">
        <button type="button" class="btn-text" onClick={exit}>
          ‹ {backToWorkout ? '回訓練' : '結束'}
        </button>
        <div class="editor-title">
          {cfg.title}
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
          {phase === 'prep' ? (isSwitch ? '換邊' : '準備') : cfg.active}
          {pausedLeft !== null && '（暫停中）'}
        </p>
        <h1 class="stretch-title">{step.item.name}</h1>
        <p class="stretch-meta">
          {step.side && <span class="tag tag-accent">{step.side}</span>}
          {step.item.targets.map((m) => (
            <span key={m} class="tag">
              {MUSCLE_LABELS[m]}
            </span>
          ))}
        </p>
        <p class="stretch-detail muted">
          {step.item.detail}
          {step.item.needs && `｜需要：${step.item.needs}`}
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

        {/* 準備時看步驟，進行時看重點 */}
        <div class="stretch-info">
          <h2>{phase === 'prep' ? '怎麼做' : '注意重點'}</h2>
          {phase === 'prep' ? (
            <ol class="stretch-steps">
              {step.item.steps.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          ) : (
            <ul class="stretch-cues">
              {step.item.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <details class="stretch-mistakes">
            <summary>常見錯誤</summary>
            <ul>
              {step.item.mistakes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        </div>
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
        {next ? `下一個：${next.item.name}${next.side ? `（${next.side}）` : ''}` : '這是最後一個動作'}，剩下約{' '}
        {formatDuration(remaining)}
      </p>
    </div>
  );
}
