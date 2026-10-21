import type { Chart, ChartConfiguration } from 'chart.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadChart, readTheme, type ChartTheme } from '../lib/chart';

interface Props {
  /** 依目前主題產生圖表設定 */
  build: (theme: ChartTheme) => ChartConfiguration;
  /** 這些值改變時重畫圖表 */
  deps: unknown[];
  height?: number;
  /** 給螢幕閱讀器的圖表說明 */
  label: string;
}

/**
 * Chart.js 的包裝元件
 * - 負責建立與銷毀圖表，避免切換頁面後殘留
 * - 系統切換深色／淺色模式時自動重畫
 */
export function ChartCanvas({ build, deps, height = 260, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setThemeVersion((n) => n + 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let chart: Chart | undefined;
    let cancelled = false;
    void loadChart().then((ChartClass) => {
      if (cancelled || !canvasRef.current) return;
      chart = new ChartClass(canvasRef.current, build(readTheme()));
    });
    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [...deps, themeVersion]);

  return (
    <div class="chart-box" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
