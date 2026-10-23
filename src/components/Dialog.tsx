import { useEffect, useRef, useState } from 'preact/hooks';
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

/** 需要輸入文字的對話框（例如替範本取名） */
export interface PromptOptions extends Omit<ConfirmOptions, 'danger'> {
  value?: string;
  placeholder?: string;
  maxLength?: number;
}

interface Pending extends ConfirmOptions {
  /** 有值代表要顯示輸入框 */
  input?: { value: string; placeholder?: string | undefined; maxLength?: number | undefined };
  resolve: (ok: boolean, text?: string) => void;
}

const dialogStore = createStore<Pending | null>(null);

/** 顯示確認對話框，使用者按確認回傳 true */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    dialogStore.get()?.resolve(false); // 同時只開一個
    dialogStore.set({ ...options, resolve });
  });
}

/** 顯示輸入框，按確認回傳去掉前後空白的文字（空白不能確認），取消回傳 null */
export function promptDialog({ value = '', placeholder, maxLength, ...options }: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    dialogStore.get()?.resolve(false);
    dialogStore.set({
      ...options,
      input: { value, placeholder, maxLength },
      resolve: (ok, text) => resolve(ok && text ? text : null),
    });
  });
}

function close(ok: boolean, text?: string) {
  const pending = dialogStore.get();
  dialogStore.set(null);
  pending?.resolve(ok, text);
}

/** 放在 App 最外層一次即可 */
export function DialogHost() {
  const pending = useStore(dialogStore);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement;
    setText(pending.input?.value ?? '');
    // 有輸入框時聚焦輸入框；危險操作預設聚焦「取消」，避免一按 Enter 就刪除
    if (pending.input) inputRef.current?.focus();
    else (pending.danger ? cancelRef : confirmRef).current?.focus();
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
  const trimmed = text.trim();
  const confirm = () => (pending.input ? trimmed && close(true, trimmed) : close(true));

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && close(false)}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{pending.title}</h2>
        {pending.body && <p>{pending.body}</p>}
        {pending.input && (
          <input
            ref={inputRef}
            class="input dialog-input"
            value={text}
            placeholder={pending.input.placeholder}
            maxLength={pending.input.maxLength}
            aria-labelledby="dialog-title"
            onInput={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
            }}
          />
        )}
        <div class="dialog-actions">
          <button type="button" ref={cancelRef} class="btn btn-secondary" onClick={() => close(false)}>
            {pending.cancelText ?? '取消'}
          </button>
          <button
            type="button"
            ref={confirmRef}
            class={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={pending.input !== undefined && !trimmed}
            onClick={confirm}
          >
            {pending.confirmText ?? '確定'}
          </button>
        </div>
      </div>
    </div>
  );
}
