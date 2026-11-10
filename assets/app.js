/* Guia de Viagem — app.js
   Regras de segurança adotadas neste arquivo:
   - Nenhum innerHTML com dados; tudo é construído via DOM (h()).
   - Texto curado aceita só **negrito** e _itálico_ (rich()); nunca HTML.
   - Links externos só http(s) (safeUrl) e sempre rel="noopener noreferrer".
   - Dados importados (texto colado) passam por validação de esquema e limites.
   - Fotos só data:image/* e com tamanho máximo. */
(() => {
"use strict";
try { if (window.top !== window.self) { window.top.location = window.location; } } catch { document.documentElement.style.display = "none"; }

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
function safeImg(u) {
  if (typeof u !== "string") return null;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 300000) return u;
  try { const x = new URL(u, location.href); return x.origin === location.origin && x.pathname.includes("/assets/logos/") ? x.href : null; } catch { return null; }
}
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
const state = { name: "", home: "", homeLat: null, homeLng: null, rate: 0, rateAuto: 0, rateAt: 0, rateManual: false, pos: null, tax: 0.07, theme: "auto", region: "", tripStart: "", tripEnd: "", routeDate: "", routeOrder: {}, plan: [], people: [], items: [], done: {}, wx: null, agenda: [] };
function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return;
    const o = JSON.parse(raw); if (!o || typeof o !== "object") return;
    state.name = str(o.name, 40); state.home = str(o.home, 160); state.rate = num(o.rate); state.rateAuto = num(o.rateAuto); state.rateAt = num(o.rateAt); state.rateManual = o.rateManual === true;
    state.homeLat = coord(o.homeLat, 90); state.homeLng = coord(o.homeLng, 180); state.wx = (o.wx && typeof o.wx === "object") ? o.wx : null; state.pos = (o.pos && coord(o.pos.la, 90) != null && coord(o.pos.lo, 180) != null) ? { la: o.pos.la, lo: o.pos.lo, at: num(o.pos.at) } : null; state.tax = [0.065, 0.07, 0.075].includes(o.tax) ? o.tax : 0.07;
    state.theme = ["auto", "light", "dark"].includes(o.theme) ? o.theme : "auto"; state.region = str(o.region, 10);
    state.tripStart = ISO.test(str(o.tripStart, 10)) ? str(o.tripStart, 10) : ""; state.tripEnd = ISO.test(str(o.tripEnd, 10)) ? str(o.tripEnd, 10) : "";
    state.routeDate = ISO.test(str(o.routeDate, 10)) ? str(o.routeDate, 10) : ""; state.routeOrder = cleanRouteOrder(o.routeOrder);
    state.agenda = cleanAgenda(o.agenda);
    state.plan = cleanPlan(o.plan); state.people = cleanPeople(o.people); state.items = cleanItems(o.items);
    state.done = {}; if (o.done && typeof o.done === "object") for (const k of Object.keys(o.done).slice(0, 2000)) if (o.done[k] === true) state.done[str(k, 60)] = true;
    loadTrip(o);
    state.stores = cleanStores(o.stores);
  } catch { /* dados corrompidos: começa do zero */ }
}
function save() {
  try {
    let json = JSON.stringify(state);
    if (json.length > 3.5e6) { state.items.forEach(i => { if (i.foto) i.foto = ""; }); json = JSON.stringify(state); toast("Fotos locais removidas para liberar espaço"); }
    localStorage.setItem(KEY, json);
    queueTripSync();
  } catch { toast("Não consegui salvar (memória cheia?)"); }
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function cleanAgenda(a) {
  return Array.isArray(a) ? a.slice(0, 300).filter(x => x && typeof x === "object").map(x => {
    const time = validTime(x.time) ? x.time : "";
    return { d: tripDate(x.d), k: ["ev", "pl", "nota", "custom"].includes(x.k) ? x.k : "nota",
      id: str(x.id, 90), n: str(x.n, 160), a: str(x.a, 200), locId: str(x.locId, 80),
      time, minutes: tripMinutes(x.minutes), fixed: !!time && x.fixed === true };
  }).filter(x => ISO.test(x.d) && x.n) : [];
}
function cleanRouteOrder(o) { const out = {}; if (!o || typeof o !== "object") return out; Object.entries(o).slice(0, 60).forEach(([d, ids]) => { if (ISO.test(d) && Array.isArray(ids)) out[d] = ids.slice(0, 40).map(x => str(x, 100)).filter(Boolean); }); return out; }
function cleanPlan(a) { return Array.isArray(a) ? a.slice(0, 60).map(s => ({ id: str(s.id, 80), n: str(s.n, 120), a: str(s.a, 200), d: ISO.test(str(s.d, 10)) ? str(s.d, 10) : agendaToday() })).filter(s => s.id && s.n) : []; }
function cleanPeople(a) { return Array.isArray(a) ? a.slice(0, 50).map(p => ({ id: str(p.id, 40), nome: str(p.nome, 60), tam: str(p.tam, 500) })).filter(p => p.id && p.nome) : []; }
function cleanItems(a) {
  return Array.isArray(a) ? a.slice(0, 500).map(i => ({ id: str(i.id, 40), pessoa: str(i.pessoa, 40), nome: str(i.nome, 120), loja: str(i.loja, 80), cor: str(i.cor, 40), tam: str(i.tam, 40), preco: num(i.preco), link: safeUrl(i.link) || "", obs: str(i.obs, 300), onde: str(i.onde, 160), fotoUrl: safeUrl(i.fotoUrl) || "", foto: safeImg(i.foto) || "" })).filter(i => i.id && i.nome) : [];
}
function applyTheme() { const r = document.documentElement; if (state.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", state.theme); }

/* ---------------- dados curados (data/*.json) ---------------- */
const D = {};
async function loadData() {
  const files = ["config", "descontos", "lojas", "lugares", "dicas", "pontos", "frases", "tamanhos", "pedidos", "eventos"];
  const emb = document.getElementById("data-embed");
  if (emb) { const all = JSON.parse(emb.textContent); files.forEach(f => { if (!all[f]) throw new Error(f); D[f] = all[f]; }); return; }
  const res = await Promise.all(files.map(f => fetch("data/" + f + ".json", { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(f); return r.json(); })));
  files.forEach((f, i) => D[f] = res[i]);
}

/* ---------------- navegação ---------------- */
let currentView = "viagem";
function go(view, push = true) {
  if (!document.getElementById("view-" + view)) view = "viagem";
  currentView = view;
  $$(".view").forEach(v => v.classList.toggle("active", v.dataset.view === view));
  const tab = ["lojas", "dicas", "hoje"].includes(view) ? "explorar" : ["reservas", "gastos", "familia"].includes(view) ? "viagem" : view;
  $$("#nav button").forEach(b => {
    const active = b.dataset.go === tab;
    b.classList.toggle("on", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (D.config) renderTripView(view);
  if (view === "perto" && D.pontos) renderPerto();
  if (view === "agenda" && D.eventos) renderAgenda();
  if (view === "lojas" && D.pontos) renderLojas();
  if (view === "hoje" && D.pontos) { renderHoje(); autoGeoHoje(); }
  if (push && location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  window.scrollTo({ top: 0 });
}
$("#nav").addEventListener("click", e => { const b = e.target.closest("button[data-go]"); if (b) go(b.dataset.go); });
window.addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", window.scrollY > 8), { passive: true });

/* ---------------- bottom sheet ---------------- */
const scrim = $("#scrim"), sheet = $("#sheet");
let sheetOpen = false, sheetCleanup = null, sheetTrigger = null;
function openSheet(...nodes) {
  if (!sheetOpen) sheetTrigger = document.activeElement;
  if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; }
  sheet.replaceChildren(h("div", { class: "sheethead" }, h("div", { class: "handle" }), h("button", { class: "iconbtn close", "aria-label": "Fechar", onClick: () => closeSheet() }, icon("x"))), ...nodes.flat().filter(node => node != null && node !== false));
  scrim.classList.add("open"); sheet.scrollTop = 0; document.body.classList.add("noscroll");
  const heading = $("h2, h1", sheet);
  if (heading) {
    heading.id = "sheet-title";
    sheet.setAttribute("aria-labelledby", heading.id);
    sheet.removeAttribute("aria-label");
  } else {
    sheet.removeAttribute("aria-labelledby");
    sheet.setAttribute("aria-label", "Detalhes");
  }
  if (!sheetOpen) { sheetOpen = true; try { history.pushState({ sheet: true }, ""); } catch { /* sem histórico */ } }
  $(".close", sheet).focus({ preventScroll: true });
}
function closeSheet(fromHistory) {
  if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; }
  scrim.classList.remove("open"); document.body.classList.remove("noscroll");
  if (sheetOpen && !fromHistory) { sheetOpen = false; try { if (history.state && history.state.sheet) history.back(); } catch { /* ignora */ } }
  sheetOpen = false;
  if (sheetTrigger?.isConnected) sheetTrigger.focus({ preventScroll: true });
  sheetTrigger = null;
}
scrim.addEventListener("click", e => { if (e.target === scrim) closeSheet(); });
document.addEventListener("keydown", e => {
  if (!sheetOpen) return;
  if (e.key === "Escape") { closeSheet(); return; }
  if (e.key !== "Tab") return;
  const controls = $$("button, a[href], input, select, textarea, summary, [tabindex]", sheet)
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if (!sheet.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
});
window.addEventListener("popstate", () => { if (scrim.classList.contains("open")) { closeSheet(true); return; } go(location.hash.replace("#", "") || "viagem", false); });
const closeBtn = () => h("button", { class: "btn block", onClick: () => closeSheet() }, "Fechar");
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
  const lu = lotacao("universal", isoDate(now)); if (lu) chips.appendChild(h("button", { class: "chip " + lu.cls, onClick: () => { agSel = isoDate(now); go("agenda"); } }, icon("park"), "Universal hoje " + lu.v + "% · " + lu.lab));
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
    const near = allPlaces().filter(placeHasCoordinates).map(p => Object.assign({}, p, { km: kmBetween(origin.la, origin.lo, p.la, p.lo) })).filter(p => p.km <= (origin.gps ? 8 : 15) && p.c !== "train").sort((a, b) => a.km - b.km);
    const open = near.filter(p => p.c !== "park" && (openStatus(p) || {}).open).sort((a, b) => (b.r || 0) - (a.r || 0) || a.km - b.km).slice(0, 4);
    const show = open.length ? open : near.slice(0, 4);
    v.appendChild(h("h3", { text: origin.gps ? "Perto de você agora · " + origin.n : "Perto de " + origin.n }));
    const list = h("div", { class: "list nowbox" });
    if (!origin.gps) list.appendChild(h("button", { class: "row", onClick: useGeoHoje }, h("span", { class: "ico" }, icon("nav")), h("span", { class: "t" }, h("b", { text: "Usar onde estou agora" }), h("span", { text: "Mostra o que tem perto de você pelo GPS" })), icon("chev", "chev")));
    show.forEach(p => { const st = openStatus(p); list.appendChild(h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon(p.c === "park" ? "park" : p.c === "comida" ? "fork" : "bag")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { class: st && !st.open ? "closed" : "", text: [ratingText(p), st ? st.txt : ""].filter(Boolean).join(" · ") || p.a })), h("span", { class: "km", text: p.km.toFixed(1).replace(".", ",") + " km" }), icon("chev", "chev"))); });
    list.appendChild(h("button", { class: "row", onClick: () => { if (origin.gps) here = { la: origin.la, lo: origin.lo, label: "onde você está" }; go("perto"); } }, h("span", { class: "ico" }, icon("pin")), h("span", { class: "t" }, h("b", { text: "Ver tudo o que tem perto" })), icon("chev", "chev")));
    v.appendChild(list);
  }
  // agenda de hoje
  const hojeISO = isoDate(now), meus = state.agenda.filter(x => x.d === hojeISO), evs = eventosDoDia(hojeISO);
  v.appendChild(h("h3", { text: "Hoje na agenda" }));
  const ag = h("div", { class: "list" });
  meus.forEach(x => ag.appendChild(h("button", { class: "row", onClick: () => { agSel = hojeISO; go("agenda"); } }, h("span", { class: "ico" }, icon(x.k === "ev" ? "cal" : x.k === "pl" ? "pin" : "list")), h("span", { class: "t" }, h("b", { text: x.n }), h("span", { text: x.a || "Programado por você" })), icon("chev", "chev"))));
  ag.appendChild(h("button", { class: "row", onClick: () => { agSel = hojeISO; go("agenda"); } }, h("span", { class: "ico" }, icon("cal")), h("span", { class: "t" }, h("b", { text: evs.length ? evs.length + (evs.length === 1 ? " evento hoje" : " eventos hoje") : "Ver a agenda da semana" }), h("span", { text: evs.length ? evs.slice(0, 3).map(e => e.t).join(" · ") : "Natal, shows, jogos e passeios" })), icon("chev", "chev")));
  v.appendChild(ag);
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
  const dollars = h("div", { class: "small" });
  const reais = h("div", { class: "bigtext" });
  const rate = h("input", { type: "number", inputmode: "decimal", min: "0.01", step: "0.01", value: effectiveRate() || "", placeholder: "Ex.: 5,40" });
  const usd = h("input", { type: "number", inputmode: "decimal", min: "0", step: "0.01", placeholder: "0,00" });
  const src = state.rateManual ? "Usando a cotação definida por você." : state.rateAt ? "Cotação consultada em " + new Date(state.rateAt).toLocaleDateString("pt-BR") + ". Edite para usar outra." : "Edite a cotação para usar a do seu cartão ou casa de câmbio.";
  const tax = h("select", {}, h("option", { value: "0.065", text: "Orange · Orlando / I-Drive (6,5%)" }), h("option", { value: "0.07", text: "Seminole / Miami-Dade (7%)" }), h("option", { value: "0.075", text: "Osceola · Kissimmee (7,5%)" }));
  tax.value = String(state.tax);
  const calc = () => {
    const amount = usd.valueAsNumber, exchange = num(rate.value);
    const total = amount >= 0 ? Math.round(amount * (1 + Number(tax.value)) * 100) / 100 : NaN;
    dollars.textContent = Number.isFinite(total) ? money(total) : "Informe o preço da etiqueta";
    reais.textContent = Number.isFinite(total) && exchange ? brl(total * exchange) : "—";
  };
  [rate, usd, tax].forEach(el => el.addEventListener("input", calc));
  tax.addEventListener("change", () => { state.tax = Number(tax.value); save(); calc(); });
  rate.addEventListener("change", () => {
    const exchange = num(rate.value);
    if (exchange) { state.rate = exchange; state.rateManual = true; save(); }
    calc();
  });
  calc();
  openSheet(h("h2", { text: "Conversor com imposto" }), tripField("Preço na etiqueta (US$)", usd),
    tripField("Local da compra (imposto)", tax), tripField("Cotação do dólar (R$)", rate), h("p", { class: "small muted", text: src }),
    h("div", { class: "card flat converter-result", role: "status" }, h("b", { text: "Total estimado com imposto" }), reais, dollars),
    h("p", { class: "small muted", text: "O imposto é cobrado no caixa. A conversão usa a cotação acima e não inclui tarifas do cartão." }), closeBtn());
}


/* ---------------- AGENDA (eventos + programação dela) ---------------- */
const CATS = { natal: "Natal e luzes", parque: "Festas nos parques", esporte: "Esportes", show: "Shows e teatro", gratis: "Grátis", feira: "Feiras", compras: "Compras e promoções", batevolta: "Bate-volta de carro", tampa: "Tampa e região" };
const CATC = { natal: "coral", parque: "sun", esporte: "sky", show: "sky", gratis: "leaf", feira: "leaf", compras: "sun", batevolta: "sky", tampa: "gray" };
function isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDia(s, opt) { return parseISO(s).toLocaleDateString("pt-BR", opt || { weekday: "short", day: "numeric", month: "short" }).replace(".", ""); }
function eventosDoDia(iso) {
  const dow = parseISO(iso).getDay();
  return ((D.eventos && D.eventos.eventos) || []).filter(e => e.ini <= iso && iso <= e.fim && (!Array.isArray(e.dow) || e.dow.includes(dow)) && !(e.exceto || []).includes(iso));
}
function lotacao(parque, iso) {
  const L = D.eventos && D.eventos.lotacao && D.eventos.lotacao[parque]; const v = L && L.dias && L.dias[iso]; if (v == null) return null;
  return v >= 70 ? { v, lab: "muito alta", cls: "accent" } : v >= 66 ? { v, lab: "alta", cls: "accent" } : v >= 60 ? { v, lab: "moderada", cls: "sun" } : { v, lab: "baixa", cls: "ok" };
}
let agSel = "", agCat = "";
function agendaToday() { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate())); }
function setAgendaDate(iso) { if (ISO.test(iso)) { agSel = iso; renderAgenda(); } }
function agRange() {
  const center = parseISO(agSel || state.tripStart || agendaToday());
  const days = [];
  for (let i = -3; i <= 10; i++) { const d = new Date(center); d.setDate(d.getDate() + i); days.push(isoDate(d)); }
  return days;
}
function renderAgenda() {
  const v = $("#view-agenda"); v.replaceChildren(h("h2", { text: "Agenda" }), h("p", { class: "small muted", text: "Escolha o dia e veja o que tem para fazer. Toque num evento para programar." }));
  if (!agSel) agSel = state.tripStart || agendaToday();
  const datePicker = h("input", { class: "agenda-date", type: "date", value: agSel, "aria-label": "Ir para uma data", onChange: () => setAgendaDate(str(datePicker.value, 10)) });
  const previous = () => { const d = parseISO(agSel); d.setDate(d.getDate() - 7); setAgendaDate(isoDate(d)); };
  const next = () => { const d = parseISO(agSel); d.setDate(d.getDate() + 7); setAgendaDate(isoDate(d)); };
  v.appendChild(h("div", { class: "agenda-controls" },
    h("button", { class: "iconbtn agenda-arrow", "aria-label": "Semana anterior", onClick: previous }, "‹"),
    datePicker,
    h("button", { class: "btn sm tonal agenda-today", onClick: () => setAgendaDate(agendaToday()) }, "Hoje"),
    h("button", { class: "iconbtn agenda-arrow", "aria-label": "Próxima semana", onClick: next }, "›")));
  const days = agRange();
  const strip = h("div", { class: "days", role: "tablist" });
  days.forEach(iso => {
    const d = parseISO(iso), n = eventosDoDia(iso).length, mine = state.agenda.some(x => x.d === iso) || state.plan.some(x => x.d === iso), lu = lotacao("universal", iso);
    const b = h("button", { class: "day" + (iso === agSel ? " on" : "") + (d.getDay() === 0 || d.getDay() === 6 ? " we" : ""), "aria-selected": iso === agSel ? "true" : "false", onClick: () => { agSel = iso; renderAgenda(); } },
      h("span", { class: "w", text: DIAS_C[d.getDay()] }), h("span", { class: "n", text: String(d.getDate()) }), h("span", { class: "m", text: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") }),
      h("span", { class: "dots" }, n ? h("i", { class: "dot y" }) : null, mine ? h("i", { class: "dot g" }) : null, lu && lu.v >= 60 ? h("i", { class: "dot r" }) : null));
    strip.appendChild(b);
  });
  v.appendChild(strip);
  setTimeout(() => { const on = $(".day.on", strip); if (on) strip.scrollLeft = on.offsetLeft - 16; }, 0);
  // cabeçalho do dia
  const sel = parseISO(agSel);
  v.appendChild(h("h3", { text: cap(sel.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })) }));
  const info = h("div", { class: "chips" });
  const lu = lotacao("universal", agSel); if (lu) info.appendChild(h("span", { class: "chip " + lu.cls }, "Universal " + lu.v + "% · " + lu.lab));
  const pw = D.descontos.parques_semana[String(sel.getDay())]; if (pw) { const cls = { "🟢": "g", "🔵": "b", "🟡": "y", "🔴": "r" }; ["Magic Kingdom", "EPCOT", "Animal Kingdom", "Hollywood"].forEach((n, i) => info.appendChild(h("button", { class: "chip", onClick: sheetParksWeek }, h("i", { class: "dot " + (cls[pw[i]] || "y") }), n))); }
  const se = D.descontos.senior.filter(s => s.dia === sel.getDay() && (!s.first || sel.getDate() <= 7)); se.forEach(s => info.appendChild(h("span", { class: "chip sun" }, s.loja + " " + s.desc)));
  v.appendChild(info);
  v.appendChild(dayTimeline(agSel));
  // eventos do dia
  const allEvs = eventosDoDia(agSel);
  let evs = allEvs.slice();
  const cats = [...new Set(evs.map(e => e.cat))];
  if (agCat && !cats.includes(agCat) && !(agCat === "gratis")) agCat = "";
  const filterBox = h("div", { class: "filters agenda-filters" });
  const list = h("div", { class: "list", id: "agenda-events" });
  const renderEvents = () => {
    let filtered = allEvs.slice();
    if (agCat === "gratis") filtered = filtered.filter(e => e.gratis); else if (agCat) filtered = filtered.filter(e => e.cat === agCat);
    const order = ["compras", "feira", "gratis", "natal", "parque", "batevolta", "esporte", "show", "tampa"];
    filtered.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat) || (a.fim.localeCompare(b.fim)));
    list.replaceChildren();
    if (!filtered.length) list.appendChild(h("div", { class: "empty" }, h("b", { text: "Nenhum evento cadastrado neste dia." }), h("p", { class: "small muted", text: "Pode ser um bom dia para compras, parque ou uma anotação sua." }), h("button", { class: "btn sm tonal", onClick: () => go("lista") }, icon("bag"), "Abrir lista de compras")));
    filtered.forEach(e => { const on = state.agenda.some(x => x.d === agSel && x.id === e.id);
      list.appendChild(h("button", { class: "row", onClick: () => sheetEvento(e) }, h("span", { class: "ico" }, icon(e.cat === "esporte" ? "sale" : e.cat === "compras" ? "bag" : e.cat === "parque" ? "park" : e.cat === "feira" ? "fork" : "cal")),
        h("span", { class: "t" }, h("b", { text: e.t }), h("span", { text: [e.hora, e.onde, e.gratis ? "grátis" : "", e.ini !== e.fim ? "até " + fmtDia(e.fim, { day: "numeric", month: "short" }) : ""].filter(Boolean).join(" · ") })),
        on ? h("span", { class: "badge leaf", text: "no meu dia" }) : e.previsto ? h("span", { class: "badge gray", text: "previsto" }) : h("span", { class: "badge " + (CATC[e.cat] || "gray"), text: (CATS[e.cat] || "").split(" ")[0] }), icon("chev", "chev"))); });
  };
  if (evs.length) {
    const chip = (lab, val) => h("button", { class: "chip" + (!val ? " on" : ""), onClick: () => { agCat = val === "gratis" && agCat === val ? "" : (agCat === val ? "" : val); $$(".chip", filterBox).forEach(b => b.classList.toggle("on", b.dataset.cat === agCat)); renderEvents(); } }, lab);
    const addChip = (lab, val) => { const b = chip(lab, val); b.dataset.cat = val; b.classList.toggle("on", agCat === val); filterBox.appendChild(b); };
    addChip("Todos (" + evs.length + ")", ""); addChip("Grátis", "gratis"); cats.filter(c => c !== "gratis").forEach(c => addChip(CATS[c] || c, c));
    v.appendChild(filterBox);
  }
  renderEvents();
  v.appendChild(list);
  // meus planos (todos)
  const programados = state.agenda.slice().sort((a, b) => a.d.localeCompare(b.d));
  if (programados.length) {
    v.appendChild(h("h3", { text: "Tudo o que programei" }));
    v.appendChild(h("div", { class: "list" }, ...programados.map(x => h("button", { class: "row", onClick: () => { agSel = x.d; renderAgenda(); window.scrollTo({ top: 0 }); } }, h("span", { class: "badge gray", text: fmtDia(x.d, { day: "2-digit", month: "2-digit" }) }), h("span", { class: "t" }, h("b", { text: x.n }), h("span", { text: x.a || "" })), icon("chev", "chev")))));
  }
  const fontes = [...new Set(((D.eventos && D.eventos.eventos) || []).map(e => e.fonte).filter(Boolean))];
  v.appendChild(h("p", { class: "src", text: "Fontes: " + fontes.join(" · ") + ". Datas e horários podem mudar: confira no site oficial antes de ir." }));
}
function gcalLink(e, iso) {
  const d0 = (iso || e.ini).replace(/-/g, ""); const nx = parseISO(iso || e.ini); nx.setDate(nx.getDate() + 1); const d1 = isoDate(nx).replace(/-/g, "");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.t) + "&dates=" + d0 + "/" + d1 + "&location=" + encodeURIComponent(e.onde || "") + "&details=" + encodeURIComponent((e.desc || "") + (e.hora ? " Horário: " + e.hora : ""));
}
function sheetEvento(e) {
  const iso = agSel || e.ini; const on = state.agenda.some(x => x.d === iso && x.id === e.id);
  const periodo = e.ini === e.fim ? cap(fmtDia(e.ini, { weekday: "long", day: "numeric", month: "long" })) : "De " + fmtDia(e.ini, { day: "numeric", month: "short" }) + " a " + fmtDia(e.fim, { day: "numeric", month: "short", year: "numeric" }) + (Array.isArray(e.dow) ? " · só " + e.dow.map(x => DIAS[x].toLowerCase() + "s").join(", ") : "");
  openSheet(h("h2", { text: e.t }), h("div", { class: "tags" }, h("span", { class: "badge " + (CATC[e.cat] || "gray"), text: CATS[e.cat] || e.cat }), e.gratis ? h("span", { class: "badge leaf", text: "Grátis" }) : null, e.preco ? h("span", { class: "badge gray", text: e.preco }) : null),
    h("p", {}, h("b", { text: periodo })), e.hora ? h("p", { class: "small", text: "Horário: " + e.hora }) : null, h("p", { class: "small muted", text: "Onde: " + e.onde }),
    e.desc ? h("p", { html: e.desc }) : null,
    e.previsto ? h("div", { class: "callout warn small", text: "Data prevista com base em anos anteriores: a loja ainda não confirmou. Confira no app da loja antes de ir." }) : null,
    e.cat === "compras" && e.q && !/online|\.com/i.test(e.onde) ? h("button", { class: "btn sm tonal", onClick: () => { closeSheet(); go("perto"); setTimeout(() => planAddr(e.q), 50); } }, icon("pin"), "Lojas desta rede perto de mim") : null,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: () => { if (on) { state.agenda = state.agenda.filter(x => !(x.d === iso && x.id === e.id)); toast("Removido do dia"); } else { state.agenda.push({ d: iso, k: "ev", id: e.id, n: e.t, a: [e.hora, e.onde].filter(Boolean).join(" · ") }); toast("Programado para " + fmtDia(iso, { day: "numeric", month: "short" })); } save(); closeSheet(); if (currentView === "agenda") renderAgenda(); } }, icon(on ? "x" : "plus"), on ? "Tirar do meu dia" : "Programar para " + fmtDia(iso, { day: "numeric", month: "short" })),
      e.q ? h("a", { class: "btn", href: mapsDir(e.q) }, icon("nav"), "Como chegar") : null, h("a", { class: "btn sm", href: gcalLink(e, iso) }, "Google Agenda")),
    e.fonte ? h("div", { class: "src", text: "Fonte: " + e.fonte + ". Confira no site oficial antes de ir." }) : null, closeBtn());
}
function sheetProgramarLugar(p) {
  const tomorrow = parseISO(agendaToday()); tomorrow.setDate(tomorrow.getDate() + 1);
  const di = h("input", { type: "date", value: currentRouteDate(), "aria-label": "Data da programação" });
  const choose = d => { di.value = d; };
  openSheet(h("h2", { text: "Adicionar ao meu dia" }), h("p", { class: "muted", text: placeName(p) }), h("p", { class: "small muted", text: "O lugar aparecerá na Agenda e no roteiro da data escolhida." }),
    h("div", { class: "btns" }, h("button", { class: "btn tonal", onClick: () => choose(agendaToday()) }, "Hoje"), h("button", { class: "btn tonal", onClick: () => choose(isoDate(tomorrow)) }, "Amanhã")),
    h("label", { text: "Ou escolha uma data" }), di,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: () => { const d = str(di.value, 10), id = placeId(p); if (!ISO.test(d)) { toast("Escolha um dia"); return; } if (routeStops(d).some(s => s.pId === id || s.id === id)) { toast("Esse lugar já está programado nesse dia"); return; } state.agenda.push({ d, k: "pl", id, n: placeName(p), a: p.a }); state.routeDate = d; agSel = d; save(); closeSheet(); if (currentView === "perto") { renderPerto(); const results = $(".near-results"); if (results) results.open = false; window.scrollTo({ top: 0, behavior: "smooth" }); } else if (currentView === "agenda") renderAgenda(); toast("Adicionado à programação de " + fmtDia(d, { day: "numeric", month: "short" })); } }, icon("cal"), "Adicionar à programação"), h("button", { class: "btn", onClick: () => closeSheet() }, "Cancelar")));
}

