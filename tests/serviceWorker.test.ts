/**
 * Service Worker 測試
 * 實際建置一次到暫存資料夾，再把 dist/sw.js 放進模擬的 Service Worker 環境執行：
 * 快取（CacheStorage）、網路（可切換離線）、install／activate／fetch 事件。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const ORIGIN = 'http://localhost';
const SCOPE = `${ORIGIN}/fitness-log/`;
const root = join(__dirname, '..');

// ───────── 模擬環境 ─────────

type Store = Map<string, Response>;

/** 模擬 CacheStorage（所有版本的 Service Worker 共用同一個） */
function createCaches(net: (url: string) => Promise<Response>) {
  const stores = new Map<string, Store>();
  const urlOf = (r: string | { url: string }) => (typeof r === 'string' ? r : r.url);
  const cacheApi = (m: Store) => ({
    async put(req: string | { url: string }, res: Response) {
      m.set(urlOf(req), res);
    },
    async match(req: string | { url: string }) {
      return m.get(urlOf(req))?.clone();
    },
    async addAll(urls: string[]) {
      const fetched: [string, Response][] = [];
      for (const u of urls) {
        const res = await net(u);
        if (!res.ok) throw new TypeError(`addAll 失敗：${u} ${res.status}`);
        fetched.push([u, res]);
      }
      fetched.forEach(([u, r]) => m.set(u, r));
    },
  });
  return {
    stores,
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      return cacheApi(stores.get(name)!);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(req: string | { url: string }) {
      for (const m of stores.values()) {
        const hit = m.get(urlOf(req));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
}

/** 模擬網路：從建置結果讀檔，可以切換離線，並記錄請求了哪些路徑 */
function createNetwork(siteDir: string) {
  const state = { online: true, requests: [] as string[] };
  const fetch = async (url: string): Promise<Response> => {
    const { pathname } = new URL(url);
    state.requests.push(pathname);
    if (!state.online) throw new TypeError('Failed to fetch');
    const rel = pathname.replace(/^\/fitness-log\//, '') || 'index.html';
    const file = join(siteDir, rel);
    return existsSync(file) ? new Response(readFileSync(file)) : new Response('not found', { status: 404 });
  };
  return { state, fetch };
}

type Listener = (event: Record<string, unknown>) => void;

/** 載入一份 sw.js 原始碼，回傳觸發事件的方法 */
function loadServiceWorker(source: string, caches: ReturnType<typeof createCaches>, net: (url: string) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const self = {
    registration: { scope: SCOPE },
    location: { origin: ORIGIN },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, (req: string | { url: string }) =>
    net(typeof req === 'string' ? req : req.url),
  );

  const dispatch = async (type: string, extra: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = [];
    listeners[type]?.({ ...extra, waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  };

  return {
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    /** 回傳 Response、'network-error'，或 null（Service Worker 不處理，交給瀏覽器） */
    async fetch(path: string, mode: 'navigate' | 'no-cors' = 'no-cors'): Promise<Response | 'network-error' | null> {
      let responded: Promise<Response> | null = null;
      const pending: Promise<unknown>[] = [];
      listeners.fetch?.({
        request: { url: new URL(path, SCOPE).href, method: 'GET', mode },
        respondWith: (p: Promise<Response>) => {
          responded = p;
        },
        waitUntil: (p: Promise<unknown>) => pending.push(p),
      });
      if (!responded) return null;
      try {
        const res: Response = await responded;
        await Promise.all(pending);
        return res;
      } catch {
        return 'network-error';
      }
    },
  };
}

// ───────── 建置 ─────────

let outDir = '';
let swSource = '';
let version = '';
let precache: string[] = [];
let indexHtml = '';

async function buildTo(dir: string) {
  await build({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir: dir, emptyOutDir: true },
  });
  return readFileSync(join(dir, 'sw.js'), 'utf8');
}

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'fitlog-sw-'));
  swSource = await buildTo(outDir);
  version = swSource.match(/const VERSION = '([^']+)'/)?.[1] ?? '';
  precache = JSON.parse(swSource.match(/const PRECACHE = (\[.*\]);/)?.[1] ?? '[]') as string[];
  indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
}, 60_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

// ───────── 測試 ─────────

describe('建置時填入 sw.js', () => {
  it('填入版本號與檔案清單', () => {
    expect(version).toMatch(/^[0-9a-f]{12}$/);
    expect(precache.length).toBeGreaterThan(5);
  });

  it('清單包含首頁、index.html 引用的檔案、圖表程式、字型與圖示，但不含 sw.js 本身', () => {
    const assetsInHtml = [...indexHtml.matchAll(/\/fitness-log\/(assets\/[^"]+)/g)].map((m) => m[1]);
    expect(assetsInHtml.length).toBeGreaterThan(0);
    expect(precache).toEqual(expect.arrayContaining(['./', 'manifest.webmanifest', 'icon-192.png', ...assetsInHtml]));
    expect(precache.some((p) => p.startsWith('assets/chart-'))).toBe(true);
    expect(precache.some((p) => p.endsWith('.woff2'))).toBe(true);
    expect(precache).not.toContain('sw.js');
    expect(precache).not.toContain('index.html');
  });

  it('內容相同時重新建置，版本號不變（使用者不用重新下載）', async () => {
    const again = mkdtempSync(join(tmpdir(), 'fitlog-sw-'));
    try {
      expect(await buildTo(again)).toBe(swSource);
    } finally {
      rmSync(again, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('Service Worker 行為', () => {
  let net: ReturnType<typeof createNetwork>;
  let caches: ReturnType<typeof createCaches>;
  let sw: ReturnType<typeof loadServiceWorker>;

  beforeEach(async () => {
    net = createNetwork(outDir);
    caches = createCaches(net.fetch);
    // 使用者手機上舊版 Service Worker 留下的快取
    caches.stores.set('fitlog-v1', new Map([[`${SCOPE}assets/index-OLD.js`, new Response('old')]]));
    sw = loadServiceWorker(swSource, caches, net.fetch);
    await sw.install();
    await sw.activate();
  });

  it('安裝時下載清單上的所有檔案；啟用後刪掉舊版快取', () => {
    expect([...caches.stores.keys()]).toEqual([`fitlog-${version}`]);
    expect(caches.stores.get(`fitlog-${version}`)?.size).toBe(precache.length);
  });

  it('離線時：首頁與任何網址都回傳快取的 index.html', async () => {
    net.state.online = false;
    for (const path of ['/fitness-log/', '/fitness-log/?from=homescreen']) {
      const res = await sw.fetch(path, 'navigate');
      expect(res).toBeInstanceOf(Response);
      expect(await (res as Response).text()).toBe(indexHtml);
    }
  });

  it('離線時：沒開過的圖表頁程式和圖示也拿得到', async () => {
    net.state.online = false;
    const chart = precache.find((p) => p.startsWith('assets/chart-'));
    for (const path of [`/fitness-log/${chart}`, '/fitness-log/icon-192.png']) {
      const res = await sw.fetch(path);
      expect(res instanceof Response && res.ok).toBe(true);
    }
  });

  it('離線時：快取裡也沒有的檔案回傳網路錯誤，不會卡住', async () => {
    net.state.online = false;
    const res = await sw.fetch('/fitness-log/not-exist.png');
    expect(res === 'network-error' || (res instanceof Response && res.type === 'error')).toBe(true);
  });

  it('上線時：首頁先抓網路上的新版，打包檔直接用快取', async () => {
    const chart = precache.find((p) => p.startsWith('assets/chart-'));
    net.state.requests.length = 0;
    await sw.fetch('/fitness-log/', 'navigate');
    await sw.fetch(`/fitness-log/${chart}`);
    expect(net.state.requests).toEqual(['/fitness-log/']);
  });

  it('其他網站的請求不處理', async () => {
    expect(await sw.fetch('https://example.com/x.css')).toBeNull();
  });

  it('下次部署：新版安裝期間舊版快取仍在，啟用後只剩新版', async () => {
    const next = loadServiceWorker(swSource.replace(`'${version}'`, "'nextdeploy'"), caches, net.fetch);
    await next.install();
    expect([...caches.stores.keys()].sort()).toEqual([`fitlog-${version}`, 'fitlog-nextdeploy'].sort());
    await next.activate();
    expect([...caches.stores.keys()]).toEqual(['fitlog-nextdeploy']);
  });

  it('有檔案下載失敗時安裝失敗，舊版快取不受影響（瀏覽器會繼續用舊版）', async () => {
    const broken = swSource.replace(`'${version}'`, "'broken'").replace('"./",', '"./","assets/missing.js",');
    await expect(loadServiceWorker(broken, caches, net.fetch).install()).rejects.toThrow('addAll 失敗');
    expect(caches.stores.has(`fitlog-${version}`)).toBe(true);
  });
});
