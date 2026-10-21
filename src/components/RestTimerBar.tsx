import { useEffect, useState } from 'preact/hooks';
import { formatDuration } from '../lib/number';
import { adjustRest, remainingSeconds, restTimerStore, stopRest } from '../lib/restTimer';
import { useStore } from '../lib/store';

/**
 * 組間休息計時條，固定在畫面底部（有底部導覽時在導覽上方）。
 * 勾選完成一組時自動出現。
 */
export function RestTimerBar({ aboveNav }: { aboveNav: boolean }) {
  const timer = useStore(restTimerStore);
  const [now, setNow] = useState(Date.now());

  // 倒數中每 250ms 更新畫面
  useEffect(() => {
    if (timer.status !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer.status]);

  if (timer.status === 'idle') return null;

  const cls = `rest-bar${aboveNav ? ' above-nav' : ''}${timer.status === 'done' ? ' is-done' : ''}`;

  if (timer.status === 'done') {
    return (
      <div class={cls} role="alert">
        <div class="rest-main">
          <span class="rest-done-text">休息結束</span>
        </div>
        <button type="button" class="rest-btn" onClick={stopRest}>
          關閉
        </button>
      </div>
    );
  }

  const left = remainingSeconds(timer, now);
  const progress = timer.duration > 0 ? left / timer.duration : 0;

  return (
    <div class={cls} role="timer" aria-label={`休息剩餘 ${formatDuration(left)}`}>
      <div class="rest-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <div class="rest-main">
        <span class="rest-label">休息</span>
        <span class="num rest-time">{formatDuration(left)}</span>
      </div>
      <button type="button" class="rest-btn" onClick={() => adjustRest(-15)} aria-label="減少 15 秒">
        −15
      </button>
      <button type="button" class="rest-btn" onClick={() => adjustRest(15)} aria-label="增加 15 秒">
        +15
      </button>
      <button type="button" class="rest-btn" onClick={stopRest}>
        跳過
      </button>
    </div>
  );
}
