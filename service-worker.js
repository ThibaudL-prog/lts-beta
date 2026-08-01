const CACHE_PREFIX = 'lts-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v0.5.8.13`;
const APP_SHELL = [
  './',
  './index.html',
  './api-client.js?v=05813',
  './manifest.webmanifest?v=05813',
  './favicon.ico?v=05813',
  './icons/lts-favicon-32-v05810.png',
  './icons/lts-favicon-96-v05810.png',
  './icons/lts-icon-192-v05810.png',
  './icons/lts-icon-512-v05810.png',
  './icons/lts-maskable-512-v05810.png',
  './icons/lts-touch-180-v05810.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/api-client.js') ||
      url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname === '/favicon.ico' || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
