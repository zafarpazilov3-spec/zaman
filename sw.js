// ZAMAN Service Worker - PWA Offline Support & Cache
const CACHE_NAME = 'zaman-pwa-v14';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './menu.html',
  './admin.html',
  './about.html',
  './qr.html',
  './css/style.css',
  './css/admin.css',
  './js/script.js',
  './js/admin.js',
  './data/menu.json',
  './data/config.json',
  './images/cover_poster.png?v=3',
  './images/cover_poster.png',
  './images/logo_emblem.png',
  './images/app_icon_192.png',
  './images/app_icon_512.png',
  './images/apple_touch_icon.png',
  './images/favicon.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('PWA Precache notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass cache for non-GET requests (e.g. POST /api/menu)
  if (req.method !== 'GET') {
    return;
  }

  // 1. Direct Network for API endpoints
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // 2. Network-First for HTML pages, Scripts, Styles and JSON
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
  const isCodeOrData = url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json');

  if (isHtml || isCodeOrData) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then(cached => {
            if (cached) return cached;
            if (isHtml) return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 3. Cache-First for images and media assets
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return networkRes;
      });
    })
  );
});
