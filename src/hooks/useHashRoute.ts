import { useEffect, useState } from 'preact/hooks';

/** 底部導覽的主頁 */
export type Route = 'log' | 'charts' | 'body' | 'diet' | 'tools' | 'settings';

const ROUTES: readonly Route[] = ['log', 'charts', 'body', 'diet', 'tools', 'settings'];
const DEFAULT_ROUTE: Route = 'log';

export interface RouteState {
  route: Route;
  /** 主頁之後的路徑段落，例如 #/log/view/abc → ['view', 'abc'] */
  params: string[];
}

/** 網址片段解碼；格式錯誤（例如手打的 %E0）時保留原字串，不讓整個 App 出錯 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * 解析網址 hash。
 * 使用 hash 路由是因為 GitHub Pages 沒有伺服器端改寫，一般路徑在重新整理時會 404。
 */
function parseHash(hash: string): RouteState {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const first = segments[0] ?? '';
  if (!(ROUTES as readonly string[]).includes(first)) return { route: DEFAULT_ROUTE, params: [] };
  return { route: first as Route, params: segments.slice(1).map(safeDecode) };
}

/** 切換頁面，例如 navigate('/log/view/abc') */
export function navigate(path: string): void {
  window.location.hash = path;
}

export function useHashRoute(): RouteState {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return parseHash(hash);
}