/* ---------------- LOJAS (redes · lugares · parques · miami) ---------------- */
let seg = "compras", query = "", storeQuery = "";
const BRAND_LOGOS = { "Nike": "nike", "adidas": "adidas", "Tommy Hilfiger": "tommyhilfiger", "The North Face": "thenorthface", "Vans": "vans", "Gap": "gap", "New Balance": "newbalance", "ASICS": "asics", "Oakley": "oakley" };
function brandVisual(m) { const slug = BRAND_LOGOS[m]; return slug ? h("img", { class: "brand-logo", src: "assets/logos/" + slug + ".svg", alt: m, loading: "lazy" }) : h("span", { class: "brand-wordmark", text: m }); }
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
  v.append(h("h1", { text: "Lojas e lugares" }),
    h("p", { class: "small muted", text: "Encontre um endereço no guia ou cadastre suas próprias lojas." }),
    h("div", { class: "btns store-actions" }, tripButton("Adicionar loja", "plus", sheetAddStore, "primary")));
  const options = [["compras", "Compras"], ["minhas", "Minhas lojas"], ["redes", "Redes"], ["lugares", "Regiões"], ["parques", "Parques"], ["miami", "Miami"]];
  const sg = h("div", { class: "seg store-tabs", role: "group", "aria-label": "Categorias de lojas e lugares" },
    ...options.map(([k, label]) => h("button", { class: k === seg ? "on" : "", dataset: { storeTab: k }, "aria-pressed": String(k === seg),
      onClick: () => { if (seg !== k) storeQuery = ""; seg = k; renderLojas(); $("[data-store-tab='" + k + "']", v)?.focus({ preventScroll: true }); } }, label)));
  v.appendChild(sg);
  if (seg === "compras" || seg === "minhas") {
    const localOnly = seg === "minhas";
    const results = h("div");
    const input = h("input", { type: "search", placeholder: "Nome ou endereço", value: storeQuery,
      "aria-label": localOnly ? "Buscar nas minhas lojas" : "Buscar lojas e shoppings", onInput: e => { storeQuery = e.target.value; update(); } });
    function update() {
      if (localOnly || storeQuery.trim()) renderStoreResults(results, storeQuery, localOnly);
      else { results.replaceChildren(); renderCompras(results); }
    }
    v.append(h("div", { class: "search" }, icon("search"), input), results);
    update();
    return;
  }
  const inp = h("input", { type: "search", "aria-label": "Filtrar lugares", placeholder: seg === "redes" ? "Filtrar: tênis, casa, bebê…" : "Filtrar lugares…", value: query, onInput: e => { query = e.target.value; renderLojaList(listBox); } });
  v.appendChild(h("div", { class: "search" }, icon("search"), inp));
  if (seg === "parques") v.appendChild(h("button", { class: "btn tonal block", onClick: sheetParksWeek }, icon("park"), "Qual parque em cada dia da semana"));
  const listBox = h("div"); v.appendChild(listBox); renderLojaList(listBox);
}

