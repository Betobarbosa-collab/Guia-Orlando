#!/usr/bin/env python3
"""Monta o index.html ÚNICO (estilo, lógica, mapa, fontes e dados embutidos) e o sw.js.
Uso: python tools/build_site.py
Entradas: src/index.template.html, assets/app.css, assets/app.js, assets/vendor/leaflet/*, assets/fonts/*, data/*.json
Saídas:   index.html, sw.js  (os únicos arquivos que o celular baixa, além do manifest e dos ícones)"""
import base64, hashlib, json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "assets"; DATA = ROOT / "data"
files = ["config", "descontos", "lojas", "lugares", "dicas", "pontos", "frases", "tamanhos", "pedidos"]
data = {f: json.loads((DATA / f"{f}.json").read_text(encoding="utf-8")) for f in files}
data_js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").replace("<!--", "<\\!--")
css = (A / "vendor/leaflet/leaflet.css").read_text(encoding="utf-8") + "\n" + (A / "app.css").read_text(encoding="utf-8")
def font_uri(m):
    f = A / "fonts" / m.group(1)
    return 'url("data:font/woff2;base64,' + base64.b64encode(f.read_bytes()).decode() + '")'
css = re.sub(r'url\("fonts/([^"]+)"\)', font_uri, css)
js = (A / "vendor/leaflet/leaflet.js").read_text(encoding="utf-8") + "\n" + (A / "app.js").read_text(encoding="utf-8")
assert "</script" not in js.lower(), "o JS não pode conter </script"
h = lambda t: "'sha256-" + base64.b64encode(hashlib.sha256(t.encode("utf-8")).digest()).decode() + "'"
tpl = (ROOT / "src/index.template.html").read_text(encoding="utf-8")
html = tpl.replace("{{CSS}}", css).replace("{{DATA}}", data_js).replace("{{JS}}", js).replace("{{CSP_SCRIPT}}", h(js)).replace("{{CSP_STYLE}}", h(css))
(ROOT / "index.html").write_text(html, encoding="utf-8")
ver = hashlib.sha256(html.encode("utf-8")).hexdigest()[:10]
sw = rf'''/* Service worker gerado por tools/build_site.py — não edite à mão.
   O app é um arquivo só (index.html). Com internet, pega sempre a versão nova; sem internet, usa a guardada. */
const CACHE = "guia-{ver}";
const SHELL = ["./", "index.html", "manifest.webmanifest", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-512-maskable.png", "assets/icons/apple-touch-icon.png", "assets/icons/favicon.svg"];
self.addEventListener("install", e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); }});
const IMG = "guia-img"; // fotos dos pedidos: ficam guardadas entre versões
self.addEventListener("activate", e => {{ e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener("fetch", e => {{
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {{
    if (req.destination === "image" || url.pathname.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i)) {{
      e.respondWith(caches.open(IMG).then(c => c.match(req, {{ ignoreVary: true }}).then(hit => hit || fetch(req).then(r => {{ if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }}))));
    }}
    return;
  }}
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if (isPage) {{
    e.respondWith(fetch(req).then(r => {{ if (r.ok) caches.open(CACHE).then(c => c.put("index.html", r.clone())); return r; }}).catch(() => caches.match("index.html")));
    return;
  }}
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req).then(r => {{ if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }})));
}});
'''
(ROOT / "sw.js").write_text(sw, encoding="utf-8")
print(f"OK: index.html {len(html)//1024} KB · sw.js guia-{ver}")
