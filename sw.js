const CACHE_NAME = "ss-enterprises-abha-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./logo.png",
  "./manifest.json"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Never cache backend API data.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/health")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Do not cache POST/PUT/DELETE etc.
  if (event.request.method !== "GET") return;

  // For page navigation always prefer the latest index.html.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