function placeRow(p, origin) {
  const t = D.pontos.tipos[p.c] || {}; const st = openStatus(p); const np = pendentes(pedidosPonto(p)).length;
  const km = origin ? kmBetween(origin.la, origin.lo, p.la, p.lo) : null;
  const sub = [ratingText(p), st ? st.txt : "", np ? np + (np === 1 ? " pedido" : " pedidos") : "", p.cupom ? "cupons" : ""].filter(Boolean).join(" · ") || t.b || p.a;
  return h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon(p.c === "comida" ? "fork" : p.c === "walmart" || p.c === "target" ? "tag" : "bag")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { class: st && !st.open ? "closed" : "", text: sub })), km != null ? h("span", { class: "km", text: km.toFixed(km < 10 ? 1 : 0).replace(".", ",") + " km" }) : null, icon("chev", "chev"));
}
function sheetMarca(m) {
  const origin = originPoint();
  const ls = D.pontos.pontos.filter(p => p.marca === m).map(p => Object.assign({}, p, { km: origin ? kmBetween(origin.la, origin.lo, p.la, p.lo) : 0 })).sort((a, b) => (a.c === "clearance" ? 0 : 1) - (b.c === "clearance" ? 0 : 1) || a.km - b.km);
  const nota = (D.pontos.marcas || {})[m];
  openSheet(h("h2", { text: m }), nota ? h("div", { class: "callout ok", html: nota }) : null,
    h("div", { class: "list" }, ...ls.map(p => { const st = openStatus(p); return h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon(p.c === "clearance" ? "tag" : "bag")),
      h("span", { class: "t" }, h("b", { text: (p.c === "clearance" ? "Clearance · " : "") + placeName(p).replace(/^.*? — /, "") }), h("span", { text: p.a.split(",")[0] + " · " + [ratingText(p), st ? st.txt : ""].filter(Boolean).join(" · ") })),
      origin ? h("span", { class: "km", text: p.km.toFixed(p.km < 10 ? 1 : 0).replace(".", ",") + " km" }) : null, icon("chev", "chev")); })),
    pedidosSection(pedidosPara([m]), () => sheetMarca(m)),
    h("p", { class: "src", text: "Endereços e notas do Google Maps (nov/2026). Toque numa loja para ver como chegar." }), closeBtn());
}
function regiaoDe(p) { const r = nearestRegion(p.la, p.lo); return r ? r.n.split(" / ")[0] : ""; }
function renderCompras(v) {
  const origin = originPoint();
  v.appendChild(h("div", { class: "callout info small" }, h("b", { text: "Ordem que economiza: " }), "clearance (Ross, T.J. Maxx, Nike Clearance) → departamento (Macy’s, Kohl’s) → Walmart/Target → outlets → shoppings."));
  const P = D.pontos.pontos;
  // marcas
  const marcas = [...new Set(P.filter(p => p.marca).map(p => p.marca))];
  v.appendChild(h("h3", { text: "Marcas: onde fica cada loja" }));
  v.appendChild(h("div", { class: "brands" }, ...marcas.map(m => h("button", { class: "brand", "aria-label": "Ver lojas " + m, title: m, onClick: () => sheetMarca(m) }, brandVisual(m)))));
  // clearance perto
  const CLR = ["ross", "tjmaxx", "th", "marshalls", "mh", "burlington", "nrack", "bealls", "clearance", "homesense"];
  const perto = P.filter(p => CLR.includes(p.c) && p.la > 27.5).map(p => Object.assign({}, p, { km: origin ? kmBetween(origin.la, origin.lo, p.la, p.lo) : 0 })).sort((a, b) => a.km - b.km).slice(0, 8);
  v.appendChild(h("h3", { text: "Lojas de clearance mais perto" + (origin ? " de " + origin.n : "") }));
  v.appendChild(h("div", { class: "list" }, ...perto.map(p => { const r = placeRow(p, origin); $(".t span", r).textContent = p.a.split(",").slice(0, 2).join(",") + " · " + ($(".t span", r).textContent || ""); return r; }),
    h("button", { class: "row", onClick: () => { nf.type = "loja"; go("perto"); } }, h("span", { class: "ico" }, icon("pin")), h("span", { class: "t" }, h("b", { text: "Ver todas no mapa" })), icon("chev", "chev"))));
  const cup = P.filter(p => p.cupom);
  v.appendChild(h("h3", { text: "Livros de cupons — onde pegar" }));
  v.appendChild(h("div", { class: "list" }, ...cup.map(p => h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon("gift")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { text: p.cupom })), icon("chev", "chev")))));
  const centros = P.filter(p => ["outlet", "barg", "mall"].includes(p.c) && p.la > 27.5).map(p => Object.assign({}, p, { km: origin ? kmBetween(origin.la, origin.lo, p.la, p.lo) : 0 })).sort((a, b) => a.km - b.km);
  v.appendChild(h("h3", { text: "Outlets e centros de compras" + (origin ? " · mais perto de " + origin.n : "") }));
  v.appendChild(h("div", { class: "list" }, ...centros.map(p => placeRow(p, origin))));
  const melhores = (c, min) => P.filter(p => p.c === c && p.r && (p.v || 0) >= min && p.la > 27.5).sort((a, b) => b.r - a.r || (b.v || 0) - (a.v || 0)).slice(0, 5);
  [["walmart", "Melhores Walmart (nota no Google)", 5000], ["target", "Melhores Target (nota no Google)", 500]].forEach(([c, tit, min]) => {
    const l = melhores(c, min); if (!l.length) return;
    v.appendChild(h("h3", { text: tit }));
    v.appendChild(h("div", { class: "list" }, ...l.map((p, i) => { const r = placeRow(p, origin); const t = $(".t span", r); t.textContent = regiaoDe(p) + " · " + t.textContent; const b = $(".t b", r); b.textContent = (i + 1) + "º " + (D.pontos.tipos[p.c] || {}).n.split(" ")[0] + " · " + p.a.split(",")[0].replace(/^\d+\s*/, ""); return r; })));
  });
  v.appendChild(h("p", { class: "src", text: "Notas e horários do Google Maps (nov/2026). Ranking com no mínimo 5 mil avaliações (Walmart) e 500 (Target). Cupons: balcões oficiais Simon (premiumoutlets.com)." }));
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
  storeSearch(q, allPlaces()).forEach(p => {
    const n = norm(placeName(p));
    out.push({ kind: "ponto", n: placeName(p), sub: placeTypeLabel(p) + " · " + p.a,
      la: p.la, lo: p.lo, score: n === q ? 0 : 2 + (n.startsWith(q) ? 0 : 1), p });
  });
  return out.sort((a, b) => a.score - b.score).slice(0, 6);
}
function nearestRegion(la, lo) { let best = null, bd = 1e9; D.pontos.regioes.forEach(r => { const d = kmBetween(la, lo, r.la, r.lo); if (d < bd) { bd = d; best = r; } }); return best && bd <= 40 ? best : null; }
function nearestPlaceName(la, lo) { let best = null, bd = 1e9; allPlaces().forEach(p => { if (p.c === "train" || !placeHasCoordinates(p)) return; const d = kmBetween(la, lo, p.la, p.lo); if (d < bd) { bd = d; best = p; } }); return best && bd <= 3 ? placeName(best) : null; }

