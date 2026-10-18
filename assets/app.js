/* Guia de Viagem — app.js
   Regras de segurança adotadas neste arquivo:
   - Nenhum innerHTML com dados; tudo é construído via DOM (h()).
   - Texto curado aceita só **negrito** e _itálico_ (rich()); nunca HTML.
   - Links externos só http(s) (safeUrl) e sempre rel="noopener noreferrer".
   - Dados importados (texto colado) passam por validação de esquema e limites.
   - Fotos só data:image/* e com tamanho máximo. */
(() => {
"use strict";

/* ---------------- helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const DIAS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const DIAS_C = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.appendChild(rich(v));
    else if (k === "onClick") el.addEventListener("click", v);
    else if (k === "onInput") el.addEventListener("input", v);
    else if (k === "onChange") el.addEventListener("change", v);
    else if (k === "href") { const u = safeUrl(v); if (u) { el.setAttribute("href", u); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); } }
    else if (k === "src") { const u = safeImg(v); if (u) el.setAttribute("src", u); }
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return el;
}
function icon(name, cls) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "ic" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true"); s.setAttribute("width", "22"); s.setAttribute("height", "22"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.9"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#i-" + name); s.appendChild(u); return s; }
function rich(text) {
  // **negrito**, _itálico_, quebras de linha → nós de DOM, sem HTML
  const frag = document.createDocumentFragment();
  const lines = String(text ?? "").split("\n");
  lines.forEach((line, li) => {
    if (li) frag.appendChild(document.createElement("br"));
    const re = /(\*\*[^*]+\*\*|_[^_]+_)/g; let last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) frag.appendChild(document.createTextNode(line.slice(last, m.index)));
      const tok = m[0];
      if (tok.startsWith("**")) frag.appendChild(h("b", { text: tok.slice(2, -2) }));
      else frag.appendChild(h("i", { text: tok.slice(1, -1) }));
      last = m.index + tok.length;
    }
    if (last < line.length) frag.appendChild(document.createTextNode(line.slice(last)));
  });
  return frag;
}
function safeUrl(u) { if (!u || !String(u).trim()) return null; try { const x = new URL(String(u), location.href); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : null; } catch { return null; } }
function safeImg(u) { return (typeof u === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 300000) ? u : null; }
function str(v, max = 300) { return String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
function coord(v, lim) { const n = parseFloat(v); return Number.isFinite(n) && Math.abs(n) <= lim ? n : null; }
function num(v) { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n >= 0 && n < 1e7 ? n : 0; }
function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
function uid() { return "l_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function money(n) { return "US$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function brl(n) { return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function mapsSearch(q) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q); }
function mapsDir(dest, origin, waypoints) {
  let u = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(dest);
  if (origin) u += "&origin=" + encodeURIComponent(origin);
  if (waypoints && waypoints.length) u += "&waypoints=" + encodeURIComponent(waypoints.join("|"));
  return u;
}
function kmBetween(a, b, c, d) { const R = 6371, dLa = (c - a) * Math.PI / 180, dLo = (d - b) * Math.PI / 180; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
let toastT; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400); }

/* ---------------- estado local ---------------- */
const KEY = "guia.v2";
const state = { name: "", home: "", homeLat: null, homeLng: null, rate: 0, rateAuto: 0, rateAt: 0, rateManual: false, pos: null, tax: 0.07, theme: "auto", region: "", plan: [], people: [], items: [], done: {}, wx: null };
function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return;
    const o = JSON.parse(raw); if (!o || typeof o !== "object") return;
    state.name = str(o.name, 40); state.home = str(o.home, 160); state.rate = num(o.rate); state.rateAuto = num(o.rateAuto); state.rateAt = num(o.rateAt); state.rateManual = o.rateManual === true;
    state.homeLat = coord(o.homeLat, 90); state.homeLng = coord(o.homeLng, 180); state.wx = (o.wx && typeof o.wx === "object") ? o.wx : null; state.pos = (o.pos && coord(o.pos.la, 90) != null && coord(o.pos.lo, 180) != null) ? { la: o.pos.la, lo: o.pos.lo, at: num(o.pos.at) } : null; state.tax = [0.065, 0.07, 0.075].includes(o.tax) ? o.tax : 0.07;
    state.theme = ["auto", "light", "dark"].includes(o.theme) ? o.theme : "auto"; state.region = str(o.region, 10);
    state.plan = cleanPlan(o.plan); state.people = cleanPeople(o.people); state.items = cleanItems(o.items);
    state.done = {}; if (o.done && typeof o.done === "object") for (const k of Object.keys(o.done).slice(0, 2000)) if (o.done[k] === true) state.done[str(k, 60)] = true;
  } catch { /* dados corrompidos: começa do zero */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("Não consegui salvar (memória cheia?)"); } }
