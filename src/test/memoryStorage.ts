/**
 * 測試用的 localStorage：資料存在記憶體，可以模擬容量上限。
 * Node 沒有 localStorage（或版本不同行為不同），測試一律換成這個。
 */
export interface MemoryStorage {
  /** 目前存的所有 key → value */
  readonly store: Map<string, string>;
  /** 容量上限（字元數），超過時 setItem 丟出 QuotaExceededError */
  quota: number;
  /** 清空資料並取消容量上限 */
  reset(): void;
}

export function installMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();
  const control: MemoryStorage = {
    store,
    quota: Infinity,
    reset() {
      store.clear();
      control.quota = Infinity;
    },
  };
  const used = () => [...store.values()].reduce((n, v) => n + v.length, 0);

  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem(key: string, value: string) {
      const v = String(value);
      if (used() - (store.get(key)?.length ?? 0) + v.length > control.quota) {
        throw new DOMException('儲存空間已滿', 'QuotaExceededError');
      }
      store.set(key, v);
    },
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };

  // 讓 Object.keys(localStorage) 和瀏覽器一樣列出所有已存的 key
  const proxy = new Proxy(storage, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (target, key) =>
      typeof key === 'string' && store.has(key)
        ? { enumerable: true, configurable: true, value: store.get(key) }
        : Reflect.getOwnPropertyDescriptor(target, key),
  });

  Object.defineProperty(globalThis, 'localStorage', { value: proxy, configurable: true, writable: true });
  return control;
}
