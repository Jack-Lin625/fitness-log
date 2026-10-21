/**
 * 提示音
 * 瀏覽器規定聲音必須由使用者的點擊「解鎖」後才能播放，
 * 所以在勾選完成一組（開始計時）時呼叫 unlockAudio()。
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // 不支援就算了，計時器仍會顯示「休息結束」
  }
}

/** 播放短促的嗶聲（預設三聲） */
export function playBeep(count = 3): void {
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const start = t0 + i * 0.28;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    // 忽略播放錯誤
  }
}

/** 震動（Android 支援；iPhone 的 Safari 不支援，會直接略過） */
export function vibrate(pattern: number[] = [300, 150, 300]): void {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
