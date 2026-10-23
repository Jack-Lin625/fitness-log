import { render } from 'preact';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app';
import { cloud } from './actions/cloud';
import { repo } from './data';
import { loadGuideSheet } from './components/LazyGuideSheet';
import { loadChart } from './lib/chart';

/** 先載入資料再渲染，避免畫面先閃出空白資料 */
async function bootstrap() {
  await repo.init();
  const root = document.getElementById('app');
  if (root) render(<App />, root);
  // 有連線 Google Drive 時，資料變更會自動備份
  cloud.start();

  // 請瀏覽器把資料標記為「持久保存」，降低儲存空間不足時被自動清除的機會
  void navigator.storage?.persist?.().catch(() => undefined);

  if (import.meta.env.PROD) {
    // 註冊離線快取（只在正式版，開發時不啟用以免看到舊畫面）
    if ('serviceWorker' in navigator) {
      const base = import.meta.env.BASE_URL;
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
    }
    // 空閒時預先載入圖表與教學的程式，讓離線時也能開
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    idle(() => {
      void loadChart();
      // 教學頁也先在背景下載，第一次打開時不用等
      void loadGuideSheet().catch(() => undefined);
    });
  }
}

void bootstrap();
