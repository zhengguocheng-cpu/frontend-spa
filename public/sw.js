const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE_NAME = `ddz-spa-cache-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/imgs/loading.jpg',
  '/imgs/bk-2.jpg',
  '/imgs/dou-dizhu-avatar.png',
  '/imgs/card-quick-02.png',
  '/imgs/card-room.jpg',
  '/imgs/card-boom.jpg',
  '/imgs/avatars-sprite.png',
  '/imgs/coin.jpg',
  '/imgs/zuan0000.png',
  '/sounds/background.wav',
  '/sounds/jiaodizhu.mp3',
  '/sounds/zhadan.mp3',
  '/sounds/三带一.mp3',
  '/sounds/发牌.mp3',
  '/sounds/王炸.mp3',
  '/sounds/要不起.mp3',
  '/sounds/赢牌.mp3',
  '/sounds/输牌.mp3',
  '/sounds/飞机.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 仅拦截页面导航请求，资源请求仍走默认策略
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        return cached || Response.error();
      })
    );
    return;
  }

  const url = new URL(event.request.url);

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/imgs/') || url.pathname.startsWith('/sounds/'))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          return cached;
        }
        try {
          const response = await fetch(event.request);
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          return cached || Promise.reject(error);
        }
      })
    );
  }
});