/* ---------------- PERTO (planejador) ---------------- */
let here = null; // {la, lo, label}
let nearMode = "lista";
const nf = { open: false, top: false, type: "", sort: "km" };
function placeName(p) { return p.n || (D.pontos.tipos[p.c] || {}).n || p.c; }
function placeId(p) { return p.sid || (placeName(p) + "|" + p.a).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80); }
function currentRouteDate() { return ISO.test(state.routeDate) ? state.routeDate : agendaToday(); }
function openDayRoute(iso) {
  state.routeDate = ISO.test(iso) ? iso : agendaToday();
  const first = routeStops(state.routeDate)[0], point = first && stopCoords(first);
  if (point) { here = { la: point.la, lo: point.lo, label: first.n }; state.region = ""; }
  save(); go("perto");
}
function renderPerto() {
  const v = $("#view-perto"); v.replaceChildren(h("h2", { text: "O que tem perto" }));
  const sel = h("select", { id: "near-region", onChange: e => setRegion(e.target.value) }, h("option", { value: "", text: "Escolha a região…" }));
  let grp = null, og = null;
  D.pontos.regioes.forEach(r => { if (r.g !== grp) { grp = r.g; og = h("optgroup", { label: grp }); sel.appendChild(og); } og.appendChild(h("option", { value: r.id, text: r.n })); });
  sel.value = state.region || "";
  const sug = h("div", { class: "sugg" });
  const addr = h("input", { type: "search", "aria-label": "Buscar lugar ou endereço", placeholder: "Onde você vai? Ex.: Universal, Lake Buena Vista", autocomplete: "off",
    onInput: e => { const list = findPlaces(e.target.value); sug.replaceChildren(...list.map(x => h("button", { class: "row", onClick: () => { addr.value = x.n; sug.replaceChildren(); selectNearResult(x); } }, h("span", { class: "ico" }, icon(x.kind === "regiao" ? "map" : "pin")), h("span", { class: "t" }, h("b", { text: x.n }), h("span", { text: x.sub })), icon("chev", "chev")))); sug.classList.toggle("list", list.length > 0); } });
  addr.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); planAddr(addr.value); } });
  v.appendChild(h("div", { class: "card" }, h("div", { class: "search" }, icon("search"), addr), sug,
    h("div", { class: "btns" }, h("button", { class: "btn tonal", onClick: useGeo }, icon("nav"), "Usar onde estou"), state.homeLat != null ? h("button", { class: "btn tonal", onClick: () => { here = { la: state.homeLat, lo: state.homeLng, label: "casa" }; state.region = ""; sel.value = ""; save(); renderNear(); } }, icon("home"), "Partir da casa") : null, h("button", { class: "btn", onClick: () => planAddr(addr.value) }, "Buscar")),
    h("label", { for: "near-region", text: "Ou escolha a região" }), sel, storeActions()));
  const results = h("details", { class: "near-results", open: !!here }, h("summary", {}, icon("search"), h("span", { text: "Explorar lugares próximos" })),
    h("div", { class: "seg", id: "nearSeg" }, h("button", { class: nearMode === "lista" ? "on" : "", onClick: () => { nearMode = "lista"; renderNear(); } }, "Lista"), h("button", { class: nearMode === "mapa" ? "on" : "", onClick: () => { nearMode = "mapa"; renderNear(); } }, "Mapa")), h("div", { id: "nearHead" }), h("div", { id: "near" }));
  const routeDate = currentRouteDate();
  const routePicker = h("input", { class: "route-date", type: "date", value: routeDate, "aria-label": "Data do roteiro", onChange: () => { const d = str(routePicker.value, 10); if (ISO.test(d)) { state.routeDate = d; save(); renderPerto(); } } });
  const planCard = h("section", { class: "card day-plan route-card" }, h("div", { class: "route-heading" }, h("div", {}, h("h3", { text: "Minha programação" }), h("p", { class: "small muted", text: "Agenda e roteiro juntos, na ordem que escolher." })), routePicker), h("div", { class: "list", id: "plan" }));
  const stops = routeStops(routeDate);
  if (stops.length) planCard.appendChild(h("button", { class: "btn primary block route-maps", onClick: openRoute }, icon("route"), "Abrir trajeto no Google Maps"));
  planCard.appendChild(h("div", { class: "btns" },
    stops.length ? tripButton("Mapa das paradas", "map", () => sheetDayMap(routeDate), "tonal sm") : null,
    stops.length > 1 ? tripButton("Ordenar por proximidade", "route", autoOrder, "tonal sm") : null,
    tripButton("Ver na Agenda", "cal", () => { agSel = routeDate; go("agenda"); }, "sm")));
  v.insertBefore(planCard, v.children[1]); v.appendChild(results);
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
function selectNearResult(result) {
  if (result.p?.sid || (result.p && !placeHasCoordinates(result.p))) { sheetPlace(result.p); return; }
  here = { la: result.la, lo: result.lo, label: result.n };
  state.region = "";
  const select = $("#near-region");
  if (select) select.value = "";
  save();
  renderNear();
}
async function planAddr(q) {
  q = str(q, 120); if (!q) { toast("Digite um lugar, região ou endereço"); return; }
  const local = findPlaces(q); if (local.length) { selectNearResult(local[0]); return; }
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
  let list = allPlaces().filter(placeHasCoordinates).map(p => Object.assign({}, p, { km: kmBetween(here.la, here.lo, p.la, p.lo) })).sort((a, b) => a.km - b.km);
  let lim = raio; if (!list.some(p => p.km <= lim)) lim = 40;
  list = list.filter(p => p.km <= lim);
  const TYPES = { comida: ["comida"], marca: ["marca", "clearance"], loja: ["local-shop", "homesense", "marca", "clearance", "ross", "tjmaxx", "th", "marshalls", "mh", "burlington", "nrack", "bealls", "kohls", "walmart", "walmartp", "target", "walgreens", "cvs", "publix", "dollartree", "ulta"], shop: ["outlet", "mall", "barg"], park: ["park"], train: ["train"] };
  if (nf.type) list = list.filter(p => (TYPES[nf.type] || []).includes(p.c));
  if (nf.open) list = list.filter(p => (openStatus(p) || {}).open);
  if (nf.top) list = list.filter(p => (p.r || 0) >= 4.3);
  if (nf.sort === "r") list.sort((a, b) => (b.r || 0) - (a.r || 0) || a.km - b.km);
  list = list.slice(0, 40);
  const chip = (lab, on, fn) => h("button", { class: "chip" + (on ? " on" : ""), onClick: () => { fn(); renderNear(); } }, lab);
  const filters = h("div", { class: "filters" },
    chip("Abertos agora", nf.open, () => nf.open = !nf.open), chip("★ 4,3+", nf.top, () => nf.top = !nf.top),
    chip("Lojas", nf.type === "loja", () => nf.type = nf.type === "loja" ? "" : "loja"), chip("Marcas", nf.type === "marca", () => nf.type = nf.type === "marca" ? "" : "marca"), chip("Outlets e shoppings", nf.type === "shop", () => nf.type = nf.type === "shop" ? "" : "shop"), chip("Parques", nf.type === "park", () => nf.type = nf.type === "park" ? "" : "park"), chip("Comida", nf.type === "comida", () => nf.type = nf.type === "comida" ? "" : "comida"),
    chip(nf.sort === "r" ? "Por nota" : "Por distância", nf.sort === "r", () => nf.sort = nf.sort === "r" ? "km" : "r"));
  const results = $(".near-results"); if (results) results.open = true;
  head.replaceChildren(h("div", { class: "callout info", text: "Perto de " + here.label + " — " + list.length + " lugares em até " + lim + " km" + (nf.sort === "r" ? ", por nota." : ", do mais perto ao mais longe.") }), filters);
  $$("#nearSeg button").forEach((b, i) => b.classList.toggle("on", (i === 0) === (nearMode === "lista")));
  if (nearMode === "mapa") { box.replaceChildren(); showMap(box, list); return; }
  const l = h("div", { class: "list" });
  list.forEach(p => { const st = openStatus(p); const np = pendentes(pedidosPonto(p)).length; const sub = [np ? np + (np === 1 ? " pedido" : " pedidos") : "", placeTypeLabel(p), ratingText(p), st ? st.txt : ""].filter(Boolean).join(" · ") || p.a;
    l.appendChild(h("button", { class: "row", onClick: () => sheetPlace(p) }, h("span", { class: "ico" }, icon(p.c === "park" ? "park" : p.c === "train" ? "route" : p.c === "comida" ? "fork" : p.c === "outlet" || p.c === "mall" || p.c === "barg" ? "bag" : "tag")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { class: st && !st.open ? "closed" : "", text: sub })), h("span", { class: "km", text: p.km.toFixed(1).replace(".", ",") + " km" }), icon("chev", "chev"))); });
  box.replaceChildren(l);
}
function sheetPlace(p) {
  const t = D.pontos.tipos[p.c] || {}; const id = placeId(p); const inPlan = routeStops(currentRouteDate()).some(s => s.pId === id || s.id === id);
  const st = openStatus(p);
  openSheet(h("h2", { text: placeName(p) }), h("div", { class: "tags" }, h("span", { class: "badge " + (t.bc || "sky"), text: placeTypeLabel(p) }), p.sid ? h("span", { class: "badge coral", text: "Minha loja" }) : null, p.r ? h("span", { class: "badge gray", text: ratingText(p) + " no Google" }) : null, st ? h("span", { class: "badge " + (st.open ? "leaf" : "coral"), text: st.txt + (st.approx ? " (aprox.)" : "") }) : null),
    h("p", { text: p.a }), p.h ? h("p", { class: "small muted", text: "Horário: " + p.h }) : null,
    p.phone ? h("p", { class: "small muted", text: "Telefone: " + p.phone }) : null,
    p.osm ? h("p", { class: "small muted" }, "Dados de ", h("a", { href: "https://www.openstreetmap.org/" + p.osm }, "© OpenStreetMap")) : null,
    p.cupom ? h("div", { class: "callout info" }, h("b", { text: "Livro de cupons: " }), p.cupom) : null,
    p.dica ? h("div", { class: "callout ok", [p.sid ? "text" : "html"]: p.dica }) : null,
    h("div", { class: "btns" }, tripButton(inPlan ? "Programar em outro dia" : "Adicionar à programação", inPlan ? "check" : "cal", () => sheetProgramarLugar(p), "primary"),
      p.sid ? tripButton("Editar loja", "gear", () => sheetStore(p), "tonal") : null,
      h("a", { class: "btn", href: mapsDir(p.sid ? p.a : placeName(p) + ", " + p.a) }, icon("nav"), "Como chegar"),
      h("a", { class: "btn", href: mapsSearch(placeName(p) + ", " + p.a) }, "Ver no Maps"),
      p.site ? h("a", { class: "btn", href: p.site }, "Site da loja") : null,
      placeHasCoordinates(p) ? tripButton("Ver o que tem perto", "pin", () => { here = { la: p.la, lo: p.lo, label: placeName(p) }; state.region = ""; save(); closeSheet(); go("perto"); }, "tonal") : null),
    pedidosSection(pedidosPonto(p), () => sheetPlace(p)),
    h("div", { class: "btns" }, closeBtn()));
}
function eventPlaces(event) {
  if (!event || event.cat !== "compras" || !event.q || /online|\.com/i.test(event.q + " " + event.onde)) return [];
  const q = norm(event.q);
  return D.pontos.pontos.filter(p => { const n = norm(placeName(p)); return n === q || n.startsWith(q + " "); });
}
function fixedEventPlace(event) {
  if (!event || event.cat === "compras") return null;
  const location = norm((event.q || event.onde || "").split(",")[0]);
  if (location.length < 4) return null;
  return D.pontos.pontos.find(p => norm(placeName(p)) === location) || null;
}
function routeAnchors(day) {
  const ids = state.agenda.filter(x => x.d === day && x.k === "pl").map(x => x.id).concat(state.plan.filter(x => x.d === day).map(x => x.id));
  const anchors = ids.map(placeById).filter(p => p && placeHasCoordinates(p));
  state.agenda.filter(x => x.d === day && x.k === "ev").forEach(x => { const event = ((D.eventos && D.eventos.eventos) || []).find(e => e.id === x.id); const p = fixedEventPlace(event); if (p) anchors.push(p); });
  if (!anchors.length && state.homeLat != null && state.homeLng != null) anchors.push({ la: state.homeLat, lo: state.homeLng });
  return anchors;
}
function stopFromAgenda(x, anchors) {
  const event = x.k === "ev" ? ((D.eventos && D.eventos.eventos) || []).find(e => e.id === x.id) : null;
  const query = event ? (event.q || event.onde || x.a || x.n) : (x.a || x.n);
  const choices = eventPlaces(event), manual = choices.find(p => placeId(p) === x.locId);
  const point = x.k === "pl" ? placeById(x.id) : fixedEventPlace(event) || manual || (choices.length === 1 ? choices[0] : anchors.length && choices.length ? choices.slice().sort((a, b) => Math.min(...anchors.map(r => kmBetween(a.la, a.lo, r.la, r.lo))) - Math.min(...anchors.map(r => kmBetween(b.la, b.lo, r.la, r.lo))))[0] : null);
  const pId = point ? placeId(point) : x.k === "pl" ? x.id : "";
  const destination = point ? (point.sid ? point.a : placeName(point) + ", " + point.a) : query;
  return { id: "agenda:" + x.k + ":" + x.id, pId, kind: x.k, category: point && point.c, n: x.n, a: point ? point.a : (event && event.onde) || x.a || "", q: destination, agenda: true, choices: choices.length, manual: !!manual, sourceId: x.id, autoPlace: !!point && !!event && !manual, time: x.time || "", fixed: !!x.fixed };
}
function routeStops(day) {
  const anchors = routeAnchors(day);
  const raw = state.agenda.filter(x => x.d === day && (x.k !== "nota" && (x.k !== "custom" || x.a))).map(x => stopFromAgenda(x, anchors)).concat(state.plan.filter(s => s.d === day).map(s => Object.assign({ q: s.n + ", " + s.a, agenda: false }, s)));
  const seen = new Set(); const unique = raw.filter(s => { const key = s.pId || norm(s.q || s.n); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  const order = state.routeOrder[day] || []; const rank = new Map(order.map((id, i) => [id, i]));
  unique.sort((a, b) => (rank.get(a.id) ?? 1000) - (rank.get(b.id) ?? 1000) || (a.time || "99:99").localeCompare(b.time || "99:99"));
  const fixed = unique.filter(s => s.fixed).sort((a, b) => a.time.localeCompare(b.time));
  return unique.map(s => s.fixed ? fixed.shift() : s);
}
function stopCoords(s) { const p = placeById(s.pId || s.id); return p && placeHasCoordinates(p) ? { la: p.la, lo: p.lo } : null; }
function saveRouteOrder(day, stops) { state.routeOrder[day] = stops.map(s => s.id); save(); }
function addStop(p) {
  const day = currentRouteDate(), id = placeId(p);
  if (routeStops(day).some(s => s.pId === id || s.id === id)) { toast("Esse lugar já está no roteiro deste dia"); return; }
  if (state.plan.filter(s => s.d === day).length >= 30) { toast("Roteiro cheio"); return; }
  state.plan.push({ id, n: placeName(p), a: p.a, d: day }); save(); renderPlan(); toast("Adicionado ao roteiro de " + fmtDia(day, { day: "numeric", month: "short" }));
}
function chooseEventPlace(day, eventId) {
  const entry = state.agenda.find(x => x.d === day && x.k === "ev" && x.id === eventId);
  const event = ((D.eventos && D.eventos.eventos) || []).find(e => e.id === eventId);
  if (!entry || !event) return;
  const choices = eventPlaces(event), anchors = routeAnchors(day);
  const sorted = choices.slice().sort((a, b) => anchors.length ? Math.min(...anchors.map(r => kmBetween(a.la, a.lo, r.la, r.lo))) - Math.min(...anchors.map(r => kmBetween(b.la, b.lo, r.la, r.lo))) : placeName(a).localeCompare(placeName(b)));
  const select = p => { entry.locId = p ? placeId(p) : ""; save(); closeSheet(); renderPerto(); toast(p ? "Loja escolhida para este evento" : "Escolha automática ativada"); };
  openSheet(h("h2", { text: "Escolher a loja" }), h("p", { class: "small muted", text: "Escolha uma unidade ou deixe o guia sugerir uma próxima das paradas do dia." }),
    h("button", { class: "btn tonal block", onClick: () => select(null) }, icon("route"), "Escolher automaticamente"),
    h("div", { class: "list" }, ...sorted.map(p => h("button", { class: "row", onClick: () => select(p) }, h("span", { class: "ico" }, icon("pin")), h("span", { class: "t" }, h("b", { text: placeName(p) }), h("span", { text: p.a })), entry.locId === placeId(p) ? h("span", { class: "badge leaf", text: "Escolhida" }) : icon("chev", "chev")))), closeBtn());
}
function renderPlan() {
  const box = $("#plan"); if (!box) return; box.replaceChildren();
  const day = currentRouteDate(), stops = routeStops(day);
  if (!stops.length) { box.appendChild(h("div", { class: "empty", text: "Escolha uma região e adicione lugares à programação deste dia." })); return; }
  const km = stops.every(stopCoords) ? planTotalKm(stops) : 0;
  box.appendChild(h("div", { class: "small muted trip-route-caption", text: stops.length + (stops.length === 1 ? " parada" : " paradas") + (km ? " · " + Math.round(km) + " km em linha reta" : "") }));
  stops.forEach((s, i) => box.appendChild(h("div", { class: "stop" }, h("span", { class: "stop-type " + (s.kind === "ev" ? "event" : s.category === "park" ? "park" : s.category === "comida" ? "food" : "place") }, icon(s.kind === "ev" ? "cal" : s.category === "park" ? "park" : s.category === "comida" ? "fork" : "pin")), h("div", { class: "n" }, h("small", { text: ["PARADA " + (i + 1), s.time, s.fixed ? "horário fixo" : ""].filter(Boolean).join(" · ") }), s.n, h("small", { text: s.a || "Local a confirmar no Maps" }), s.choices ? h("button", { class: "location-choice", onClick: () => chooseEventPlace(day, s.sourceId) }, s.manual ? "Loja escolhida · alterar" : s.autoPlace ? "Sugestão de loja · alterar" : "Escolher unidade") : null),
    h("button", { class: "iconbtn", "aria-label": "Subir " + s.n, disabled: i === 0 || s.fixed || stops[i - 1].fixed, onClick: () => { [stops[i - 1], stops[i]] = [stops[i], stops[i - 1]]; saveRouteOrder(day, stops); renderPlan(); } }, icon("up")),
    h("button", { class: "iconbtn", "aria-label": "Descer " + s.n, disabled: i === stops.length - 1 || s.fixed || stops[i + 1].fixed, onClick: () => { [stops[i + 1], stops[i]] = [stops[i], stops[i + 1]]; saveRouteOrder(day, stops); renderPlan(); } }, icon("down")),
    h("button", { class: "iconbtn", "aria-label": "Remover " + s.n, onClick: () => { if (s.agenda) state.agenda = state.agenda.filter(x => !(x.d === day && "agenda:" + x.k + ":" + x.id === s.id)); else state.plan = state.plan.filter(x => x.id !== s.id || x.d !== day); save(); renderPerto(); } }, icon("x")))));
}
function autoOrder() {
  const day = currentRouteDate(), stops = routeStops(day);
  if (stops.length < 2) return;
  let origin = state.homeLat != null ? { la: state.homeLat, lo: state.homeLng } : here || stopCoords(stops[0]);
  const ordered = [], segment = [];
  const distance = stop => {
    const point = stopCoords(stop);
    return point && origin ? kmBetween(origin.la, origin.lo, point.la, point.lo) : Infinity;
  };
  const flush = () => {
    while (segment.length) {
      segment.sort((a, b) => distance(a) - distance(b));
      const stop = segment.shift();
      ordered.push(stop);
      origin = stopCoords(stop) || origin;
    }
  };
  for (const stop of stops) {
    if (!stop.fixed) { segment.push(stop); continue; }
    flush();
    ordered.push(stop);
    origin = stopCoords(stop) || origin;
  }
  flush();
  saveRouteOrder(day, ordered);
  renderPlan();
  toast("Paradas flexíveis ordenadas por proximidade");
}
function planTotalKm(stops) { let cur = (state.homeLat != null) ? { la: state.homeLat, lo: state.homeLng } : null, tot = 0; stops.forEach(s => { const c = stopCoords(s); if (c && cur) tot += kmBetween(cur.la, cur.lo, c.la, c.lo); if (c) cur = c; }); return tot; }
function openRoute() { const day = currentRouteDate(), stops = routeStops(day); if (!stops.length) { toast("Adicione paradas primeiro"); return; } const unresolved = stops.find(s => s.choices > 1 && !s.pId); if (unresolved) { toast("Escolha a unidade para montar o trajeto"); chooseEventPlace(day, unresolved.sourceId); return; } const dest = stops.map(s => s.q || (s.n + ", " + s.a)); window.open(mapsDir(dest[dest.length - 1], state.home || "", dest.slice(0, -1)), "_blank", "noopener"); }
function clearPlan() { const day = currentRouteDate(), count = state.plan.filter(s => s.d === day).length; if (!count) { toast("Não há extras para limpar neste dia"); return; } if (!confirm("Remover os lugares extras deste roteiro? A Agenda não será alterada.")) return; state.plan = state.plan.filter(s => s.d !== day); delete state.routeOrder[day]; save(); renderPlan(); }


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
function pedidosPonto(p) { if (p.marca) return pedidosPara([p.marca]); const t = D.pontos.tipos[p.c] || {}; return pedidosPara([placeName(p), t.n, p.c]); }
function itemPhoto(i) {
  if (i.foto) return h("img", { src: i.foto, alt: "" });
  if (i.fotoUrl) { const img = document.createElement("img"); img.alt = i.nome; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = i.fotoUrl; img.addEventListener("error", () => img.remove()); img.addEventListener("click", ev => { ev.stopPropagation(); sheetFoto(i); }); return img; }
  return null;
}
function imgSearch(i) { const ref = /ref/i.test(i.tam || "") ? " " + i.tam.replace(/ref\.?\s*/i, "") : ""; return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(i.nome.replace(/\(.*?\)/g, "") + ref); }
function sheetFoto(i) {
  const img = itemPhoto(i);
  openSheet(h("h2", { text: i.nome }), img ? h("div", { class: "bigphoto" }, img) : h("div", { class: "empty", text: "Sem foto cadastrada." }),
    h("p", { class: "small muted", text: [i.tam ? "Tamanho/ref.: " + i.tam : "", i.cor ? "Cor: " + i.cor : ""].filter(Boolean).join(" · ") }),
    h("div", { class: "btns" }, h("a", { class: "btn tonal", href: imgSearch(i) }, icon("search"), "Ver mais fotos do modelo"), i.link ? h("a", { class: "btn", href: i.link }, "Página da marca") : null), closeBtn());
}
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
    box.appendChild(h("div", { class: "item" + (done ? " done" : "") }, chk, itemPhoto(i), h("div", { class: "t" }, h("b", { text: i.nome }), h("div", { class: "meta", text: meta }), i.obs ? h("div", { class: "meta", text: i.obs }) : null, h("div", { class: "links" }, h("a", { href: imgSearch(i) }, "Fotos do modelo"), i.link ? h("a", { href: i.link }, "Página da marca") : null))));
  });
  const n = pendentes(list).length;
  return h("div", {}, h("h3", { text: "Pedidos" + (n ? " · " + n + " em aberto" : " · tudo comprado") }), box, h("button", { class: "btn sm", onClick: () => { closeSheet(); go("lista"); } }, "Ver lista completa"));
}

