// Deferred media assets to warm up after the game loads
const DEFERRED_MEDIA_URLS = [
  '/assets/audio/ambience-loop.ogg',
  '/assets/audio/tether-attach.wav',
  '/assets/audio/tether-loop.wav',
  '/assets/audio/release-good.wav',
  '/assets/audio/release-perfect.wav',
  '/assets/audio/fragment.wav',
  '/assets/audio/near-miss.wav',
  '/assets/audio/failure.wav',
  '/assets/audio/music/layer-calm-1.ogg',
  '/assets/audio/music/layer-calm-2.ogg',
  '/assets/audio/music/layer-active-1.ogg',
  '/assets/audio/music/layer-active-2.ogg',
  '/assets/audio/music/layer-intense-1.ogg',
  '/assets/audio/music/layer-intense-2.ogg',
];

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[sw] Registered — scope:', registration.scope);

        // When a new SW takes control, prime media caches in the background
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              primeMediaCache(newWorker);
            }
          });
        });

        // Prime caches with the active worker if already installed
        if (registration.active) {
          // Delay so the game loop gets priority
          setTimeout(() => primeMediaCache(registration.active!), 8000);
        }
      })
      .catch((error: unknown) => {
        console.warn('[sw] Registration failed:', error);
      });
  });
}

function primeMediaCache(worker: ServiceWorker): void {
  worker.postMessage({ type: 'CACHE_MEDIA', urls: DEFERRED_MEDIA_URLS });
}
