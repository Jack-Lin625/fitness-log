import { playBeep, unlockAudio, vibrate } from './sound';
import { createStore } from './store';

/**
 * 組間休息計時器（全域，切換頁面也會繼續倒數）
 * 以「結束時間點」計算剩餘秒數，而不是每秒減一，
 * 所以手機鎖屏、切到別的 App 再回來，時間仍然正確。
 */
export interface RestTimerState {
  status: 'idle' | 'running' | 'done';
  /** 結束時間（timestamp） */
  endAt: number;
  /** 本次總秒數（畫進度條用） */
  duration: number;
}

export interface AlarmOptions {
  sound: boolean;
  vibrate: boolean;
}

export const restTimerStore = createStore<RestTimerState>({ status: 'idle', endAt: 0, duration: 0 });

let ticker: number | undefined;
let alarm: AlarmOptions = { sound: true, vibrate: true };

/** 開始（或重新開始）休息倒數 */
export function startRest(seconds: number, options: AlarmOptions): void {
  alarm = options;
  if (options.sound) unlockAudio();
  restTimerStore.set({ status: 'running', endAt: Date.now() + seconds * 1000, duration: seconds });
  ensureTicker();
}

/** 增減秒數（例如 +15 / -15） */
export function adjustRest(deltaSeconds: number): void {
  const s = restTimerStore.get();
  if (s.status !== 'running') return;
  const endAt = Math.max(Date.now() + 1000, s.endAt + deltaSeconds * 1000);
  restTimerStore.set({ ...s, endAt, duration: Math.max(1, s.duration + deltaSeconds) });
}

/** 停止並隱藏計時器 */
export function stopRest(): void {
  restTimerStore.set({ status: 'idle', endAt: 0, duration: 0 });
  clearTicker();
}

/** 剩餘秒數（無條件進位，讓最後一秒顯示 0:01 而不是 0:00） */
export function remainingSeconds(state: RestTimerState, now = Date.now()): number {
  return Math.max(0, Math.ceil((state.endAt - now) / 1000));
}

function ensureTicker(): void {
  if (ticker !== undefined) return;
  ticker = window.setInterval(() => {
    const s = restTimerStore.get();
    if (s.status !== 'running') return clearTicker();
    if (Date.now() >= s.endAt) {
      restTimerStore.set({ ...s, status: 'done' });
      clearTicker();
      if (alarm.vibrate) vibrate();
      if (alarm.sound) playBeep();
    }
  }, 250);
}

function clearTicker(): void {
  if (ticker !== undefined) window.clearInterval(ticker);
  ticker = undefined;
}