/* ---------------- LISTA (pedidos da família) ---------------- */
function allPeople() { return [...(D.pedidos.pessoas || []).map(p => ({ id: str(p.id, 40), nome: str(p.nome, 60), tam: str(p.tam, 500), seed: true })), ...state.people]; }
function allItems() { return [...cleanItems(D.pedidos.pedidos || []).map(i => Object.assign(i, { seed: true })), ...state.items]; }
function personName(id) { const p = allPeople().find(x => x.id === id); return p ? p.nome : ""; }
let filterPerson = "", filterStatus = "";
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
    v.appendChild(h("div", { class: "list" }, ...people.map(p => { const its = items.filter(i => i.pessoa === p.id), ab = its.filter(i => !state.done[i.id]).length;
      return h("button", { class: "row", onClick: () => sheetPerson(p) }, h("span", { class: "ico", text: p.nome.slice(0, 1).toUpperCase() }), h("span", { class: "t" }, h("b", { text: p.nome }), h("span", { text: (its.length ? ab + " de " + its.length + " pedidos em aberto" : "sem pedidos") + (p.tam ? " · tamanhos" : "") })), icon("chev", "chev")); })));
  }
  v.appendChild(h("h3", { text: "Pedidos" }));
  const cnt = id => items.filter(i => (!id || i.pessoa === id) && !state.done[i.id]).length;
  const chip = (lab, on, fn) => h("button", { class: "chip" + (on ? " on" : ""), onClick: () => { fn(); renderLista(); } }, lab);
  v.appendChild(h("div", { class: "filters" }, chip("Todos (" + cnt("") + ")", !filterPerson, () => filterPerson = ""), ...people.map(p => chip(p.nome + " (" + cnt(p.id) + ")", filterPerson === p.id, () => filterPerson = filterPerson === p.id ? "" : p.id))));
  v.appendChild(h("div", { class: "filters" }, chip("Pendentes", filterStatus === "open", () => filterStatus = filterStatus === "open" ? "" : "open"), chip("Comprados", filterStatus === "done", () => filterStatus = filterStatus === "done" ? "" : "done")));
  const list = items.filter(i => (!filterPerson || i.pessoa === filterPerson) && (filterStatus !== "open" || !state.done[i.id]) && (filterStatus !== "done" || state.done[i.id]));
  const box = h("div", { class: "list" });
  if (!list.length) box.appendChild(h("div", { class: "empty", text: "Nenhum pedido ainda. Toque em “+ Pedido”, ou preencha a planilha do site." }));
  list.forEach(i => {
    const done = !!state.done[i.id];
    const meta = [personName(i.pessoa), i.cor, i.tam ? "tam. " + i.tam : "", i.preco ? money(i.preco) : ""].filter(Boolean).join(" · ");
    const onde = (i.onde || i.loja) ? "Onde achar: " + (i.onde || i.loja).replace(/;\s*/g, " · ") : "";
    const chk = h("input", { type: "checkbox", class: "chk", "aria-label": "comprado" }); chk.checked = done; chk.addEventListener("change", () => { if (chk.checked) state.done[i.id] = true; else delete state.done[i.id]; save(); renderLista(); });
    box.appendChild(h("div", { class: "item" + (done ? " done" : "") }, chk, itemPhoto(i),
      h("div", { class: "t" }, h("b", { text: i.nome }), h("div", { class: "meta", text: meta }), onde ? h("div", { class: "meta", text: onde }) : null, i.obs ? h("div", { class: "meta", text: i.obs }) : null,
        h("div", { class: "links" }, h("a", { href: imgSearch(i) }, "Fotos do modelo"), i.link ? h("a", { href: i.link }, "Página da marca") : null, !i.seed ? h("button", { class: "linkbtn", onClick: () => sheetItemForm(i) }, "Editar") : null))));
  });
  v.appendChild(box);
  v.appendChild(h("p", { class: "small muted", text: "Pedidos da planilha do site aparecem automaticamente; os que você cria aqui ficam só neste celular (use Compartilhar para mandar)." }));
}

