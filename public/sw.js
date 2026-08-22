/** Switch It conservative PWA service worker — offline fallback only. */

/** Bump when branding PNGs change — launch splash parity uses shared native composites. */
const CACHE_VERSION = "switch-it-pwa-v8";

/** Narrow allowlist — no authenticated or third-party resources. */
const PRECACHE_URLS = [
  "/offline",
  "/branding/switch-it-logo.png",
  "/branding/switch-it-logo-launch.png",
  "/apple-touch-icon.png",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("switch-it-pwa-") && key !== CACHE_VERSION,
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isPrecacheCandidate(pathname) {
  return (
    pathname === "/offline" ||
    pathname === "/branding/switch-it-logo.png" ||
    pathname === "/branding/switch-it-logo-launch.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/pwa/icon-192.png" ||
    pathname === "/pwa/icon-512.png" ||
    pathname === "/pwa/icon-maskable-512.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline");
        if (offline) {
          return offline;
        }
        return Response.error();
      }),
    );
    return;
  }

  if (request.destination === "document") {
    return;
  }

  if (isPrecacheCandidate(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }
});