function cleanPlan(a) { return Array.isArray(a) ? a.slice(0, 30).map(s => ({ id: str(s.id, 80), n: str(s.n, 120), a: str(s.a, 200) })).filter(s => s.id && s.n) : []; }
function cleanPeople(a) { return Array.isArray(a) ? a.slice(0, 50).map(p => ({ id: str(p.id, 40), nome: str(p.nome, 60), tam: str(p.tam, 500) })).filter(p => p.id && p.nome) : []; }
function cleanItems(a) {
  return Array.isArray(a) ? a.slice(0, 500).map(i => ({ id: str(i.id, 40), pessoa: str(i.pessoa, 40), nome: str(i.nome, 120), loja: str(i.loja, 80), cor: str(i.cor, 40), tam: str(i.tam, 40), preco: num(i.preco), link: safeUrl(i.link) || "", obs: str(i.obs, 300), onde: str(i.onde, 160), fotoUrl: safeUrl(i.fotoUrl) || "", foto: safeImg(i.foto) || "" })).filter(i => i.id && i.nome) : [];
}
function applyTheme() { const r = document.documentElement; if (state.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", state.theme); }

/* ---------------- dados curados (data/*.json) ---------------- */
const D = {};
async function loadData() {
  const files = ["config", "descontos", "lojas", "lugares", "dicas", "pontos", "frases", "tamanhos", "pedidos"];
  const emb = document.getElementById("data-embed");
  if (emb) { const all = JSON.parse(emb.textContent); files.forEach(f => { if (!all[f]) throw new Error(f); D[f] = all[f]; }); return; }
  const res = await Promise.all(files.map(f => fetch("data/" + f + ".json", { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(f); return r.json(); })));
  files.forEach((f, i) => D[f] = res[i]);
}

/* ---------------- navegação ---------------- */
let currentView = "hoje";
function go(view, push = true) {
  if (!$("#view-" + view)) view = "hoje";
  currentView = view;
  $$(".view").forEach(v => v.classList.toggle("active", v.dataset.view === view));
  $$("#nav button").forEach(b => b.classList.toggle("on", b.dataset.go === view));
  if (view === "perto" && D.pontos) renderPerto();
  if (view === "hoje" && D.pontos) { renderHoje(); autoGeoHoje(); }
  if (push && location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  window.scrollTo({ top: 0 });
}
$("#nav").addEventListener("click", e => { const b = e.target.closest("button[data-go]"); if (b) go(b.dataset.go); });
window.addEventListener("hashchange", () => go(location.hash.replace("#", "") || "hoje", false));
window.addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", window.scrollY > 8), { passive: true });

/* ---------------- bottom sheet ---------------- */
const scrim = $("#scrim"), sheet = $("#sheet");
function openSheet(...nodes) { sheet.replaceChildren(h("div", { class: "handle" }), ...nodes.flat()); scrim.classList.add("open"); sheet.scrollTop = 0; document.body.style.overflow = "hidden"; }
function closeSheet() { scrim.classList.remove("open"); document.body.style.overflow = ""; }
scrim.addEventListener("click", e => { if (e.target === scrim) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && scrim.classList.contains("open")) closeSheet(); });
const closeBtn = () => h("button", { class: "btn block", onClick: closeSheet }, "Fechar");
function sheetBig(text) { openSheet(h("div", { class: "bigtext", text }), closeBtn()); }

/* ---------------- HOJE ---------------- */
function seniorToday(d) { return D.descontos.senior.filter(s => s.dia === d.getDay() && (!s.first || d.getDate() <= 7)); }
function nextFirstTuesday(from) { const t0 = new Date(from.getFullYear(), from.getMonth(), from.getDate()); for (let i = 0; i < 3; i++) { const x = new Date(from.getFullYear(), from.getMonth() + i, 1); while (x.getDay() !== 2) x.setDate(x.getDate() + 1); if (x >= t0) return x; } return null; }
function renderHoje() {
  const now = new Date(), hr = now.getHours();
  const greet = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  const v = $("#view-hoje"); v.replaceChildren();
  v.appendChild(h("div", { class: "hero" },
    h("div", { class: "date", text: cap(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })) }),
    h("h1", { text: greet + (state.name ? ", " + state.name : "") })));
  // chips do dia
  const chips = h("div", { class: "chips" });
  const today = seniorToday(now);
  today.forEach(s => chips.appendChild(h("button", { class: "chip sun", onClick: () => sheetSenior(s) }, icon("tag"), s.loja + " " + s.desc + " hoje")));
  if (!today.length) chips.appendChild(h("span", { class: "chip ghost" }, "Sem desconto por idade hoje — bom dia para outlets"));
  const wc = weatherChip(); if (wc) chips.appendChild(wc);
  const np = pendentes(allItems()).length; if (np) chips.appendChild(h("button", { class: "chip ok", onClick: () => go("lista") }, icon("list"), np + " pedidos em aberto"));
  const nft = nextFirstTuesday(now); if (nft && !(now.getDay() === 2 && now.getDate() <= 7)) chips.appendChild(h("span", { class: "chip ghost" }, "Walgreens 20%: " + nft.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })));
  v.appendChild(chips);
  // parques
  const pw = D.descontos.parques_semana[String(now.getDay())];
  if (pw) {
    const names = ["Magic Kingdom", "EPCOT", "Animal Kingdom", "Hollywood Studios"];
    const cls = { "🟢": "g", "🔵": "b", "🟡": "y", "🔴": "r" };
    const pc = h("div", { class: "chips" });
    names.forEach((n, i) => pc.appendChild(h("button", { class: "chip", onClick: sheetParksWeek }, h("i", { class: "dot " + (cls[pw[i]] || "y") }), n)));
    v.appendChild(h("p", { class: "small muted", text: "Parques Disney hoje (toque para ver a semana):" }));
    v.appendChild(pc);
  }
  // ações
  v.appendChild(h("div", { class: "actions" },
    h("button", { class: "action primary", onClick: sheetPhrases }, h("span", { class: "ico" }, icon("chat")), h("b", {}, "Frases para o caixa"), h("span", {}, "Inglês em letras grandes")),
    h("button", { class: "action", onClick: () => go("perto") }, h("span", { class: "ico" }, icon("pin")), h("b", {}, "O que tem perto"), h("span", {}, "Por região ou GPS")),
    h("button", { class: "action", onClick: sheetConverter }, h("span", { class: "ico" }, icon("dollar")), h("b", {}, "Conversor"), h("span", {}, "Com imposto, em reais")),
    h("button", { class: "action", onClick: () => state.home ? sheetBig(state.home) : sheetSettings() }, h("span", { class: "ico" }, icon("home")), h("b", {}, "Meu endereço"), h("span", {}, state.home ? "Mostrar ao motorista" : "Toque para cadastrar"))));
  // perto de você agora (GPS) — ou da casa/região
  const gps = state.pos && Date.now() - state.pos.at < 30 * 60e3 ? state.pos : null;
  const origin = gps ? { la: gps.la, lo: gps.lo, n: nearestPlaceName(gps.la, gps.lo) || (nearestRegion(gps.la, gps.lo) || {}).n || "você", gps: true } : originPoint();
  if (origin) {
    const near = D.pontos.pontos.map(p => Object.assign({}, p, { km: kmBetween(origin.la, origin.lo, p.la, p.lo) })).filter(p => p.km <= (origin.gps ? 8 : 15) && p.c !== "train").sort((a, b) => a.km - b.km);
    const open = near.filter(p => p.c !== "park" && (openStatus(p) || {}).open).sort((a, b) => (b.r || 0) - (a.r || 0) || a.km - b.km).slice(0, 4);
    const show = open.length ? open : near.slice(0, 4);
    v.appendChild(h("h3", { text: origin.gps ? "Perto de você agora · " + origin.n : "Perto de " + origin.n }));
    const list = h("div", { class: "list nowbox" });
    if (!origin.gps) list.appendChild(h("button", { class: "row", onClick: useGeoHoje }, h("span", { class: "ico" }, icon("nav")), h("span", { class: "t" }, h("b", { text: "Usar onde estou agora" }), h("span", { text: "Mostra o que tem perto de você pelo GPS" })), icon("chev", "chev")));
    show.forEach(p => { const st = openStatus(p); list.appendChild(h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon(p.c === "park" ? "park" : p.c === "comida" ? "fork" : "bag")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { class: st && !st.open ? "closed" : "", text: [ratingText(p), st ? st.txt : ""].filter(Boolean).join(" · ") || p.a })), h("span", { class: "km", text: p.km.toFixed(1).replace(".", ",") + " km" }), icon("chev", "chev"))); });
    list.appendChild(h("button", { class: "row", onClick: () => { if (origin.gps) here = { la: origin.la, lo: origin.lo, label: "onde você está" }; go("perto"); } }, h("span", { class: "ico" }, icon("pin")), h("span", { class: "t" }, h("b", { text: "Ver tudo o que tem perto" })), icon("chev", "chev")));
    v.appendChild(list);
  }
  // semana
  v.appendChild(h("h3", { text: "Descontos por idade na semana" }));
  const list = h("div", { class: "list" });
  for (let i = 1; i <= 7; i++) {
    const d = i % 7; const ss = D.descontos.senior.filter(s => s.dia === d);
    const txt = ss.length ? ss.map(s => s.loja + " " + s.desc + (s.first ? " (1ª terça)" : "")).join(" · ") : "Outlets, passeios, Walmart/Target";
    list.appendChild(h("button", { class: "row", onClick: () => sheetDay(d) }, h("span", { class: "badge " + (d === now.getDay() ? "sun" : "gray"), text: DIAS_C[d] }), h("span", { class: "t" }, h("b", { text: ss.length ? txt : "Sem desconto por idade" }), h("span", { text: ss.length ? "Toque para ver como pedir" : txt })), icon("chev", "chev")));
  }
  v.appendChild(list);
  const always = D.descontos.senior.filter(s => s.dia === -1);
  if (always.length) v.appendChild(h("p", { class: "small muted", text: "Todo dia: " + always.map(s => s.loja + " " + s.desc + " (" + s.idade + "+)").join(" · ") }));
  v.appendChild(h("div", { class: "card flat" }, h("b", {}, "Emergência: 911"), h("p", { class: "small", text: "Polícia, ambulância e bombeiros, ligação gratuita." }), h("div", { class: "btns" }, h("button", { class: "btn sm", onClick: () => sheetBig("I need help, please. I don't speak English.") }, "Mostrar pedido de ajuda"))));
}
function useGeoHoje() {
  if (!navigator.geolocation) { toast("Sem acesso à localização neste navegador"); return; }
  toast("Procurando sua localização…");
  navigator.geolocation.getCurrentPosition(p => { state.pos = { la: p.coords.latitude, lo: p.coords.longitude, at: Date.now() }; save(); renderHoje(); }, () => toast("Não consegui pegar a localização. Permita o acesso nos ajustes do navegador."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}
function autoGeoHoje() {
  if (!navigator.geolocation || !navigator.permissions || !navigator.permissions.query) return;
  navigator.permissions.query({ name: "geolocation" }).then(st => { if (st.state === "granted" && (!state.pos || Date.now() - state.pos.at > 10 * 60e3)) navigator.geolocation.getCurrentPosition(p => { state.pos = { la: p.coords.latitude, lo: p.coords.longitude, at: Date.now() }; save(); if (currentView === "hoje") renderHoje(); }, () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }); }).catch(() => {});
}
function sheetSenior(s) {
  openSheet(h("h2", { text: s.loja }), h("div", { class: "tags" }, h("span", { class: "badge sun", text: s.desc + " para " + s.idade + "+" }), " ", h("span", { class: "badge gray", text: s.dia === -1 ? "Todo dia" : DIAS[s.dia] + (s.first ? " (1ª do mês)" : "") })),
    h("p", { html: s.nota }), h("div", { class: "phrase", onClick: () => sheetBig(s.pedir) }, h("div", { class: "en", text: s.pedir }), h("div", { class: "pt", text: "Toque para mostrar em letras grandes" })), closeBtn());
}
function sheetDay(d) {
  const ss = D.descontos.senior.filter(s => s.dia === d);
  openSheet(h("h2", { text: DIAS[d] }), ...(ss.length ? ss.map(s => h("button", { class: "phrase", onClick: () => sheetSenior(s) }, h("div", { class: "en", text: s.loja + " · " + s.desc }), h("div", { class: "pt", text: s.idade + "+ · " + s.nota.slice(0, 90) + (s.nota.length > 90 ? "…" : "") }))) : [h("p", { class: "muted", text: "Nenhuma rede dá desconto por idade neste dia. Aproveite para outlets, parques e passeios." })]), closeBtn());
}
function sheetParksWeek() {
  const names = ["Magic Kingdom", "EPCOT", "Animal Kingdom", "Hollywood Studios"];
  const tb = h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: "Dia" }), ...names.map(n => h("th", { text: n })))), h("tbody", {}, ...[1, 2, 3, 4, 5, 6, 0].map(d => h("tr", {}, h("td", { text: DIAS_C[d] }), ...(D.descontos.parques_semana[String(d)] || []).map(x => h("td", { text: x }))))));
  openSheet(h("h2", { text: "Qual parque em cada dia" }), h("p", { class: "small muted", text: "🟢 muito bom · 🔵 bom · 🟡 intermediário · 🔴 mais cheio. Estimativa geral por dia da semana (@orlandocomavan); feriados mudam tudo — confira as filas no app no dia." }), h("div", { class: "tscroll" }, tb), closeBtn());
}
function sheetPhrases() {
  const groups = []; D.frases.forEach(f => { const g = f[2] || "Frases"; let grp = groups.find(x => x.g === g); if (!grp) { grp = { g, items: [] }; groups.push(grp); } grp.items.push(f); });
  const nodes = [h("h2", { text: "Toque numa frase para ampliar" }), h("p", { class: "small muted", text: "Mostre a tela para a pessoa ler." })];
  groups.forEach(grp => { nodes.push(h("h3", { class: "grp", text: grp.g })); grp.items.forEach(f => nodes.push(h("button", { class: "phrase", onClick: () => sheetBig(f[0]) }, h("div", { class: "en", text: f[0] }), h("div", { class: "pt", text: f[1] })))); });
  nodes.push(closeBtn()); openSheet(...nodes);
}
function sheetConverter() {
  const out = h("div", { class: "bigtext", text: "—" });
  const rate = h("input", { type: "number", inputmode: "decimal", step: "0.01", value: effectiveRate() || "", placeholder: "Ex.: 5,40" });
  const usd = h("input", { type: "number", inputmode: "decimal", placeholder: "0" });
  const src = state.rateAuto ? "Cotação automática de " + new Date(state.rateAt).toLocaleDateString("pt-BR") + " (Frankfurter/BCE). Edite para usar outra." : "Sem cotação automática ainda: abra com internet ou digite a sua.";
  const tax = h("select", {}, h("option", { value: "0.065", text: "Orlando / Disney / I-Drive (6,5%)" }), h("option", { value: "0.07", text: "Altamonte Springs / Miami (7%)" }), h("option", { value: "0.075", text: "Kissimmee (7,5%)" }));
  tax.value = String(state.tax);
  const calc = () => { const r = num(rate.value), u = num(usd.value), t = parseFloat(tax.value); state.tax = t; if (r && Math.abs(r - state.rateAuto) > 0.001) { state.rate = r; state.rateManual = true; } save(); out.textContent = (r && u) ? brl(u * (1 + t) * r) : "—"; };
  [rate, usd, tax].forEach(el => { el.addEventListener("input", calc); el.addEventListener("change", calc); });
  openSheet(h("h2", { text: "Quanto vai custar em reais" }), h("label", { text: "Preço na etiqueta (US$)" }), usd, h("label", { text: "Onde está comprando (imposto)" }), tax, h("label", { text: "Cotação do dólar (R$)" }), rate, h("p", { class: "small muted", text: src }), out, h("p", { class: "small muted", text: "O imposto é cobrado no caixa, por cima da etiqueta. Não existe devolução de imposto para turista na Flórida." }), closeBtn());
}

