/**
 * Service worker de Nemo.
 * - El "cascarón" (HTML, manifest, íconos) se cachea para que la app abra
 *   rápido y funcione (con el último dato conocido) incluso sin conexión.
 * - data/stocks.json SIEMPRE se intenta traer fresco de la red primero,
 *   porque ahí vive el precio/score del día — solo se usa la copia en
 *   caché si no hay conexión.
 * - Sube la versión del nombre del caché (ej: v2, v3) cada vez que cambies
 *   este archivo o la lista de SHELL_FILES, para que los usuarios reciban
 *   la versión nueva en vez de quedarse con la vieja cacheada.
 */
const CACHE_NAME = "nemo-shell-v1";
const SHELL_FILES = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Solo interceptamos pedidos al propio sitio (mismo origen). Todo lo demás
  // (Google Fonts, etc.) pasa directo a la red sin pasar por el caché.
  if (url.origin !== self.location.origin) return;

  // data/stocks.json: red primero, caché como respaldo si no hay conexión.
  if (url.pathname.endsWith("/data/stocks.json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Resto del cascarón: caché primero (rápido), actualizando en segundo
  // plano para la próxima vez.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
