// Fase 4 · Item 20 — Modo offline + fila de sincronização.
// Cache-first para assets estáticos, network-first para navegação,
// e Background Sync para POSTs feitos sem rede (rituais/kudos/pulsos/etc).
const CACHE = "lidercore-v2";
const QUEUE_STORE = "lidercore-queue";
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
  if (req.method !== "GET") {
    // POST/PUT/PATCH/DELETE: se falhar por offline, enfileira e replaya depois.
    if (isMutation(req)) {
      event.respondWith(handleMutation(req.clone()));
    }
    return;
  }
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

function isMutation(req) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
}

async function handleMutation(req) {
  try {
    return await fetch(req);
  } catch {
    // Offline: serializa e guarda no IndexedDB.
    try {
      const body = await req.clone().text();
      const headers = {};
      req.headers.forEach((v, k) => (headers[k] = v));
      await enqueue({
        id: crypto.randomUUID(),
        url: req.url,
        method: req.method,
        headers,
        body,
        ts: Date.now(),
      });
      if ("sync" in self.registration) {
        try {
          await self.registration.sync.register("lidercore-flush");
        } catch (_e) {
          /* ignore */
        }
      }
      return new Response(
        JSON.stringify({ queued: true, offline: true }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    } catch {
      return Response.error();
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("lidercore-offline", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(QUEUE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function removeQueued(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const items = await listQueue();
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body || undefined,
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // sucesso ou erro cliente definitivo — remove
        await removeQueued(item.id);
      }
    } catch {
      // ainda offline, para o replay
      break;
    }
  }
  // Avisa a UI para revalidar dados
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  clientsList.forEach((c) => c.postMessage({ type: "lidercore-flushed" }));
}

self.addEventListener("sync", (event) => {
  if (event.tag === "lidercore-flush") event.waitUntil(flushQueue());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "lidercore-flush") event.waitUntil(flushQueue());
});