/* ---------------- LOJAS (redes · lugares · parques · miami) ---------------- */
let seg = "redes", query = "";
function segments() {
  const lug = D.lugares;
  return {
    redes: D.lojas,
    lugares: lug.filter(g => !/parques|miami/i.test(g.grupo)),
    parques: lug.filter(g => /parques/i.test(g.grupo)),
    miami: lug.filter(g => /miami/i.test(g.grupo)),
  };
}
function renderLojas() {
  const v = $("#view-lojas"); v.replaceChildren();
  v.appendChild(h("h2", { text: "Lojas e lugares" }));
  const sg = h("div", { class: "seg" }, ...[["redes", "Redes"], ["lugares", "Regiões"], ["parques", "Parques"], ["miami", "Miami"]].map(([k, l]) => h("button", { class: k === seg ? "on" : "", onClick: () => { seg = k; renderLojas(); } }, l)));
  v.appendChild(sg);
  const inp = h("input", { type: "search", placeholder: seg === "redes" ? "Filtrar: tênis, casa, bebê…" : "Filtrar lugares…", value: query, onInput: e => { query = e.target.value; renderLojaList(listBox); } });
  v.appendChild(h("div", { class: "search" }, icon("search"), inp));
  if (seg === "parques") v.appendChild(h("button", { class: "btn tonal block", onClick: sheetParksWeek }, icon("park"), "Qual parque em cada dia da semana"));
  const listBox = h("div"); v.appendChild(listBox); renderLojaList(listBox);
}
function renderLojaList(box) {
  box.replaceChildren();
  const q = query.trim().toLowerCase(); let count = 0;
  segments()[seg].forEach(g => {
    const items = g.itens.filter(it => !q || (it.n + " " + it.tag + " " + it.d.join(" ")).toLowerCase().includes(q));
    if (!items.length) return;
    box.appendChild(h("h3", { text: g.grupo }));
    box.appendChild(h("div", { class: "list" }, ...items.map(it => h("button", { class: "row", onClick: () => sheetItem(it) }, h("span", { class: "ico" }, icon(seg === "redes" ? "bag" : seg === "parques" ? "park" : "map")), h("span", { class: "t" }, h("b", { text: it.n }), h("span", { text: [it.tag, bestRating(it) ? "★ " + String(bestRating(it)).replace(".", ",") : "", (n => n ? n + (n === 1 ? " pedido" : " pedidos") : "")(pendentes(pedidosLoja(it)).length)].filter(Boolean).join(" · ") })), icon("chev", "chev")))));
    count += items.length;
  });
  if (!count) box.appendChild(h("div", { class: "empty", text: "Nada encontrado com esse filtro." }));
}
function sheetItem(it) {
  const btns = h("div", { class: "btns" });
  if (it.q) btns.appendChild(h("a", { class: "btn tonal", href: mapsSearch(it.q) }, icon("pin"), "Achar a mais próxima"));
  openSheet(h("h2", { text: it.n }), h("div", { class: "tags" }, h("span", { class: "badge " + (it.tagc || "sky"), text: it.tag })),
    it.perto ? h("p", { class: "small muted", text: "Perto da casa: " + it.perto }) : null,
    pedidosSection(pedidosLoja(it), () => sheetItem(it)),
    h("h3", { text: "Como aproveitar" }), h("ul", {}, ...it.d.map(x => h("li", { html: x }))), btns, h("div", { class: "btns" }, closeBtn()));
}

/* ---------------- DICAS ---------------- */
function renderDicas() {
  const v = $("#view-dicas"); v.replaceChildren(h("h2", { text: "Dicas" }), h("p", { class: "small muted", text: "Toque em um tema. Tudo cabe em uma leitura rápida." }));
  v.appendChild(h("div", { class: "tiles" }, ...D.dicas.map(d => h("button", { class: "tile", onClick: () => sheetDica(d) }, h("span", { class: "ico" }, icon(d.icon || "bulb")), h("b", { text: d.t }), h("span", { text: d.resumo || "" })))));
  v.appendChild(h("h3", { text: "Tabelas" }));
  v.appendChild(h("div", { class: "list" }, h("button", { class: "row", onClick: sheetSizes }, h("span", { class: "ico" }, icon("ruler")), h("span", { class: "t" }, h("b", { text: "Tamanhos Brasil → EUA" }), h("span", { text: "Roupa, sapato, criança, jeans" })), icon("chev", "chev"))));
}
function sheetDica(d) { openSheet(h("h2", { text: d.t }), h("ul", {}, ...d.b.map(x => h("li", { html: x }))), d.src ? h("div", { class: "src", text: d.src }) : null, closeBtn()); }
function sheetSizes() {
  const nodes = [h("h2", { text: "Tamanhos Brasil → EUA" }), h("p", { class: "small muted", text: "Aproximados: cada marca muda um pouco. Se puder, prove." })];
  D.tamanhos.forEach(t => {
    nodes.push(h("h3", { text: t.t }));
    nodes.push(h("div", { class: "tscroll" }, h("table", {}, h("thead", {}, h("tr", {}, ...t.h.map(x => h("th", { text: x })))), h("tbody", {}, ...t.r.map(r => h("tr", {}, ...r.map(c => h("td", { text: c }))))))));
    if (t.n) nodes.push(h("p", { class: "small muted", text: t.n }));
  });
  nodes.push(closeBtn()); openSheet(...nodes);
}

