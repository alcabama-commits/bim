const SHELL_CACHE = 'cantidades-shell-v1';
const RUNTIME_CACHE = 'cantidades-runtime-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('cantidades-shell-') || key.startsWith('cantidades-runtime-'))
        .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const shouldHandle = (request) => request.method === 'GET' && (
  request.mode === 'navigate' ||
  request.url.startsWith(self.location.origin)
);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return;

  event.respondWith((async () => {
    const cacheName = request.mode === 'navigate' ? SHELL_CACHE : RUNTIME_CACHE;

    try {
      const networkResponse = await fetch(request, { cache: 'no-store' });
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone()).catch(() => {});
      return networkResponse;
    } catch {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;

      if (request.mode === 'navigate') {
        const shellCache = await caches.open(SHELL_CACHE);
        const fallback = await shellCache.match('./index.html');
        if (fallback) return fallback;
      }

      throw new Error('Resource unavailable');
    }
  })());
});
