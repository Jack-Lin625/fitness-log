import { useEffect, useRef } from 'preact/hooks';
import { createStore, useStore } from '../lib/store';

/** 確認對話框（取代瀏覽器內建的 confirm，按鈕比較大、可以標示危險操作） */
export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  /** 刪除類操作用紅色按鈕 */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const dialogStore = createStore<Pending | null>(null);

/** 顯示確認對話框，使用者按確認回傳 true */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    dialogStore.get()?.resolve(false); // 同時只開一個
    dialogStore.set({ ...options, resolve });
  });
}

function close(ok: boolean) {
  const pending = dialogStore.get();
  dialogStore.set(null);
  pending?.resolve(ok);
}

/** 放在 App 最外層一次即可 */
export function DialogHost() {
  const pending = useStore(dialogStore);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement;
    // 危險操作預設聚焦「取消」，避免一按 Enter 就刪除
    (pending.danger ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // 關閉後把焦點還給開啟對話框的按鈕
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [pending]);

  if (!pending) return null;

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && close(false)}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{pending.title}</h2>
        {pending.body && <p>{pending.body}</p>}
        <div class="dialog-actions">
          <button type="button" ref={cancelRef} class="btn btn-secondary" onClick={() => close(false)}>
            {pending.cancelText ?? '取消'}
          </button>
          <button
            type="button"
            ref={confirmRef}
            class={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => close(true)}
          >
            {pending.confirmText ?? '確定'}
          </button>
        </div>
      </div>
    </div>
  );
}
