import { render } from 'preact';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app';
import { repo } from './data';
import { loadChart } from './lib/chart';

/** 先載入資料再渲染，避免畫面先閃出空白資料 */
async function bootstrap() {
  await repo.init();
  const root = document.getElementById('app');
  if (root) render(<App />, root);

  // 請瀏覽器把資料標記為「持久保存」，降低儲存空間不足時被自動清除的機會
  void navigator.storage?.persist?.().catch(() => undefined);

  if (import.meta.env.PROD) {
    // 註冊離線快取（只在正式版，開發時不啟用以免看到舊畫面）
    if ('serviceWorker' in navigator) {
      const base = import.meta.env.BASE_URL;
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
    }
    // 空閒時預先載入圖表程式，讓離線時圖表頁也能開
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    idle(() => void loadChart());
  }
}

void bootstrap();
