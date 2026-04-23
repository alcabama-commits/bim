self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([CACHE_NAME]);
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (keep.has(k) ? Promise.resolve() : caches.delete(k))));
      await self.clients.claim();
    })(),
  );
});

const CACHE_NAME = 'entregas-assets-v3';

const shouldHandle = (request) => {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return true;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!shouldHandle(request)) return;

  const url = new URL(request.url);
  const isAsset =
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest');

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, network.clone());
          return network;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('./index.html');
        }
      })(),
    );
    return;
  }

  if (isAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const network = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, network.clone());
        return network;
      })(),
    );
  }
});
