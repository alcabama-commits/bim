const CACHE_PREFIX = 'status-cache-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

const isCacheableRequest = (req) => {
  if (req.method !== 'GET') return false;
  if (req.headers.get('range')) return false;
  return true;
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg']);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (type === 'CLEAR_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)));
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isCacheableRequest(req)) return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = req.mode === 'navigate';
  const ext = url.pathname.split('.').pop()?.toLowerCase() ?? '';
  const isAsset = isSameOrigin && ['js', 'css', 'mjs', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'wasm'].includes(ext);
  const isJson = ['json', 'webmanifest'].includes(ext);

  if (isNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const res = await fetch(req);
        cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch {
        const cached = (await cache.match(req)) || (await cache.match('./')) || (await cache.match('./index.html'));
        if (cached) return cached;
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  if (isAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    if (isJson) {
      try {
        const res = await fetch(req);
        cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    }

    const fetchPromise = fetch(req)
      .then((res) => {
        cache.put(req, res.clone()).catch(() => {});
        return res;
      })
      .catch(() => null);

    return cached || (await fetchPromise) || new Response('', { status: 504 });
  })());
});