/* ---------------- busca de lugares (sem internet) ---------------- */
function findPlaces(q) {
  q = norm(q); if (q.length < 2) return [];
  const out = [];
  const wordHit = (n) => n === q || n.startsWith(q) || q.startsWith(n) || n.split(" ").some(w => w.startsWith(q));
  D.pontos.regioes.forEach(r => { const names = [r.n, ...(r.al || [])].map(norm); const hit = names.find(wordHit); if (hit) out.push({ kind: "regiao", n: r.n, sub: "Região", la: r.la, lo: r.lo, score: (hit === q ? 0 : 1) }); });
  D.pontos.pontos.forEach(p => { const n = norm(placeName(p)); if (n.includes(q)) out.push({ kind: "ponto", n: placeName(p), sub: ((D.pontos.tipos[p.c] || {}).b || "") + " · " + p.a, la: p.la, lo: p.lo, score: 2 + (n.startsWith(q) ? 0 : 1), p }); });
  return out.sort((a, b) => a.score - b.score).slice(0, 6);
}
function nearestRegion(la, lo) { let best = null, bd = 1e9; D.pontos.regioes.forEach(r => { const d = kmBetween(la, lo, r.la, r.lo); if (d < bd) { bd = d; best = r; } }); return best && bd <= 40 ? best : null; }
function nearestPlaceName(la, lo) { let best = null, bd = 1e9; D.pontos.pontos.forEach(p => { if (p.c === "train") return; const d = kmBetween(la, lo, p.la, p.lo); if (d < bd) { bd = d; best = p; } }); return best && bd <= 3 ? placeName(best) : null; }

/* ---------------- PERTO (planejador) ---------------- */
let here = null; // {la, lo, label}
let nearMode = "lista";
const nf = { open: false, top: false, type: "", sort: "km" };
function placeName(p) { return p.n || (D.pontos.tipos[p.c] || {}).n || p.c; }
function placeId(p) { return (placeName(p) + "|" + p.a).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80); }
function renderPerto() {
  const v = $("#view-perto"); v.replaceChildren(h("h2", { text: "O que tem perto" }));
  const sel = h("select", { onChange: e => setRegion(e.target.value) }, h("option", { value: "", text: "Escolha a região…" }));
  let grp = null, og = null;
  D.pontos.regioes.forEach(r => { if (r.g !== grp) { grp = r.g; og = h("optgroup", { label: grp }); sel.appendChild(og); } og.appendChild(h("option", { value: r.id, text: r.n })); });
  sel.value = state.region || "";
  const sug = h("div", { class: "sugg" });
  const addr = h("input", { type: "search", placeholder: "Onde você vai? Ex.: Universal, Lake Buena Vista, Sawgrass, nome do hotel", autocomplete: "off",
    onInput: e => { const list = findPlaces(e.target.value); sug.replaceChildren(...list.map(x => h("button", { class: "row", onClick: () => { addr.value = x.n; sug.replaceChildren(); here = { la: x.la, lo: x.lo, label: x.n }; state.region = ""; sel.value = ""; save(); renderNear(); } }, h("span", { class: "ico" }, icon(x.kind === "regiao" ? "map" : "pin")), h("span", { class: "t" }, h("b", { text: x.n }), h("span", { text: x.sub })), icon("chev", "chev")))); sug.classList.toggle("list", list.length > 0); } });
  addr.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); planAddr(addr.value); } });
  v.appendChild(h("div", { class: "card" }, h("div", { class: "search" }, icon("search"), addr), sug,
    h("div", { class: "btns" }, h("button", { class: "btn tonal", onClick: useGeo }, icon("nav"), "Usar onde estou"), state.homeLat != null ? h("button", { class: "btn tonal", onClick: () => { here = { la: state.homeLat, lo: state.homeLng, label: "casa" }; state.region = ""; sel.value = ""; save(); renderNear(); } }, icon("home"), "Partir da casa") : null, h("button", { class: "btn", onClick: () => planAddr(addr.value) }, "Buscar")),
    h("label", { text: "Ou escolha a região" }), sel));
  v.appendChild(h("div", { class: "seg", id: "nearSeg" }, h("button", { class: nearMode === "lista" ? "on" : "", onClick: () => { nearMode = "lista"; renderNear(); } }, "Lista"), h("button", { class: nearMode === "mapa" ? "on" : "", onClick: () => { nearMode = "mapa"; renderNear(); } }, "Mapa")));
  v.appendChild(h("div", { id: "nearHead" })); v.appendChild(h("div", { id: "near" }));
  v.appendChild(h("h3", { text: "Meu roteiro de hoje" }));
  v.appendChild(h("div", { class: "list", id: "plan" }));
  v.appendChild(h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: openRoute }, icon("route"), "Abrir rota no Maps"), h("button", { class: "btn tonal sm", onClick: autoOrder }, "Ordenar pelo caminho"), h("button", { class: "btn danger sm", onClick: clearPlan }, "Limpar")));
  v.appendChild(h("p", { class: "small muted", text: "Lojas levantadas em out/2026 (Google Maps). Horários e endereços podem mudar." }));
  if (state.region) { const r = D.pontos.regioes.find(x => x.id === state.region); if (r) here = { la: r.la, lo: r.lo, label: r.n }; }
  renderNear(); renderPlan();
}
function setRegion(id) { const r = D.pontos.regioes.find(x => x.id === id); state.region = r ? id : ""; save(); here = r ? { la: r.la, lo: r.lo, label: r.n } : null; renderNear(); }
function useGeo() {
  if (!navigator.geolocation) { toast("Sem acesso à localização neste navegador"); return; }
  toast("Procurando sua localização…");
  navigator.geolocation.getCurrentPosition(p => { here = { la: p.coords.latitude, lo: p.coords.longitude, label: "onde você está" }; renderNear(); }, () => toast("Não consegui pegar a localização. Escolha a região."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}
async function planAddr(q) {
  q = str(q, 120); if (!q) { toast("Digite um lugar, região ou endereço"); return; }
  const local = findPlaces(q); if (local.length) { const x = local[0]; here = { la: x.la, lo: x.lo, label: x.n }; state.region = ""; save(); const sel = $("#view-perto select"); if (sel) sel.value = ""; renderNear(); return; }
  if (navigator.onLine) {
    toast("Procurando o endereço…");
    try { const g = await geocode(q); if (g) { here = { la: g.la, lo: g.lo, label: q }; state.region = ""; save(); const sel = $("#view-perto select"); if (sel) sel.value = ""; renderNear(); return; } toast("Não achei esse endereço; abrindo busca no Maps"); } catch { /* cai para os links */ }
  }
  const redes = ["Ross Dress for Less", "T.J. Maxx", "Marshalls", "Burlington", "Walmart Supercenter", "Target", "Walgreens", "CVS Pharmacy", "Nordstrom Rack", "Kohl's", "Publix", "Dollar Tree"];
  $("#nearHead").replaceChildren(h("div", { class: "card" }, h("b", {}, "Lojas perto de: " + q), h("p", { class: "small muted", text: "Cada botão abre o Maps já procurando a rede perto desse endereço (precisa de internet)." }), h("div", { class: "btns" }, ...redes.map(n => h("a", { class: "btn sm", href: mapsSearch(n + " near " + q) }, n)))));
  $("#near").replaceChildren();
}
function renderNear() {
  const head = $("#nearHead"), box = $("#near"); if (!head || !box) return;
  if (!here) { head.replaceChildren(); box.replaceChildren(h("div", { class: "empty", text: "Escolha uma região para ver lojas, outlets e parques por perto." })); return; }
  const raio = D.config.raio_km || 12;
  let list = D.pontos.pontos.map(p => Object.assign({}, p, { km: kmBetween(here.la, here.lo, p.la, p.lo) })).sort((a, b) => a.km - b.km);
  let lim = raio; if (!list.some(p => p.km <= lim)) lim = 40;
  list = list.filter(p => p.km <= lim);
  const TYPES = { comida: ["comida"], loja: ["ross", "tjmaxx", "th", "marshalls", "mh", "burlington", "nrack", "bealls", "kohls", "walmart", "walmartp", "target", "walgreens", "cvs", "publix", "dollartree", "ulta"], shop: ["outlet", "mall", "barg"], park: ["park"], train: ["train"] };
  if (nf.type) list = list.filter(p => (TYPES[nf.type] || []).includes(p.c));
  if (nf.open) list = list.filter(p => (openStatus(p) || {}).open);
  if (nf.top) list = list.filter(p => (p.r || 0) >= 4.3);
  if (nf.sort === "r") list.sort((a, b) => (b.r || 0) - (a.r || 0) || a.km - b.km);
  list = list.slice(0, 40);
  const chip = (lab, on, fn) => h("button", { class: "chip" + (on ? " on" : ""), onClick: () => { fn(); renderNear(); } }, lab);
  const filters = h("div", { class: "filters" },
    chip("Abertos agora", nf.open, () => nf.open = !nf.open), chip("★ 4,3+", nf.top, () => nf.top = !nf.top),
    chip("Lojas", nf.type === "loja", () => nf.type = nf.type === "loja" ? "" : "loja"), chip("Outlets e shoppings", nf.type === "shop", () => nf.type = nf.type === "shop" ? "" : "shop"), chip("Parques", nf.type === "park", () => nf.type = nf.type === "park" ? "" : "park"), chip("Comida", nf.type === "comida", () => nf.type = nf.type === "comida" ? "" : "comida"),
    chip(nf.sort === "r" ? "Por nota" : "Por distância", nf.sort === "r", () => nf.sort = nf.sort === "r" ? "km" : "r"));
  head.replaceChildren(h("div", { class: "callout info", text: "Perto de " + here.label + " — " + list.length + " lugares em até " + lim + " km" + (nf.sort === "r" ? ", por nota." : ", do mais perto ao mais longe.") }), filters);
  $$("#nearSeg button").forEach((b, i) => b.classList.toggle("on", (i === 0) === (nearMode === "lista")));
  if (nearMode === "mapa") { box.replaceChildren(); showMap(box, list); return; }
  const l = h("div", { class: "list" });
  list.forEach(p => { const t = D.pontos.tipos[p.c] || {}; const st = openStatus(p); const np = pendentes(pedidosPonto(p)).length; const sub = [np ? np + (np === 1 ? " pedido" : " pedidos") : "", t.b, ratingText(p), st ? st.txt : ""].filter(Boolean).join(" · ") || p.a;
    l.appendChild(h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon(p.c === "park" ? "park" : p.c === "train" ? "route" : p.c === "comida" ? "fork" : p.c === "outlet" || p.c === "mall" || p.c === "barg" ? "bag" : "tag")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { class: st && !st.open ? "closed" : "", text: sub })), h("span", { class: "km", text: p.km.toFixed(1).replace(".", ",") + " km" }), icon("chev", "chev"))); });
  box.replaceChildren(l);
}
function sheetPlace(p) {
  const t = D.pontos.tipos[p.c] || {}; const id = placeId(p); const inPlan = state.plan.some(s => s.id === id);
  const st = openStatus(p);
  openSheet(h("h2", { text: placeName(p) }), h("div", { class: "tags" }, h("span", { class: "badge " + (t.bc || "sky"), text: t.b || "" }), p.r ? h("span", { class: "badge gray", text: ratingText(p) + " no Google" }) : null, st ? h("span", { class: "badge " + (st.open ? "leaf" : "coral"), text: st.txt + (st.approx ? " (aprox.)" : "") }) : null),
    h("p", { text: p.a }), p.h ? h("p", { class: "small muted", text: "Horário: " + p.h }) : null, p.dica ? h("div", { class: "callout ok", html: p.dica }) : null,
    pedidosSection(pedidosPonto(p), () => sheetPlace(p)),
    h("div", { class: "btns" }, h("a", { class: "btn primary", href: mapsDir(placeName(p) + ", " + p.a) }, icon("nav"), "Como chegar"), h("a", { class: "btn", href: mapsSearch(placeName(p) + ", " + p.a) }, "Ver no Maps"),
      h("button", { class: "btn tonal", onClick: () => { addStop(p); closeSheet(); } }, icon(inPlan ? "check" : "plus"), inPlan ? "No roteiro" : "Adicionar ao roteiro")),
    h("div", { class: "btns" }, closeBtn()));
}
function addStop(p) { const id = placeId(p); if (state.plan.some(s => s.id === id)) { toast("Já está no roteiro"); return; } if (state.plan.length >= 30) { toast("Roteiro cheio"); return; } state.plan.push({ id, n: placeName(p), a: p.a }); save(); renderPlan(); toast("Adicionado ao roteiro"); }
function renderPlan() {
  const box = $("#plan"); if (!box) return; box.replaceChildren();
  if (!state.plan.length) { box.appendChild(h("div", { class: "empty", text: "Toque numa loja acima e depois em “Adicionar ao roteiro”." })); return; }
  const km = planTotalKm(); if (km) box.appendChild(h("div", { class: "small muted", style: null, text: state.plan.length + " paradas · ~" + Math.round(km * 1.25) + " km de carro" + (state.homeLat != null ? " saindo da casa" : "") }));
  state.plan.forEach((s, i) => box.appendChild(h("div", { class: "stop" }, h("span", { class: "num", text: String(i + 1) }), h("div", { class: "n" }, s.n, h("small", { text: s.a })),
    h("button", { class: "iconbtn", "aria-label": "subir", onClick: () => { if (i > 0) { [state.plan[i - 1], state.plan[i]] = [state.plan[i], state.plan[i - 1]]; save(); renderPlan(); } } }, icon("up")),
    h("button", { class: "iconbtn", "aria-label": "descer", onClick: () => { if (i < state.plan.length - 1) { [state.plan[i + 1], state.plan[i]] = [state.plan[i], state.plan[i + 1]]; save(); renderPlan(); } } }, icon("down")),
    h("button", { class: "iconbtn", "aria-label": "remover", onClick: () => { state.plan.splice(i, 1); save(); renderPlan(); } }, icon("x")))));
}
function planCoords(s) { const p = D.pontos.pontos.find(x => placeId(x) === s.id); return p ? { la: p.la, lo: p.lo } : null; }
function autoOrder() {
  const a = state.plan; if (a.length < 2) { toast("Adicione pelo menos 2 paradas"); return; }
  let cur = (state.homeLat != null) ? { la: state.homeLat, lo: state.homeLng } : (here ? { la: here.la, lo: here.lo } : planCoords(a[0]));
  const rest = a.slice(), out = [];
  while (rest.length) { let bi = 0, bd = 1e9; rest.forEach((s, i) => { const c = planCoords(s); const d = c && cur ? kmBetween(cur.la, cur.lo, c.la, c.lo) : 1e8; if (d < bd) { bd = d; bi = i; } }); const s = rest.splice(bi, 1)[0]; out.push(s); cur = planCoords(s) || cur; }
  state.plan = out; save(); renderPlan(); toast("Roteiro ordenado pelo caminho mais curto");
}
function planTotalKm() { let cur = (state.homeLat != null) ? { la: state.homeLat, lo: state.homeLng } : null, tot = 0; state.plan.forEach(s => { const c = planCoords(s); if (c && cur) tot += kmBetween(cur.la, cur.lo, c.la, c.lo); if (c) cur = c; }); return tot; }
function openRoute() { if (!state.plan.length) { toast("Adicione paradas primeiro"); return; } const stops = state.plan.map(s => s.n + ", " + s.a); window.open(mapsDir(stops[stops.length - 1], state.home || "", stops.slice(0, -1)), "_blank", "noopener"); }
function clearPlan() { if (!state.plan.length) return; if (!confirm("Limpar o roteiro de hoje?")) return; state.plan = []; save(); renderPlan(); }


