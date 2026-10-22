import { defineConfig } from 'vitest/config';

// 測試設定與 vite.config.ts 分開：測試只跑純邏輯（資料層、計算函式、Service Worker），不需要 Preact 外掛
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
