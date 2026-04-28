const VERSION = 'v1';
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname.replace(/\/+$/, '') || '/';
const SCOPE_KEY = (SCOPE_PATH === '/' ? 'root' : SCOPE_PATH)
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const SHELL_CACHE = `offline-shell-${SCOPE_KEY}-${VERSION}`;
const RUNTIME_CACHE = `offline-runtime-${SCOPE_KEY}-${VERSION}`;
const CACHE_PREFIX = 'offline-';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const ASSET_EXTENSIONS = new Set([
  'js',
  'mjs',
  'css',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'wasm',
  'json',
  'webmanifest',
]);

const isCacheableRequest = (request) => request.method === 'GET' && !request.headers.get('range');

const isSameScope = (requestUrl) => {
  if (requestUrl.origin !== self.location.origin) return false;
  if (SCOPE_PATH === '/') return true;
  return requestUrl.pathname.startsWith(`${SCOPE_PATH}/`) || requestUrl.pathname === SCOPE_PATH;
};

const cachePutSafe = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === 'error') return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
  if (type === 'CLEAR_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;
  const requestUrl = new URL(request.url);
  if (!isSameScope(requestUrl)) return;

  const extension = requestUrl.pathname.split('.').pop()?.toLowerCase() ?? '';
  const isNavigation = request.mode === 'navigate';
  const isStaticAsset = ASSET_EXTENSIONS.has(extension);

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const network = await fetch(request, { cache: 'no-store' });
        await cachePutSafe(SHELL_CACHE, request, network);
        return network;
      } catch {
        return (await caches.match(request)) || (await caches.match('./index.html')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  if (isStaticAsset) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const networkPromise = fetch(request, { cache: 'no-store' })
        .then(async (response) => {
          await cachePutSafe(RUNTIME_CACHE, request, response);
          return response;
        })
        .catch(() => null);
      return cached || (await networkPromise) || new Response('', { status: 504 });
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const network = await fetch(request, { cache: 'no-store' });
      await cachePutSafe(RUNTIME_CACHE, request, network);
      return network;
    } catch {
      return (await caches.match(request)) || new Response('', { status: 504 });
    }
  })());
});
