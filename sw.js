const CACHE_NAME = "ss-enterprises-abha-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./logo.png",
  "./manifest.json"
];

// Install Event: Pre-cache essential app assets
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event: Clean up old caches automatically
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log("Cleaning up old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Real-time Socket bypass + Offline support for static files
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Socket.IO aur backend API calls ko cache bypass karo taaki real-time data uninterrupted mile
  if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/health')) {
    return event.respondWith(fetch(event.request));
  }

  // Static Assets ke liye Cache First strategy
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        return networkResponse;
      }).catch(() => {
        // Network offline hone par index.html return karein
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
