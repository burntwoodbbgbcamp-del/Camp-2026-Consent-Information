// Bump this version string whenever you change index.html / app.js / styles.css
// so phones pick up the new app shell instead of an old cached copy.
const CACHE_NAME = 'camp-consent-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// App shell = cache-first (fast, works offline).
// Any request to dropbox (the data source) is NEVER cached here on purpose —
// that data is fetched and stored by app.js itself in localStorage instead,
// so the app always tries to get the freshest data when there's a signal.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isDataRequest = url.hostname.includes('dropbox');

  if (isDataRequest) return; // let app.js handle this directly

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
          .catch(() => caches.match('./index.html'))
      );
    })
  );
});
