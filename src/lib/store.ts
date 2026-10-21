import { useEffect, useState } from 'preact/hooks';

/** 極簡的全域狀態容器，給計時器、對話框、提示訊息這類跨頁面的 UI 狀態使用 */
export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = next;
      listeners.forEach((fn) => fn());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** 在元件中讀取 store，狀態改變時自動重新渲染 */
export function useStore<T>(store: Store<T>): T {
  const [, setRevision] = useState(0);
  useEffect(() => store.subscribe(() => setRevision((n) => n + 1)), [store]);
  return store.get();
}
