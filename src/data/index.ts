import { IndexedDbAdapter } from './indexedDbAdapter';
import { Repository } from './repository';

/**
 * 全 App 共用的 repository 實例。
 * 資料存在 IndexedDB（不能用時自動改用 localStorage）；要換成後端時，只需替換這裡傳入的 adapter。
 */
export const repo = new Repository(new IndexedDbAdapter());