/* ---------------- pedidos × lojas (cruzamento) ----------------
   Cada pedido tem "onde" (nomes de redes separados por ;). Uma loja/ponto
   "tem" o pedido quando algum desses nomes aparece no nome da loja/rede. */
function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function pedidosPara(names) {
  const hay = " " + names.map(norm).filter(Boolean).join(" | ") + " ";
  return allItems().filter(i => (i.onde || "").split(/[;,|]/).map(norm).filter(t => t.length > 1).some(t => hay.includes(" " + t + " ") || hay.includes(" " + t) || hay.includes(t + " ")));
}
function pedidosLoja(it) { return pedidosPara([it.n, it.q, it.tag]); }
function bestRating(it) { const names = [it.n, it.q].map(norm).filter(Boolean); let best = 0; D.pontos.pontos.forEach(p => { if (!p.r) return; const pn = norm(placeName(p) + " " + ((D.pontos.tipos[p.c] || {}).n || "")); if (names.some(n => n.split(" ")[0].length > 2 && pn.includes(n.split(" ")[0]))) best = Math.max(best, p.r); }); return best; }
function pedidosPonto(p) { const t = D.pontos.tipos[p.c] || {}; return pedidosPara([placeName(p), t.n, p.c]); }
function itemPhoto(i) {
  if (i.foto) return h("img", { src: i.foto, alt: "" });
  if (i.fotoUrl) { const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = i.fotoUrl; img.addEventListener("error", () => img.remove()); return img; }
  return null;
}
function prefetchPhotos() { if (!navigator.onLine) return; allItems().forEach(i => { if (i.fotoUrl) fetch(i.fotoUrl, { mode: "no-cors", referrerPolicy: "no-referrer" }).catch(() => {}); }); }
function pendentes(list) { return list.filter(i => !state.done[i.id]); }
function pedidosBadge(list) { const n = pendentes(list).length; return n ? h("span", { class: "badge leaf", text: n + (n === 1 ? " pedido" : " pedidos") }) : null; }
function pedidosSection(list, rerender) {
  if (!list.length) return null;
  const box = h("div", { class: "list" });
  list.forEach(i => {
    const done = !!state.done[i.id];
    const chk = h("input", { type: "checkbox", class: "chk", "aria-label": "comprado" }); chk.checked = done;
    chk.addEventListener("change", () => { if (chk.checked) state.done[i.id] = true; else delete state.done[i.id]; save(); if (rerender) rerender(); });
    const meta = [personName(i.pessoa), i.tam ? "tam. " + i.tam : "", i.cor, i.preco ? money(i.preco) : ""].filter(Boolean).join(" · ");
    box.appendChild(h("div", { class: "item" + (done ? " done" : "") }, chk, itemPhoto(i), h("div", { class: "t" }, h("b", { text: i.nome }), h("div", { class: "meta", text: meta }), i.obs ? h("div", { class: "meta", text: i.obs }) : null, i.link ? h("div", { class: "links" }, h("a", { href: i.link }, "Ver modelo")) : null)));
  });
  const n = pendentes(list).length;
  return h("div", {}, h("h3", { text: "Pedidos da família aqui" + (n ? " · " + n + " em aberto" : " · tudo comprado") }), box, h("button", { class: "btn sm", onClick: () => { closeSheet(); go("lista"); } }, "Ver lista completa"));
}

