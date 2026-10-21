import { LocalStorageAdapter } from './localStorageAdapter';
import { Repository } from './repository';

/**
 * 全 App 共用的 repository 實例。
 * 要換成 IndexedDB 或後端時，只需替換這裡傳入的 adapter。
 */
export const repo = new Repository(new LocalStorageAdapter());
