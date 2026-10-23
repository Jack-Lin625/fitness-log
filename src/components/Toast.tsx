import { createStore, useStore } from '../lib/store';

/** 畫面上方短暫出現的提示訊息；可以帶一個按鈕（例如「復原」） */
interface ToastState {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  /** 訊息消失時呼叫（被按掉、時間到或被新訊息取代） */
  onClose?: () => void;
}

const toastStore = createStore<ToastState | null>(null);
let timer: number | undefined;
let nextId = 1;

function close(id: number) {
  const current = toastStore.get();
  if (current?.id !== id) return;
  toastStore.set(null);
  current.onClose?.();
}

function open(state: Omit<ToastState, 'id'>, durationMs: number): number {
  const previous = toastStore.get();
  const id = nextId++;
  toastStore.set({ ...state, id });
  previous?.onClose?.();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => close(id), durationMs);
  return id;
}

/** 目前顯示的提示（測試用） */
export const currentToast = (): Readonly<ToastState> | null => toastStore.get();

export function showToast(message: string, durationMs = 2600): void {
  open({ message }, durationMs);
}

/** 復原按鈕顯示的時間 */
export const UNDO_MS = 6000;

/**
 * 顯示「已刪除」與「復原」按鈕。
 * 按了復原回傳 true；時間到、被按掉或被新訊息取代回傳 false（這時才真正做不可逆的清理，例如刪照片）。
 */
export function showUndoToast(message: string, onUndo: () => Promise<void>): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    open(
      {
        message,
        action: {
          label: '復原',
          run: () => {
            if (settled) return;
            settled = true;
            toastStore.set(null);
            onUndo()
              .then(() => {
                showToast('已復原');
                resolve(true);
              })
              .catch(() => {
                showToast('復原失敗');
                resolve(false);
              });
          },
        },
        onClose: () => {
          if (settled) return;
          settled = true;
          resolve(false);
        },
      },
      UNDO_MS,
    );
  });
}

export function ToastHost() {
  const toast = useStore(toastStore);
  if (!toast) return null;
  return (
    <div class={toast.action ? 'toast toast-action' : 'toast'} role="status" key={toast.id} onClick={() => close(toast.id)}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          class="toast-btn"
          onClick={(e) => {
            e.stopPropagation();
            toast.action?.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