/* ---------------- LISTA (pedidos da família) ---------------- */
function allPeople() { return [...(D.pedidos.pessoas || []).map(p => ({ id: str(p.id, 40), nome: str(p.nome, 60), tam: str(p.tam, 500), seed: true })), ...state.people]; }
function allItems() { return [...cleanItems(D.pedidos.pedidos || []).map(i => Object.assign(i, { seed: true })), ...state.items]; }
function personName(id) { const p = allPeople().find(x => x.id === id); return p ? p.nome : ""; }
let filterPerson = "";
function renderLista() {
  const v = $("#view-lista"); v.replaceChildren(h("h2", { text: "Lista da família" }));
  const items = allItems(); const tot = items.filter(i => state.done[i.id]).reduce((s, i) => s + i.preco, 0); const cota = D.config.cota_usd || 1000;
  const pct = Math.min(100, Math.round(tot / cota * 100));
  v.appendChild(h("div", { class: "card" }, h("div", { class: "total" }, h("div", {}, h("div", { class: "small muted", text: "Comprado até agora" }), h("div", { class: "n", text: money(tot) })), h("div", { class: "small muted", text: effectiveRate() ? "≈ " + brl(tot * effectiveRate()) : "" })),
    h("div", { class: "bar" }, h("i", { class: tot > cota ? "over" : "", style: null, dataset: { pct } })),
    h("div", { class: "small " + (tot > cota ? "" : "muted"), text: tot > cota ? "Passou US$ " + (tot - cota).toFixed(0) + " da cota de US$ " + cota : "Faltam US$ " + (cota - tot).toFixed(0) + " para a cota de US$ " + cota + " (isenção na volta)" })));
  $$(".bar i", v).forEach(i => i.style.width = (i.dataset.pct || 0) + "%");
  v.appendChild(h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: () => sheetItemForm() }, icon("plus"), "Pedido"), h("button", { class: "btn", onClick: () => sheetPersonForm() }, icon("plus"), "Pessoa"), h("button", { class: "btn", onClick: sheetShare }, icon("share"), "Compartilhar")));
  const people = allPeople();
  if (people.length) {
    v.appendChild(h("h3", { text: "Pessoas e tamanhos" }));
    v.appendChild(h("div", { class: "list" }, ...people.map(p => h("button", { class: "row", onClick: () => p.seed ? sheetBig(p.nome + "\n" + (p.tam || "")) : sheetPersonForm(p) }, h("span", { class: "ico", text: p.nome.slice(0, 1).toUpperCase() }), h("span", { class: "t" }, h("b", { text: p.nome }), h("span", { text: p.tam || "sem tamanhos" })), icon("chev", "chev")))));
  }
  v.appendChild(h("h3", { text: "Pedidos" }));
  const sel = h("select", { onChange: e => { filterPerson = e.target.value; renderLista(); } }, h("option", { value: "", text: "Todas as pessoas" }), ...people.map(p => h("option", { value: p.id, text: p.nome })));
  sel.value = filterPerson; v.appendChild(sel);
  const list = items.filter(i => !filterPerson || i.pessoa === filterPerson);
  const box = h("div", { class: "list" });
  if (!list.length) box.appendChild(h("div", { class: "empty", text: "Nenhum pedido ainda. Toque em “+ Pedido”, ou preencha a planilha do site." }));
  list.forEach(i => {
    const done = !!state.done[i.id];
    const meta = [personName(i.pessoa), i.cor, i.tam ? "tam. " + i.tam : "", i.preco ? money(i.preco) : ""].filter(Boolean).join(" · ");
    const onde = (i.onde || i.loja) ? "Onde achar: " + (i.onde || i.loja).replace(/;\s*/g, " · ") : "";
    const chk = h("input", { type: "checkbox", class: "chk", "aria-label": "comprado" }); chk.checked = done; chk.addEventListener("change", () => { if (chk.checked) state.done[i.id] = true; else delete state.done[i.id]; save(); renderLista(); });
    box.appendChild(h("div", { class: "item" + (done ? " done" : "") }, chk, itemPhoto(i),
      h("div", { class: "t" }, h("b", { text: i.nome }), h("div", { class: "meta", text: meta }), onde ? h("div", { class: "meta", text: onde }) : null, i.obs ? h("div", { class: "meta", text: i.obs }) : null,
        (i.link || !i.seed) ? h("div", { class: "links" }, i.link ? h("a", { href: i.link }, "Ver modelo") : null, !i.seed ? h("button", { class: "linkbtn", onClick: () => sheetItemForm(i) }, "Editar") : null) : null)));
  });
  v.appendChild(box);
  v.appendChild(h("p", { class: "small muted", text: "Pedidos da planilha do site aparecem automaticamente; os que você cria aqui ficam só neste celular (use Compartilhar para mandar)." }));
}
function sheetPersonForm(p) {
  const nome = h("input", { type: "text", value: p ? p.nome : "", placeholder: "Ex.: Roberto", maxlength: 60 });
  const tam = h("textarea", { placeholder: "Ex.: camiseta M, calça 34x32, tênis US 10 / BR 42, pé 27 cm", maxlength: 500 }); if (p) tam.value = p.tam;
  openSheet(h("h2", { text: p ? "Editar pessoa" : "Nova pessoa" }), h("label", { text: "Nome" }), nome, h("label", { text: "Tamanhos" }), tam,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: () => { const n = str(nome.value, 60); if (!n) { toast("Escreva o nome"); return; } if (p) { p.nome = n; p.tam = str(tam.value, 500); } else state.people.push({ id: uid(), nome: n, tam: str(tam.value, 500) }); save(); closeSheet(); renderLista(); } }, "Salvar"),
      h("button", { class: "btn", onClick: closeSheet }, "Cancelar"), p ? h("button", { class: "btn danger sm", onClick: () => { if (!confirm("Excluir esta pessoa?")) return; state.people = state.people.filter(x => x.id !== p.id); save(); closeSheet(); renderLista(); } }, "Excluir") : null));
}
let fotoTemp = "";
function sheetItemForm(i) {
  fotoTemp = i ? i.foto : "";
  const people = allPeople();
  const pessoa = h("select", {}, h("option", { value: "", text: "(sem pessoa)" }), ...people.map(p => h("option", { value: p.id, text: p.nome }))); if (i) pessoa.value = i.pessoa;
  const nome = h("input", { type: "text", value: i ? i.nome : "", placeholder: "Ex.: Tênis Nike Air Max 90", maxlength: 120 });
  const loja = h("input", { type: "text", value: i ? i.loja : "", placeholder: "Ex.: Nike outlet", maxlength: 80 });
  const preco = h("input", { type: "number", inputmode: "decimal", value: i && i.preco ? i.preco : "", placeholder: "0" });
  const cor = h("input", { type: "text", value: i ? i.cor : "", placeholder: "Ex.: branco", maxlength: 40 });
  const tam = h("input", { type: "text", value: i ? i.tam : "", placeholder: "Ex.: US 10", maxlength: 40 });
  const link = h("input", { type: "url", value: i ? i.link : "", placeholder: "https://…", maxlength: 500 });
  const obs = h("textarea", { placeholder: "Modelo exato, segunda opção…", maxlength: 300 }); if (i) obs.value = i.obs;
  const prev = h("div"); if (fotoTemp) prev.appendChild(h("img", { src: fotoTemp, alt: "", class: "ph" }));
  const foto = h("input", { type: "file", accept: "image/*", onChange: e => pickFoto(e.target, prev) });
  openSheet(h("h2", { text: i ? "Editar pedido" : "Novo pedido" }), h("label", { text: "Para quem" }), pessoa, h("label", { text: "O que é" }), nome,
    h("div", { class: "grid2" }, h("div", {}, h("label", { text: "Loja" }), loja), h("div", {}, h("label", { text: "Preço (US$)" }), preco)),
    h("div", { class: "grid2" }, h("div", {}, h("label", { text: "Cor" }), cor), h("div", {}, h("label", { text: "Tamanho" }), tam)),
    h("label", { text: "Link (opcional)" }), link, h("label", { text: "Observações" }), obs, h("label", { text: "Foto (opcional)" }), foto, prev,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: () => {
      const n = str(nome.value, 120); if (!n) { toast("Escreva o que é"); return; }
      const data = { pessoa: str(pessoa.value, 40), nome: n, loja: str(loja.value, 80), cor: str(cor.value, 40), tam: str(tam.value, 40), preco: num(preco.value), link: safeUrl(link.value) || "", obs: str(obs.value, 300), foto: safeImg(fotoTemp) || "" };
      if (link.value.trim() && !data.link) { toast("Link inválido: use http ou https"); return; }
      if (i) Object.assign(i, data); else state.items.push(Object.assign({ id: uid() }, data));
      save(); closeSheet(); renderLista(); toast("Salvo"); } }, "Salvar"),
      h("button", { class: "btn", onClick: closeSheet }, "Cancelar"), i ? h("button", { class: "btn danger sm", onClick: () => { if (!confirm("Excluir este pedido?")) return; state.items = state.items.filter(x => x.id !== i.id); delete state.done[i.id]; save(); closeSheet(); renderLista(); } }, "Excluir") : null));
}
function pickFoto(inp, prev) {
  const f = inp.files && inp.files[0]; if (!f || !f.type.startsWith("image/")) return;
  const img = new Image(); const url = URL.createObjectURL(f);
  img.onload = () => { const max = 320, s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); fotoTemp = c.toDataURL("image/jpeg", 0.7); URL.revokeObjectURL(url); prev.replaceChildren(h("img", { src: fotoTemp, alt: "", class: "ph" })); };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Não consegui ler a imagem"); };
  img.src = url;
}
const MAGIC = "GUIA-LISTA:";
function sheetShare() {
  const ta = h("textarea", { placeholder: "Cole aqui o texto recebido de outro celular" });
  openSheet(h("h2", { text: "Compartilhar a lista" }), h("p", { class: "small muted", text: "Copie e mande pelo WhatsApp. Quem recebe cola em “Importar” e os pedidos são somados (nada é apagado). Fotos não vão junto." }),
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: exportList }, "Copiar minha lista")),
    h("label", { text: "Importar" }), ta, h("div", { class: "btns" }, h("button", { class: "btn tonal", onClick: () => importList(ta.value) }, "Juntar à minha lista"), h("button", { class: "btn danger sm", onClick: () => { if (confirm("Apagar pessoas, pedidos e marcações deste celular?")) { state.people = []; state.items = []; state.done = {}; save(); closeSheet(); renderLista(); } } }, "Apagar tudo")),
    h("div", { class: "btns" }, closeBtn()));
}
function exportList() {
  const txt = MAGIC + JSON.stringify({ people: state.people, items: state.items.map(i => Object.assign({}, i, { foto: "" })), done: Object.keys(state.done) });
  const ok = () => toast("Copiado! Cole no WhatsApp.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(() => fallbackCopy(txt)); else fallbackCopy(txt);
}
function fallbackCopy(txt) { const ta = h("textarea", { readonly: true }); ta.value = txt; sheet.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Copiado!"); } catch { toast("Selecione e copie o texto"); } }
function importList(txt) {
  txt = String(txt || ""); const k = txt.indexOf(MAGIC); if (k < 0) { toast("Texto não reconhecido"); return; }
  let data; try { data = JSON.parse(txt.slice(k + MAGIC.length)); } catch { toast("Texto incompleto — copie tudo de novo"); return; }
  if (!data || typeof data !== "object") { toast("Texto inválido"); return; }
  let n = 0;
  cleanPeople(data.people).forEach(p => { if (!state.people.some(x => x.id === p.id) && !allPeople().some(x => x.nome.toLowerCase() === p.nome.toLowerCase())) state.people.push(p); });
  cleanItems(data.items).forEach(i => { if (!allItems().some(x => x.id === i.id)) { i.foto = ""; state.items.push(i); n++; } });
  if (Array.isArray(data.done)) data.done.slice(0, 2000).forEach(id => { id = str(id, 60); if (allItems().some(x => x.id === id)) state.done[id] = true; });
  save(); closeSheet(); renderLista(); toast(n + " pedido(s) novo(s)");
}


/* ---------------- ONLINE (clima, cotação, geocodificação, mapa) ----------------
   Todos opcionais: sem internet o app segue com os dados locais. Só domínios
   listados na CSP do index.html. Nenhum dado pessoal além do endereço digitado
   (geocodificação) e das coordenadas (clima) sai do aparelho. */
async function getJSON(url, ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { "Accept": "application/json" } }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
  finally { clearTimeout(t); }
}
function effectiveRate() { return state.rateManual && state.rate ? state.rate : (state.rateAuto || state.rate || D.config.cotacao_padrao || 0); }
async function refreshRate(force) {
  if (!navigator.onLine) return; if (!force && Date.now() - state.rateAt < 12 * 3600e3) return;
  try {
    let v = 0;
    try { const j = await getJSON("https://api.frankfurter.app/latest?from=USD&to=BRL"); v = num(j && j.rates && j.rates.BRL); } catch { /* tenta a alternativa */ }
    if (!v) { const j = await getJSON("https://open.er-api.com/v6/latest/USD"); v = num(j && j.rates && j.rates.BRL); }
    if (v > 1 && v < 20) { state.rateAuto = Math.round(v * 100) / 100; state.rateAt = Date.now(); save(); if (currentView === "lista") renderLista(); }
  } catch { /* fica com a última cotação guardada */ }
}
const WMO = { 0: "céu limpo", 1: "quase limpo", 2: "parcialmente nublado", 3: "nublado", 45: "neblina", 48: "neblina", 51: "garoa", 53: "garoa", 55: "garoa", 56: "garoa gelada", 57: "garoa gelada", 61: "chuva fraca", 63: "chuva", 65: "chuva forte", 66: "chuva gelada", 67: "chuva gelada", 71: "neve", 73: "neve", 75: "neve", 77: "neve", 80: "pancadas de chuva", 81: "pancadas de chuva", 82: "pancadas fortes", 85: "neve", 86: "neve", 95: "tempestade", 96: "tempestade com granizo", 99: "tempestade com granizo" };
function originPoint() { if (state.homeLat != null) return { la: state.homeLat, lo: state.homeLng, n: "casa" }; const r = D.pontos.regioes.find(x => x.id === state.region); if (r) return { la: r.la, lo: r.lo, n: r.n }; return { la: D.config.base_lat || 28.661, lo: D.config.base_lng || -81.39, n: D.config.cidade_base || "casa" }; }
function wxPoint() { if (state.homeLat != null) return { la: state.homeLat, lo: state.homeLng, n: "casa" }; const r = D.pontos.regioes.find(x => x.id === state.region); if (r) return { la: r.la, lo: r.lo, n: r.n }; return { la: D.config.base_lat || 28.661, lo: D.config.base_lng || -81.39, n: D.config.cidade_base || "" }; }
async function refreshWeather(force) {
  if (!navigator.onLine) return; const pt = wxPoint();
  if (!force && state.wx && Date.now() - state.wx.at < 30 * 60e3 && state.wx.la === pt.la) return;
  try {
    const u = "https://api.open-meteo.com/v1/forecast?latitude=" + pt.la + "&longitude=" + pt.lo + "&current=temperature_2m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1";
    const j = await getJSON(u);
    state.wx = { at: Date.now(), la: pt.la, t: Math.round(j.current.temperature_2m), code: j.current.weather_code, uv: Math.round(j.current.uv_index || 0), max: Math.round(j.daily.temperature_2m_max[0]), min: Math.round(j.daily.temperature_2m_min[0]), rain: Math.round(j.daily.precipitation_probability_max[0] || 0), where: pt.n };
    save(); if (currentView === "hoje") renderHoje();
  } catch { /* mantém o último clima guardado */ }
}
function weatherChip() {
  const w = state.wx; if (!w) return null;
  const old = Date.now() - w.at > 3 * 3600e3;
  const txt = w.t + "° · " + (WMO[w.code] || "") + " · máx " + w.max + "° · chuva " + w.rain + "%" + (w.uv >= 8 ? " · sol forte" : "");
  return h("button", { class: "chip info", onClick: () => sheetWeather() }, icon("sun"), txt + (old ? " (antigo)" : ""));
}
function sheetWeather() {
  const w = state.wx; if (!w) return;
  openSheet(h("h2", { text: "Clima em " + (w.where || "Orlando") }), h("div", { class: "bigtext", text: w.t + "°C" }),
    h("p", { text: (WMO[w.code] || "") + ". Máxima " + w.max + "°, mínima " + w.min + "°. Chance de chuva hoje: " + w.rain + "%." + (w.uv >= 8 ? " Índice UV alto: boné e protetor." : "") }),
    h("p", { class: "small muted", text: "Atualizado " + new Date(w.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " (Open-Meteo). Chuva à tarde é comum: leve capa leve." }),
    h("div", { class: "btns" }, h("button", { class: "btn tonal", onClick: () => { refreshWeather(true); closeSheet(); } }, "Atualizar"), closeBtn()));
}
async function geocode(q) {
  q = str(q, 160); if (!q) return null;
  const j = await getJSON("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=" + encodeURIComponent(q), 10000);
  if (!Array.isArray(j) || !j.length) return null;
  const la = coord(j[0].lat, 90), lo = coord(j[0].lon, 180); if (la == null || lo == null) return null;
  return { la, lo, label: str(j[0].display_name, 120) };
}
/* "aberto agora": usa horários por dia (hd) quando existem; senão tenta ler o texto (h) */
function parseRange(txt) { const m = /(\d{1,2})(?:[:h](\d{2}))?\s*[–\-]\s*(\d{1,2})(?:[:h](\d{2}))?/.exec(txt || ""); if (!m) return null; const a = +m[1] * 60 + (+(m[2] || 0)), b = +m[3] * 60 + (+(m[4] || 0)); return { a, b: b <= a ? b + 1440 : b }; }
function openStatus(p) {
  const now = new Date(); const dow = now.getDay(); const cur = now.getHours() * 60 + now.getMinutes();
  let rg = null, approx = false;
  if (Array.isArray(p.hd) && p.hd.length === 7) rg = parseRange(p.hd[dow]); else if (p.h) { rg = parseRange(p.h); approx = true; }
  if (!rg) return null;
  const fmt = m => { m %= 1440; if (m === 0) return "meia-noite"; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const open = cur >= rg.a && cur < rg.b;
  return { open, txt: open ? "Aberto · fecha " + fmt(rg.b) : (cur < rg.a ? "Fechado · abre " + fmt(rg.a) : "Fechado"), approx };
}
function ratingText(p) { if (!p.r) return ""; const v = p.v >= 1000 ? (p.v / 1000).toFixed(1).replace(".0", "").replace(".", ",") + " mil" : String(p.v || ""); return "★ " + String(p.r).replace(".", ",") + (v ? " (" + v + ")" : ""); }
/* mapa (Leaflet vendorizado + OpenStreetMap) */
let map = null, mapLayer = null;
function pinColor(c) { return (c === "outlet" || c === "barg" || c === "mall") ? "#E9A72A" : c === "park" ? "#3AA876" : c === "comida" ? "#D94E2B" : c === "train" ? "#8A94A6" : "#0F4C47"; }
function showMap(container, list) {
  if (!window.L) { container.replaceChildren(h("div", { class: "callout warn", text: "Mapa indisponível neste aparelho." })); return; }
  if (!navigator.onLine) container.appendChild(h("div", { class: "callout warn", text: "Sem internet: o mapa não carrega, mas a lista funciona." }));
  let box = $("#mapbox"); if (!box) { box = h("div", { id: "mapbox", class: "mapbox" }); container.appendChild(box); }
  if (!map) { map = L.map(box, { zoomControl: true, attributionControl: true }); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map); }
  if (mapLayer) mapLayer.remove(); mapLayer = L.layerGroup().addTo(map);
  if (here) L.circleMarker([here.la, here.lo], { radius: 9, color: "#fff", weight: 2, fillColor: "#D94E2B", fillOpacity: 1 }).bindTooltip("Você / ponto de partida").addTo(mapLayer);
  const pts = [];
  list.forEach(p => { const m = L.circleMarker([p.la, p.lo], { radius: 8, color: "#fff", weight: 2, fillColor: pinColor(p.c), fillOpacity: .95 }).addTo(mapLayer); m.bindTooltip(placeName(p)); m.on("click", () => sheetPlace(p)); pts.push([p.la, p.lo]); });
  if (here) pts.push([here.la, here.lo]);
  setTimeout(() => { map.invalidateSize(); if (pts.length) map.fitBounds(pts, { padding: [24, 24], maxZoom: 14 }); }, 50);
}
/* ---------------- configurações ---------------- */
function sheetSettings() {
  const name = h("input", { type: "text", value: state.name, placeholder: "Como quer ser chamada", maxlength: 40 });
  const home = h("input", { type: "text", value: state.home, placeholder: "Endereço da hospedagem (fica só neste celular)", maxlength: 160 });
  const rate = h("input", { type: "number", inputmode: "decimal", step: "0.01", value: state.rateManual ? state.rate : "", placeholder: state.rateAuto ? "Automática: " + String(state.rateAuto).replace(".", ",") : "Ex.: 5,40" });
  const theme = h("select", {}, h("option", { value: "auto", text: "Automático" }), h("option", { value: "light", text: "Claro" }), h("option", { value: "dark", text: "Escuro" })); theme.value = state.theme;
  const geoInfo = h("p", { class: "small muted", text: state.homeLat != null ? "Endereço localizado no mapa ✓ (usado para distâncias e clima)" : "Ao salvar com internet, o endereço é localizado no mapa para calcular distâncias." });
  openSheet(h("h2", { text: "Configurações" }), h("label", { text: "Seu nome" }), name, h("label", { text: "Endereço da casa" }), home, geoInfo, h("label", { text: "Cotação do dólar (R$) — deixe vazio para automática" }), rate, h("label", { text: "Aparência" }), theme,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: async () => {
      state.name = str(name.value, 40); const newHome = str(home.value, 160); const changed = newHome !== state.home; state.home = newHome;
      const r = num(rate.value); state.rateManual = r > 0; if (r > 0) state.rate = r;
      state.theme = theme.value; save(); applyTheme(); closeSheet(); renderHoje(); toast("Salvo");
      if (changed) { state.homeLat = null; state.homeLng = null; save(); }
      if (newHome && state.homeLat == null && navigator.onLine) { try { const g = await geocode(newHome); if (g) { state.homeLat = g.la; state.homeLng = g.lo; save(); toast("Endereço localizado no mapa"); refreshWeather(true); renderPerto(); } else toast("Não achei o endereço no mapa; confira a grafia"); } catch { /* offline ou falha: fica sem coordenadas */ } }
      if (!state.rateManual) refreshRate(true);
    } }, "Salvar"), h("button", { class: "btn", onClick: closeSheet }, "Cancelar")),
    h("h3", { text: "Instalar como app" }), h("p", { class: "small muted", text: "Android/Chrome: menu ⋮ → “Instalar app” (ou “Adicionar à tela inicial”). iPhone/Safari: Compartilhar → “Adicionar à Tela de Início”. Depois disso funciona sem internet." }),
    h("h3", { text: "Privacidade" }), h("p", { class: "small muted", text: "Nome, endereço, cotação, roteiro e lista ficam somente neste aparelho. Com internet, o app consulta três serviços públicos: OpenStreetMap (mapa e localização do endereço), Open-Meteo (clima) e Frankfurter (cotação). Nenhum deles recebe seu nome ou sua lista." }),
    h("div", { class: "btns" }, h("button", { class: "btn danger sm", onClick: () => { if (confirm("Apagar todos os dados guardados neste celular?")) { localStorage.removeItem(KEY); location.reload(); } } }, "Apagar meus dados")),
    h("p", { class: "small muted", text: "Versão dos dados: " + ((D.config && D.config.versao) || "") }));
}
$("#btnSettings").addEventListener("click", sheetSettings);

