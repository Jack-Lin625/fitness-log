/*
 * Service Worker：讓 App 在沒有網路時也能開啟（健身房常常收訊不好）
 * - 安裝時預先下載這一版的所有檔案（含圖表程式、字型），第一次開啟後就能完整離線使用
 * - 頁面本身：先抓網路上的新版，失敗才用快取
 * - 打包後的檔案：檔名含雜湊值、內容不會變，直接用快取
 * - 每次部署都是新的快取名稱，新版啟用時刪掉舊版快取，空間不會越用越多
 * 訓練資料存在 localStorage，與這裡的快取無關，更新 App 不會影響資料。
 *
 * 下面兩個值在 `npm run build` 時由 vite.config.ts 填入，原始檔中只是預設值。
 */
const VERSION = 'dev';
const PRECACHE = /*__PRECACHE__*/ [];

const CACHE = `fitlog-${VERSION}`;
/**
 * 動作檢查的分析程式與模型（共約 23 MB）：用到時才下載，存在另一個快取，
 * 部署新版時不會被刪掉（網址含版本號，換版本就是新網址）
 */
const POSE_CACHE = 'pose-models-v1';
const isPoseAsset = (url) =>
  url.href.startsWith('https://storage.googleapis.com/mediapipe-models/') || url.pathname.includes('/mediapipe/');
/** 檔案網址都相對於 App 所在的路徑（GitHub Pages 是 /<repo名稱>/） */
const toUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 任何一個檔案下載失敗，這次安裝就算失敗，舊版會繼續運作，下次開啟再重試
      await cache.addAll(PRECACHE.map(toUrl));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('fitlog-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** 存入快取；用 waitUntil 讓瀏覽器等寫入完成才結束 Service Worker */
const putInCache = (event, request, response) => {
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isPoseAsset(url)) {
    event.respondWith(
      caches.open(POSE_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) event.waitUntil(cache.put(request, res.clone()));
        return res;
      }),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // 開啟頁面：網路優先（hash 路由不會送到伺服器，所有頁面都是同一個網址）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(event, request, res))
        .catch(async () => (await caches.match(request)) ?? (await caches.match(toUrl('./')))),
    );
    return;
  }

  // 打包後的檔案：快取優先
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((res) => putInCache(event, request, res))),
    );
    return;
  }

  // 其他（圖示、manifest）：網路優先，離線時用快取
  event.respondWith(
    fetch(request)
      .then((res) => putInCache(event, request, res))
      .catch(async () => (await caches.match(request)) ?? Response.error()),
  );
});
