/*
 * Service Worker：讓 App 在沒有網路時也能開啟（健身房常常收訊不好）
 * - 頁面本身：先抓網路上的新版，失敗才用快取
 * - /assets/ 下的檔案：檔名含雜湊值、內容不會變，直接用快取
 * 訓練資料存在 localStorage，與這裡的快取無關，更新 App 不會影響資料。
 */
const CACHE = 'fitlog-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const putInCache = (request, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 開啟頁面：網路優先
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(request, res))
        .catch(async () => (await caches.match(request)) ?? (await caches.match(self.registration.scope))),
    );
    return;
  }

  // 打包後的檔案：快取優先
  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((res) => putInCache(request, res))));
    return;
  }

  // 其他（圖示、manifest）：網路優先，離線時用快取
  event.respondWith(fetch(request).then((res) => putInCache(request, res)).catch(() => caches.match(request)));
});
