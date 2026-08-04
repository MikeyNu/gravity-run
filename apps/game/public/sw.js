/**
 * Gravity Run Service Worker — versioned offline-first caching.
 *
 * Cache tiers:
 *   SHELL_CACHE  — HTML shell and app entry chunks (updated on each deploy)
 *   STATIC_CACHE — Assets with content-hash URLs (immutable, Cache-First)
 *   MEDIA_CACHE  — Audio / large assets (CacheFirst, deferred)
 *
 * Version is embedded at build time via the sw-version.json file; during
 * dev the CACHE_VERSION defaults to 'dev'.
 */

const CACHE_VERSION = self.__CACHE_VERSION ?? 'dev';
const SHELL_CACHE = `gr-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `gr-static-${CACHE_VERSION}`;
const MEDIA_CACHE = `gr-media-${CACHE_VERSION}`;

const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE];

// Static assets that should be precached on install (non-hashed filenames)
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/brand/gravity-run-logo.svg',
  '/brand/gravity-run-mark.svg',
  '/ui/icons/gravity-ui-icons.svg',
  '/ui/characters/gravity-characters.svg',
  '/ui/flow/gravity-flow-cards.svg',
];

// Audio and large assets cached on first use (deferred tier)
const MEDIA_URL_PATTERNS = [
  /^\/assets\/audio\//,
  /^\/assets\/models\//,
  /^\/assets\/textures\//,
];

// Content-hashed Vite output (Cache-First, immutable)
const HASHED_PATTERN = /\/assets\/[^/]+-[a-f0-9]{8,}\.(js|css|wasm|glb|ktx2)(\?.*)?$/;

// ── Lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((error) => {
        console.warn('[sw] Precache partial failure — continuing offline-capable install.', error);
      }),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ── Fetch strategy ─────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // only cache safe reads

  const url = new URL(request.url);

  // API calls — Network-First, no caching
  if (url.hostname !== self.location.hostname) return;

  const pathname = url.pathname;

  // Content-hashed assets → Cache-First (immutable)
  if (HASHED_PATTERN.test(pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Media (audio, models, textures) → Cache-First, populate lazily
  if (MEDIA_URL_PATTERNS.some((p) => p.test(pathname))) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // Precached static SVG / webmanifest → Stale-While-Revalidate
  if (pathname.endsWith('.svg') || pathname.endsWith('.webmanifest') || pathname.endsWith('.png')) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // HTML shell → Network-First with fallback to cached shell
  if (request.headers.get('accept')?.includes('text/html') || pathname === '/') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
});

// ── Cache strategies ───────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached ?? fetchPromise;
}

// ── Message API — triggered by the app to prime media caches ──────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_MEDIA') {
    const urls = event.data.urls;
    if (!Array.isArray(urls)) return;
    event.waitUntil(
      caches.open(MEDIA_CACHE).then((cache) =>
        Promise.allSettled(urls.map((url) => cache.add(url))),
      ),
    );
  }
});
