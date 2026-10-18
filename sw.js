/* Service worker gerado por tools/build_site.py — não edite à mão.
   O app é um arquivo só (index.html). Com internet, pega sempre a versão nova; sem internet, usa a guardada. */
const CACHE = "guia-52746cfcf5";
const SHELL = ["./", "index.html", "manifest.webmanifest", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-512-maskable.png", "assets/icons/apple-touch-icon.png", "assets/icons/favicon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
const IMG = "guia-img"; // fotos dos pedidos: ficam guardadas entre versões
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (req.destination === "image" || url.pathname.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i)) {
      e.respondWith(caches.open(IMG).then(c => c.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }))));
    }
    return;
  }
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if (isPage) {
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put("index.html", r.clone())); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone())); return r; })));
});