function parseTamanhos(t) {
  return String(t || "").split(/\n|;|\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).map(x => x.trim()).filter(Boolean).map(x => { const k = x.indexOf(":"); return k > 0 ? [x.slice(0, k).trim(), x.slice(k + 1).trim()] : ["", x]; });
}
function sheetPerson(p) {
  const its = allItems().filter(i => i.pessoa === p.id);
  const rows = parseTamanhos(p.tam);
  const tot = its.filter(i => !state.done[i.id]).reduce((s, i) => s + i.preco, 0);
  openSheet(h("h2", { text: p.nome }),
    h("p", { class: "small muted", text: its.length ? its.filter(i => !state.done[i.id]).length + " de " + its.length + " pedidos em aberto · " + money(tot) + " a comprar" : "Nenhum pedido ainda." }),
    h("h3", { text: "Tamanhos" }),
    rows.length ? h("div", { class: "tscroll" }, h("table", { class: "sizes" }, h("tbody", {}, ...rows.map(r => h("tr", {}, h("th", { text: r[0] || "—" }), h("td", { text: r[1] })))))) : h("div", { class: "empty", text: p.seed ? "Sem tamanhos: preencha a coluna “tamanhos” na aba Pessoas da planilha." : "Sem tamanhos: toque em Editar." }),
    h("div", { class: "btns" }, h("button", { class: "btn sm", onClick: () => sheetBig(p.nome + "\n" + rows.map(r => (r[0] ? r[0] + ": " : "") + r[1]).join("\n")) }, "Mostrar ao vendedor"), !p.seed ? h("button", { class: "btn sm", onClick: () => sheetPersonForm(p) }, "Editar") : null, h("button", { class: "btn sm", onClick: sheetSizes }, "Tabela BR → EUA")),
    pedidosSection(its, () => sheetPerson(p)), closeBtn());
}
function sheetPersonForm(p) {
  const nome = h("input", { type: "text", value: p ? p.nome : "", placeholder: "Ex.: Roberto", maxlength: 60 });
  const tam = h("textarea", { placeholder: "Ex.: camiseta M, calça 34x32, tênis US 10 / BR 42, pé 27 cm", maxlength: 500 }); if (p) tam.value = p.tam;
  openSheet(h("h2", { text: p ? "Editar pessoa" : "Nova pessoa" }), h("label", { text: "Nome" }), nome, h("label", { text: "Tamanhos" }), tam,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: () => { const n = str(nome.value, 60); if (!n) { toast("Escreva o nome"); return; } if (p) { p.nome = n; p.tam = str(tam.value, 500); } else state.people.push({ id: uid(), nome: n, tam: str(tam.value, 500) }); save(); closeSheet(); renderLista(); } }, "Salvar"),
      h("button", { class: "btn", onClick: () => closeSheet() }, "Cancelar"), p ? h("button", { class: "btn danger sm", onClick: () => { if (!confirm("Excluir esta pessoa?")) return; state.people = state.people.filter(x => x.id !== p.id); save(); closeSheet(); renderLista(); } }, "Excluir") : null));
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
      h("button", { class: "btn", onClick: () => closeSheet() }, "Cancelar"), i ? h("button", { class: "btn danger sm", onClick: () => { if (!confirm("Excluir este pedido?")) return; state.items = state.items.filter(x => x.id !== i.id); delete state.done[i.id]; save(); closeSheet(); renderLista(); } }, "Excluir") : null));
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
    if (v > 1 && v < 20) { state.rateAuto = Math.round(v * 100) / 100; state.rateAt = Date.now(); save(); if (currentView === "lista") renderLista(); else if (currentView === "viagem") renderTrip(); }
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
    if (!j || !j.current || !j.daily || !Array.isArray(j.daily.temperature_2m_max)) throw new Error("formato");
    const t = Number(j.current.temperature_2m), mx = Number(j.daily.temperature_2m_max[0]), mn = Number(j.daily.temperature_2m_min[0]);
    if (![t, mx, mn].every(Number.isFinite) || t < -60 || t > 60) throw new Error("valor");
    state.wx = { at: Date.now(), la: pt.la, t: Math.round(t), code: Number(j.current.weather_code) | 0, uv: Math.max(0, Math.min(15, Math.round(Number(j.current.uv_index) || 0))), max: Math.round(mx), min: Math.round(mn), rain: Math.max(0, Math.min(100, Math.round(Number(j.daily.precipitation_probability_max[0]) || 0))), where: str(pt.n, 60) };
    save(); if (currentView === "hoje") renderHoje(); else if (currentView === "viagem") renderTrip();
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
let geoBusy = false, geoLast = 0;
async function geocode(q) {
  q = str(q, 200); if (!q) return null;
  if (geoBusy || Date.now() - geoLast < 1100) throw new Error("rate");
  geoBusy = true; geoLast = Date.now();
  try { return await geocodeNow(q); } finally { geoBusy = false; }
}
async function geocodeNow(q) {
  const j = await getJSON("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=" + encodeURIComponent(q), 10000);
  if (!Array.isArray(j) || !j.length) return null;
  const la = coord(j[0].lat, 90), lo = coord(j[0].lon, 180); if (la == null || lo == null) return null;
  return { la, lo, label: str(j[0].display_name, 120) };
}
/* "aberto agora": usa horários por dia (hd) quando existem; senão tenta ler o texto (h) */
function parseRange(txt) { const m = /(\d{1,2})(?:[:h](\d{2}))?\s*[–\-]\s*(\d{1,2})(?:[:h](\d{2}))?/.exec(txt || ""); if (!m) return null; const a = +m[1] * 60 + (+(m[2] || 0)), b = +m[3] * 60 + (+(m[4] || 0)); return { a, b: b <= a ? b + 1440 : b }; }
function openStatus(p) {
  if (p.osm) return null;
  const now = new Date(); const dow = now.getDay(); const cur = now.getHours() * 60 + now.getMinutes();
  let rg = null, approx = false;
  if (Array.isArray(p.hd) && p.hd.length === 7) { if (/^fechad/i.test(p.hd[dow] || "")) return { open: false, txt: "Fechado hoje", approx: false }; rg = parseRange(p.hd[dow]); } else if (p.h) { rg = parseRange(p.h); approx = true; }
  if (!rg) return null;
  const fmt = m => { m %= 1440; if (m === 0) return "meia-noite"; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const open = cur >= rg.a && cur < rg.b;
  return { open, txt: open ? "Aberto · fecha " + fmt(rg.b) : (cur < rg.a ? "Fechado · abre " + fmt(rg.a) : "Fechado"), approx };
}
function ratingText(p) { if (!p.r) return ""; const v = p.v >= 1000 ? (p.v / 1000).toFixed(1).replace(".0", "").replace(".", ",") + " mil" : String(p.v || ""); return "★ " + String(p.r).replace(".", ",") + (v ? " (" + v + ")" : ""); }
/* mapa (Leaflet vendorizado + OpenStreetMap) */
let map = null, mapLayer = null;
function pinColor(c) { return (c === "outlet" || c === "barg" || c === "mall") ? "#B86B30" : c === "park" ? "#2E7D5B" : c === "comida" ? "#A74634" : c === "train" ? "#667489" : "#16304C"; }
function showMap(container, list) {
  if (!window.L) { container.replaceChildren(h("div", { class: "callout warn", text: "Mapa indisponível neste aparelho." })); return; }
  if (map && !map.getContainer().isConnected) { map.remove(); map = null; mapLayer = null; }
  if (!navigator.onLine) container.appendChild(h("div", { class: "callout warn", text: "Sem internet: o mapa não carrega, mas a lista funciona." }));
  let box = $("#mapbox"); if (!box) { box = h("div", { id: "mapbox", class: "mapbox" }); container.appendChild(box); }
  if (!map) { map = L.map(box, { zoomControl: true, attributionControl: true }); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map); }
  if (mapLayer) mapLayer.remove(); mapLayer = L.layerGroup().addTo(map);
  if (here) L.circleMarker([here.la, here.lo], { radius: 9, color: "#fff", weight: 2, fillColor: "#D94E2B", fillOpacity: 1 }).bindTooltip(h("span", { text: "Você / ponto de partida" })).addTo(mapLayer);
  const pts = [];
  list.forEach(p => { const m = L.circleMarker([p.la, p.lo], { radius: 8, color: "#fff", weight: 2, fillColor: pinColor(p.c), fillOpacity: .95 }).addTo(mapLayer); m.bindTooltip(h("span", { text: placeName(p) })); m.on("click", () => sheetPlace(p)); pts.push([p.la, p.lo]); });
  if (here) pts.push([here.la, here.lo]);
  const activeMap = map;
  setTimeout(() => { if (!activeMap.getContainer().isConnected) return; activeMap.invalidateSize(); if (pts.length) activeMap.fitBounds(pts, { padding: [24, 24], maxZoom: 14 }); }, 50);
}
/* ---------------- configurações ---------------- */
function sheetSettings() {
  const name = h("input", { type: "text", value: state.name, placeholder: "Como quer ser chamada", maxlength: 40 });
  const home = h("input", { type: "text", value: state.home, placeholder: "Endereço da hospedagem (fica só neste celular)", maxlength: 160 });
  const rate = h("input", { type: "number", inputmode: "decimal", step: "0.01", value: state.rateManual ? state.rate : "", placeholder: state.rateAuto ? "Automática: " + String(state.rateAuto).replace(".", ",") : "Ex.: 5,40" });
  const theme = h("select", {}, h("option", { value: "auto", text: "Automático" }), h("option", { value: "light", text: "Claro" }), h("option", { value: "dark", text: "Escuro" })); theme.value = state.theme;
  const tripStart = h("input", { type: "date", value: state.tripStart });
  const tripEnd = h("input", { type: "date", value: state.tripEnd });
  const geoInfo = h("p", { class: "small muted", text: state.homeLat != null ? "Endereço localizado no mapa ✓ (usado para distâncias e clima)" : "Ao salvar com internet, o endereço é localizado no mapa para calcular distâncias." });
  openSheet(h("h2", { text: "Configurações" }), h("label", { text: "Seu nome" }), name, h("label", { text: "Endereço da casa" }), home, geoInfo, h("label", { text: "Cotação do dólar (R$) — deixe vazio para automática" }), rate, h("label", { text: "Início da viagem (opcional)" }), tripStart, h("label", { text: "Fim da viagem (opcional)" }), tripEnd, h("p", { class: "small muted", text: "A Agenda abre nesta data quando você definir o período da viagem." }), h("label", { text: "Aparência" }), theme,
    h("div", { class: "btns" }, h("button", { class: "btn primary", onClick: async () => {
      const start = str(tripStart.value, 10), end = str(tripEnd.value, 10);
      if ((start && !ISO.test(start)) || (end && !ISO.test(end))) { toast("Informe datas válidas"); return; }
      if (start && end && start > end) { toast("O fim da viagem precisa ser depois do início"); return; }
      state.name = str(name.value, 40); const newHome = str(home.value, 160); const changed = newHome !== state.home; state.home = newHome;
      const r = num(rate.value); state.rateManual = r > 0; if (r > 0) state.rate = r;
      state.tripStart = start; state.tripEnd = end; state.theme = theme.value; save(); applyTheme(); closeSheet(); tripRefresh(); toast("Salvo");
      if (changed) { state.homeLat = null; state.homeLng = null; save(); }
      if (newHome && state.homeLat == null && navigator.onLine) { try { const g = await geocode(newHome); if (g) { state.homeLat = g.la; state.homeLng = g.lo; save(); toast("Endereço localizado no mapa"); refreshWeather(true); renderPerto(); } else toast("Não achei o endereço no mapa; confira a grafia"); } catch { /* offline ou falha: fica sem coordenadas */ } }
      if (!state.rateManual) refreshRate(true);
    } }, "Salvar"), h("button", { class: "btn", onClick: () => closeSheet() }, "Cancelar")),
    h("h3", { text: "Instalar como app" }), h("p", { class: "small muted", text: "Android/Chrome: menu ⋮ → “Instalar app” (ou “Adicionar à tela inicial”). iPhone/Safari: Compartilhar → “Adicionar à Tela de Início”. Depois disso funciona sem internet." }),
    h("h3", { text: "Privacidade" }), h("p", { class: "small muted", text: "Os dados ficam neste aparelho. Ao ativar a viagem compartilhada, programação e lista também sincronizam. Localizar um endereço ou calcular uma rota online envia os pontos aos serviços de mapas." }),
    h("div", { class: "btns" }, h("button", { class: "btn danger sm", onClick: async () => {
      if (!confirm("Apagar os dados deste aparelho, inclusive os anexos salvos?")) return;
      try { await clearReservationFiles(); } catch { toast("Não foi possível apagar os anexos"); return; }
      detachTripCloud(); setCloudSession(null); localStorage.removeItem(KEY); location.reload();
    } }, "Apagar meus dados")),
    h("p", { class: "small muted", text: "Versão dos dados: " + ((D.config && D.config.versao) || "") }));
}
$("#btnSettings").addEventListener("click", sheetSettings);

