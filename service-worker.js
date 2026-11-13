const CACHE_NAME = "orbomix-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/orbomix-192.png",
  "./icons/orbomix-512.png"
];

// Install and cache the basic app files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// Remove old versions of the app cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("orbomix-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Load pages and files from the network or saved cache
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            const pageURL = new URL("./index.html", self.registration.scope).href;

            caches.open(CACHE_NAME)
              .then((cache) => cache.put(pageURL, copy));
          }

          return response;
        })
        .catch(async () => {
          const pageURL = new URL("./index.html", self.registration.scope).href;
          return (await caches.match(pageURL)) || Response.error();
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});