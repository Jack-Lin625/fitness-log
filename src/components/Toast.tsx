import { createStore, useStore } from '../lib/store';

/** 畫面上方短暫出現的提示訊息 */
interface ToastState {
  id: number;
  message: string;
}

const toastStore = createStore<ToastState | null>(null);
let timer: number | undefined;

export function showToast(message: string, durationMs = 2600): void {
  const id = Date.now();
  toastStore.set({ id, message });
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (toastStore.get()?.id === id) toastStore.set(null);
  }, durationMs);
}

export function ToastHost() {
  const toast = useStore(toastStore);
  if (!toast) return null;
  return (
    <div class="toast" role="status" key={toast.id} onClick={() => toastStore.set(null)}>
      {toast.message}
    </div>
  );
}
