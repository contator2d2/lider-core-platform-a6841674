// Fase 4 · Item 20 — Modo offline mínimo.
// Cache-first para assets estáticos, network-first para o resto.
const CACHE = "lidercore-v1";
const ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Nunca cachear API nem endpoints autenticados
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/organization/")) return;

  const isAsset = /\.(js|css|woff2?|png|jpg|svg|ico|webp|webmanifest)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const resp = await fetch(req);
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch {
          return hit ?? Response.error();
        }
      }),
    );
    return;
  }

  // HTML: network-first com fallback pro cache
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy).catch(() => undefined));
        return resp;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match("/"))),
  );
});