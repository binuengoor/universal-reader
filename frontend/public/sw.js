const CACHE_NAME = 'universal-reader-cache-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network first for all API and audio calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML / Navigation requests: STRICT NETWORK-FIRST (prevents stale app bundles)
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const responseToScan = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            responseToScan.text().then(pruneStaleAssets).catch(() => {});
          }
          return networkResponse;
        })
        // caches.match() returns a Promise (always truthy), so chain explicitly
        .catch(async () => (await caches.match(event.request)) || (await caches.match('/index.html')) || Response.error())
    );
    return;
  }

  // Stale-while-revalidate for hashed static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Hashed /assets/* files from previous builds are never requested again; prune the
// ones the freshly fetched index.html no longer references so the cache stays bounded.
async function pruneStaleAssets(html) {
  const cache = await caches.open(CACHE_NAME);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/assets/') && !html.includes(path)) {
      await cache.delete(request);
    }
  }
}
