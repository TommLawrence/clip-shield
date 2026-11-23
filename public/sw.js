/**
 * ClipShield service worker — application-shell caching only.
 *
 * Privacy contract: cache STATIC, SAME-ORIGIN application resources only.
 * Never cached (and never intercepted):
 *   - /api/* server routes
 *   - cross-origin requests (Firebase AI Logic, App Check, identity, Google APIs)
 *   - non-GET requests
 * The workspace keeps original documents, sanitized content and the
 * rehydration vault in memory (never as fetchable URLs), so they cannot be
 * cached regardless. Cached shell availability is distinct from inference
 * availability — inference still needs the network and is never cached.
 */
const CACHE = "clipshield-shell-v1";
const PRECACHE = ["/manifest.webmanifest", "/icons/shield.svg", "/icons/shield-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch API routes, the service worker itself, or anything
  // cross-origin (Firebase / Google AI / App Check / analytics).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  // Navigations: network-first with a cached app-shell fallback so the
  // interface can open offline. Only the HTML shell is cached here.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put("/", fresh.clone()).catch(() => undefined);
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match("/")) ||
            (await cache.match("/index.html")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Static same-origin assets (JS/CSS/fonts/icons): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

// Sensible update handling: an updated worker activates immediately so the
// next navigation picks it up; the page reloads once the new controller takes
// over.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