/* ---------------- PWA ---------------- */
function setupPWA() {
  const off = $("#offline"); const upd = () => off.classList.toggle("show", !navigator.onLine); window.addEventListener("online", upd); window.addEventListener("offline", upd); upd();
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const w = reg.installing; w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("Versão nova disponível — feche e abra o app"); }); });
    }).catch(() => {});
  }
}

/* @trip-modules */

/* ---------------- início ---------------- */
async function boot() {
  load(); applyTheme();
  try { await loadData(); } catch (e) {
    $("#view-viagem").replaceChildren(h("div", { class: "card" }, h("h2", { text: "Não consegui carregar os dados" }), h("p", { text: "Abra o site uma vez com internet para guardar tudo no celular. Se o problema continuar, avise quem montou o guia." })));
    return;
  }
  $("#brand").firstChild.textContent = D.config.titulo || "Guia"; $("#brandSub").textContent = D.config.subtitulo || ""; document.title = D.config.titulo || "Guia";
  renderHoje(); renderAgenda(); renderPerto(); renderLojas(); renderDicas(); renderLista();
  go(location.hash.replace("#", "") || "viagem", false);
  setupPWA(); startTripSync();
  refreshRate(false); refreshWeather(false);
  window.addEventListener("online", () => { refreshRate(false); refreshWeather(false); });
}
boot();
})();
