/*
 * Nitro service worker.
 *
 * Scope is deliberately tiny: it exists to stop an installed app looking broken
 * when the phone loses signal. The manifest's start_url is /dashboard, so
 * opening the installed app offline used to hand the customer the browser's own
 * error page inside a standalone window with no address bar — which reads as
 * "Nitro is broken", not "you have no signal".
 *
 * It caches exactly one thing: the offline page. It never caches an API
 * response, a page of real data, or anything a balance could be read from.
 * That is the whole design. On a panel where people hold money, a cached number
 * is indistinguishable from a live one, and a balance that is quietly an hour
 * old is worse than no balance at all — so the offline screen shows no figures
 * and this worker never puts itself between the app and its data.
 *
 * Bump CACHE whenever offline.html changes: the browser only reinstalls the
 * worker when this file's bytes change, so editing the HTML alone would leave
 * the old copy cached on every device that already has it.
 */

const CACHE = 'nitro-shell-v3';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: 'reload' so a reinstall cannot pick the stale copy back out of
      // the HTTP cache, which would defeat the version bump above.
      .then((cache) => cache.add(new Request(OFFLINE, { cache: 'reload' })))
      .then(() => self.skipWaiting())
      // A failed precache must not block activation — better a worker with no
      // offline page than a install loop that also breaks the install prompt.
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only whole-page navigations. Everything else — API calls, POSTs, scripts,
  // images — goes straight to the network untouched, so no request that could
  // carry money or account state is ever answered from this cache.
  if (req.method !== 'GET' || req.mode !== 'navigate') return;

  event.respondWith(
    // Network first, always. A real response wins even when it is an error
    // page: a 500 from Nitro is the truth and belongs on screen, and only a
    // genuine network failure should reach the offline screen.
    fetch(req).catch(() =>
      caches.match(OFFLINE, { cacheName: CACHE }).then(
        (cached) =>
          cached ||
          new Response('<h1>You are offline</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
      )
    )
  );
});
