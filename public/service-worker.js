const SHELL_CACHE = 'hcn-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/brand/higher-conscious-network-icon.svg',
  '/brand/higher-conscious-network-icon-192.png',
  '/brand/higher-conscious-network-icon-512.png',
];

const DYNAMIC_PREFIXES = [
  '/api/',
  '/uploads/',
  '/health',
];

const SENSITIVE_NAV_PREFIXES = [
  '/admin',
  '/administrative',
  '/provider',
  '/conscious-meetings',
  '/meetings',
  '/membership',
  '/reset-password',
  '/verify-email',
  '/verify-session',
];

const isSameOrigin = (url) => url.origin === self.location.origin;

const isDynamicRequest = (url) =>
  DYNAMIC_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix));

const isSensitiveNavigation = (url) =>
  SENSITIVE_NAV_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== SHELL_CACHE).map((cacheName) => caches.delete(cacheName)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || isDynamicRequest(url)) return;

  if (request.mode === 'navigate') {
    if (isSensitiveNavigation(url)) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/', responseClone));
          }
          return response;
        })
        .catch(async () => (await caches.match('/')) || caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});