/* ---------------- PWA ---------------- */
function setupPWA() {
  const off = $("#offline"); const upd = () => off.classList.toggle("show", !navigator.onLine); window.addEventListener("online", upd); window.addEventListener("offline", upd); upd();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const w = reg.installing; w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("Versão nova disponível — feche e abra o app"); }); });
    }).catch(() => {});
  }
}

/* ---------------- início ---------------- */
async function boot() {
  load(); applyTheme();
  try { await loadData(); } catch (e) {
    $("#view-hoje").replaceChildren(h("div", { class: "card" }, h("h2", { text: "Não consegui carregar os dados" }), h("p", { text: "Abra o site uma vez com internet para guardar tudo no celular. Se o problema continuar, avise quem montou o guia." })));
    return;
  }
  $("#brand").firstChild.textContent = D.config.titulo || "Guia"; $("#brandSub").textContent = D.config.subtitulo || ""; document.title = D.config.titulo || "Guia";
  renderHoje(); renderPerto(); renderLojas(); renderDicas(); renderLista();
  go(location.hash.replace("#", "") || "hoje", false);
  setupPWA(); autoGeoHoje();
  refreshRate(false); refreshWeather(false); setTimeout(prefetchPhotos, 1500);
  window.addEventListener("online", () => { refreshRate(false); refreshWeather(false); });
  if (!state.name && !sessionStorage.getItem("hello")) { sessionStorage.setItem("hello", "1"); setTimeout(sheetSettings, 400); }
}
boot();
})();
