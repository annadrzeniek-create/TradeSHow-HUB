// Service Worker for Faire BP PWA
// Strategy: cache-first for shell, network-first for API calls

const CACHE_NAME = "faire-bp-v1";
const CORE_FILES = [
  "tradeshow1.html",
  "manifest.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

// Install: pre-cache the app shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_FILES).catch(err => {
        console.warn("Some files failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - For Anthropic API calls: always go to network (don't cache AI responses)
// - For everything else: cache-first, fall back to network
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Don't intercept non-GET or cross-origin API calls
  if (event.request.method !== "GET" || url.hostname.includes("anthropic.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Refresh in background
        fetch(event.request).then(fresh => {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, fresh.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Offline + not cached: return a minimal fallback for HTML requests
        if (event.request.mode === "navigate") {
          return caches.match("tradeshow1.html");
        }
      });
    })
  );
});
