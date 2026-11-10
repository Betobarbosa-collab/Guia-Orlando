/* ---------------- lojas cadastradas neste aparelho ---------------- */
const STORE_TYPES = { "local-shop": "Loja", mall: "Shopping", outlet: "Outlet" };
const STORE_OSM_ID = /^(node|way|relation)\/([1-9]\d{0,15})$/;
const STORE_OSM_TYPES = { N: "node", W: "way", R: "relation" };
const storeLookupCache = new Map();
state.stores = [];

function cleanStores(records) {
  const seen = new Set();
  return tripList(records, 200).map(record => {
    const la = coord(record.la, 90);
    const lo = coord(record.lo, 180);
    return {
      sid: str(record.sid, 70), n: str(record.n, 100), a: str(record.a, 200),
      c: tripCategory(STORE_TYPES, record.c, "local-shop"),
      h: str(record.h, 120), dica: str(record.dica, 600), site: tripLink(record.site), phone: str(record.phone, 60),
      osm: typeof record.osm === "string" && STORE_OSM_ID.test(record.osm) ? record.osm : "",
      la: la != null && lo != null ? la : null, lo: la != null && lo != null ? lo : null
    };
  }).filter(store => {
    if (!/^store_[a-z0-9_]{1,64}$/.test(store.sid) || !store.n || !store.a || seen.has(store.sid)) return false;
    seen.add(store.sid);
    return true;
  });
}

function allPlaces() { return D.pontos.pontos.concat(state.stores); }
function placeHasCoordinates(place) { return Number.isFinite(place.la) && Number.isFinite(place.lo); }
function placeById(id) {
  return id ? allPlaces().find(place => placeId(place) === id) || null : null;
}
function placeTypeLabel(place) {
  if (place.sid) return STORE_TYPES[place.c];
  const type = D.pontos.tipos[place.c] || {};
  return type.b || type.n || "";
}
function storeSearch(text, source) {
  const terms = norm(text).split(" ").filter(Boolean);
  return source.filter(place => {
    const label = norm([placeName(place), place.a, place.marca, placeTypeLabel(place)].filter(Boolean).join(" "));
    return terms.every(term => label.includes(term));
  });
}
function myStores() {
  seg = "minhas";
  storeQuery = "";
  go("lojas");
}
function storeActions() {
  return h("div", { class: "btns store-actions" },
    tripButton("Adicionar loja", "plus", sheetAddStore, "primary"),
    tripButton("Minhas lojas", "bag", myStores, "tonal"));
}
function renderStoreResults(box, query, localOnly) {
  const source = localOnly ? state.stores : allPlaces().filter(p => !["comida", "park", "train"].includes(p.c));
  const stores = storeSearch(query, source);
  box.replaceChildren();
  if (!stores.length) {
    box.appendChild(h("p", { class: "empty", text: query.trim() ? "Nenhum lugar encontrado para esta busca." : "As lojas que você cadastrar aparecem aqui." }));
    return;
  }
  box.appendChild(h("div", { class: "list store-results" }, ...stores.map(p => tripRow(
    p.c === "mall" ? "map" : "bag", placeName(p), [p.a, p.sid ? "Minha loja" : placeTypeLabel(p)].filter(Boolean).join(" · "),
    () => sheetPlace(p), p.sid ? "trip-peach" : ""
  ))));
}
function storeOSMDetails(tags) {
  const website = str(tags.website || tags["contact:website"], 1000);
  return {
    h: str(tags.opening_hours, 120), phone: str(tags.phone || tags["contact:phone"], 60),
    site: tripLink(website.replace(/^http:\/\//i, "https://"))
  };
}

async function lookupStores(term) {
  const key = norm(term);
  if (storeLookupCache.has(key)) return storeLookupCache.get(key);
  const params = new URLSearchParams({ q: term, bbox: "-87.65,24.39,-79.95,31.01", lat: "28.54", lon: "-81.38", countrycode: "US", limit: "7", osm_tag: "shop" });
  const data = await getJSON("https://photon.komoot.io/api/?" + params, 7000);
  const stores = tripList(data?.features, 7).flatMap(feature => {
    const p = feature.properties;
    const [lo, la] = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
    const n = str(p?.name, 100);
    if (!n || !["FL", "Florida"].includes(p.state) || !Number.isFinite(la) || !Number.isFinite(lo)) return [];
    const locality = str([p.city || p.locality || p.county, ["FL", p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", "), 120);
    const a = p.street ? str([[p.housenumber, p.street].filter(Boolean).join(" "), locality].join(", "), 200) : "";
    const osm = STORE_OSM_TYPES[p.osm_type] + "/" + p.osm_id;
    const c = /\boutlets?\b/i.test(n) ? "outlet" : p.osm_value === "mall" ? "mall" : "local-shop";
    return [{ n, a, c, la, lo, locality, osm: STORE_OSM_ID.test(osm) ? osm : "", ...storeOSMDetails(p.extra || {}) }];
  });
  if (storeLookupCache.size >= 24) storeLookupCache.delete(storeLookupCache.keys().next().value);
  storeLookupCache.set(key, stores);
  return stores;
}

function existingStore(candidate) {
  const name = norm(candidate.n);
  return allPlaces().find(p => {
    if (candidate.osm && p.osm === candidate.osm) return true;
    const label = norm(placeName(p));
    if (label === name && norm(p.a) === norm(candidate.a)) return true;
    const sameBrand = label === name || label.startsWith(name + " ") || name.startsWith(label + " ") || norm(p.marca) === name;
    return sameBrand && placeHasCoordinates(p) && placeHasCoordinates(candidate) && kmBetween(p.la, p.lo, candidate.la, candidate.lo) < 0.15;
  });
}

async function fillStoreDetails(draft) {
  const id = STORE_OSM_ID.exec(draft.osm);
  if (!id || (draft.h && draft.site && draft.phone)) return draft;
  try {
    const request = "[out:json][timeout:4];" + id[1] + "(" + id[2] + ");out tags;";
    const data = await getJSON("https://overpass.private.coffee/api/interpreter?data=" + encodeURIComponent(request), 5000);
    const tags = data?.elements?.[0]?.tags;
    if (!tags) return draft;
    const details = storeOSMDetails(tags);
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const a = tags["addr:street"] ? str(street + ", " + draft.locality, 200) : "";
    return { ...draft, a: draft.a || a, h: details.h || draft.h, site: details.site || draft.site, phone: details.phone || draft.phone };
  } catch { return draft; }
}

function sheetAddStore() {
  const name = h("input", { type: "search", maxlength: 100, autocomplete: "off", placeholder: "Ex.: Target Kissimmee" });
  const status = h("p", { class: "small muted", role: "status" });
  const results = h("div", { class: "list store-results" });
  let timer, version = 0;

  function update() {
    clearTimeout(timer);
    const current = ++version;
    const term = str(name.value, 100);
    results.replaceChildren();
    if (norm(term).length < 3) {
      status.textContent = navigator.onLine ? "Digite pelo menos 3 letras para buscar lojas na Flórida." : "Sem internet. Você ainda pode buscar no guia ou preencher manualmente.";
      return;
    }
    const catalog = allPlaces().filter(p => !["comida", "park", "train"].includes(p.c));
    const local = storeSearch(term, catalog).slice(0, 3);
    for (const p of local) results.appendChild(tripRow("bag", placeName(p), p.a + (p.sid ? " · Minha loja" : " · No guia"), () => sheetPlace(p)));
    if (!navigator.onLine) { status.textContent = local.length ? "Resultados do guia disponíveis offline." : "Sem resultados no guia. Conecte-se para buscar mais unidades."; return; }
    status.textContent = "Buscando unidades na Flórida…";
    timer = setTimeout(async () => {
      if (!results.isConnected) return;
      try {
        const online = await lookupStores(term);
        if (current !== version || !results.isConnected) return;
        const used = new Set(local.map(placeId));
        let added = 0;
        for (const draft of online) {
          if (local.length + added >= 7) break;
          const saved = existingStore(draft);
          const key = saved ? placeId(saved) : draft.osm || norm(draft.n + " " + draft.a);
          if (used.has(key)) continue;
          used.add(key);
          added++;
          const row = tripRow("pin", saved ? placeName(saved) : draft.n,
            saved ? saved.a + (saved.sid ? " · Minha loja" : " · No guia") : draft.a || draft.locality + " · endereço a confirmar",
            () => saved ? sheetPlace(saved) : sheetStore(null, draft));
          results.appendChild(row);
        }
        status.textContent = local.length + added ? "Selecione a unidade pelo endereço." : "Nenhuma unidade encontrada. Tente incluir a cidade ou preencha manualmente.";
      } catch {
        if (current === version && results.isConnected) status.textContent = "Busca online indisponível. Edite o nome para tentar de novo ou preencha manualmente.";
      }
    }, 650);
  }

  name.addEventListener("input", update);
  name.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); update(); } });
  update();
  openSheet(h("h2", { text: "Adicionar loja" }), tripField("Nome da loja", name), status,
    tripButton("Preencher manualmente", null, () => sheetStore(null, { n: str(name.value, 100) }), "sm"), results,
    h("p", { class: "small muted" }, "Dados de ", h("a", { href: "https://www.openstreetmap.org/copyright" }, "© OpenStreetMap")));
  name.focus({ preventScroll: true });
}

function sheetStore(original = null, draft = null) {
  const place = original || draft;
  const name = h("input", { value: place?.n || "", maxlength: 100, required: true, placeholder: "Ex.: Target da região" });
  const address = h("input", { value: place?.a || "", maxlength: 200, required: true, placeholder: "Rua, número, cidade e estado" });
  const type = tripSelect(STORE_TYPES, place?.c || "local-shop");
  const hours = h("input", { value: place?.h || "", maxlength: 120, placeholder: "Ex.: seg a sáb, 9h–21h" });
  const site = h("input", { type: "url", value: place?.site || "", maxlength: 1000, placeholder: "https://…" });
  const phone = h("input", { type: "tel", value: place?.phone || "", maxlength: 60 });
  const notes = h("textarea", { maxlength: 600, rows: 3 }, place?.dica || "");
  const status = h("p", { class: "small muted", role: "status", text: "O endereço já permite incluir a loja no roteiro. Localizar no mapa é opcional e usa internet." });
  const error = h("p", { class: "small store-error", role: "alert" });
  let location = place && placeHasCoordinates(place) ? { ...place, address: place.a } : null;
  if (location) status.textContent = draft ? "Ponto no mapa encontrado. Confira o endereço antes de salvar." : "Localização guardada no aparelho.";
  address.addEventListener("input", () => {
    const located = location?.address === str(address.value, 200);
    locate.classList.toggle("hidden", located);
    if (located) status.textContent = "Localização guardada para este endereço.";
    else status.textContent = "Para mostrar a loja no mapa, localize o endereço com internet.";
  });
  const locate = tripButton("Localizar no mapa", "pin", async () => {
    const query = str(address.value, 200);
    if (!query) { error.textContent = "Informe o endereço completo."; address.focus(); return; }
    if (!navigator.onLine) { error.textContent = "Conecte-se para localizar. Você pode salvar a loja agora."; return; }
    error.textContent = "";
    locate.disabled = true;
    status.textContent = "Buscando o endereço no OpenStreetMap…";
    try {
      const result = await geocode(query);
      if (str(address.value, 200) !== query) return;
      if (!result) { status.textContent = "Endereço não encontrado. Confira o texto ou salve para localizar depois."; return; }
      location = { ...result, address: query };
      status.textContent = "Encontrado: " + result.label;
      locate.classList.add("hidden");
    } catch {
      if (str(address.value, 200) === query) status.textContent = "A localização está indisponível. Você pode salvar o endereço.";
    } finally { locate.disabled = false; }
  }, "tonal sm");
  locate.classList.toggle("hidden", !!location);

  function submit(event) {
    event.preventDefault();
    error.textContent = "";
    const n = str(name.value, 100), a = str(address.value, 200);
    const website = tripLink(site.value);
    if (!n || !a) { error.textContent = "Preencha o nome e o endereço da loja."; (n ? address : name).focus(); return; }
    if (site.value.trim() && !website) { error.textContent = "Use um link que comece com https://."; site.focus(); return; }
    if (!original && state.stores.length >= 200) { error.textContent = "Você pode guardar até 200 lojas neste aparelho."; return; }
    const point = location?.address === a ? location : null;
    const duplicate = allPlaces().find(p => (!original || p.sid !== original.sid) &&
      ((point?.osm && p.osm === point.osm) || (norm(placeName(p)) === norm(n) && norm(p.a) === norm(a))));
    if (duplicate) { error.textContent = "Já existe uma loja com esse nome e endereço."; return; }
    const [store] = cleanStores([{
      sid: original?.sid || "store_" + uid(), n, a, c: type.value,
      h: hours.value, dica: notes.value, site: website, phone: phone.value, osm: point?.osm, la: point?.la, lo: point?.lo
    }]);
    if (original) {
      state.stores = state.stores.map(p => p.sid === store.sid ? store : p);
      for (const item of [...state.agenda.filter(x => x.k === "pl"), ...state.plan]) {
        if (item.id === store.sid) { item.n = store.n; item.a = store.a; }
      }
    } else state.stores.push(store);
    save();
    if (currentView === "lojas") { seg = "minhas"; storeQuery = ""; renderLojas(); }
    else if (currentView === "perto") renderPerto();
    else if (currentView === "agenda") renderAgenda();
    toast("Loja salva em Minhas lojas");
    sheetPlace(store);
  }
  const detailLabel = h("span", { role: "status" });
  const form = h("form", { class: "store-form" },
    tripField("Nome da loja (obrigatório)", name), tripField("Endereço (obrigatório)", address), tripField("Tipo", type),
    locate, status,
    h("details", { class: "store-optional", open: !!original },
      h("summary", {}, "Horário e contato", detailLabel), tripField("Horário", hours), tripField("Site da loja", site), tripField("Telefone", phone), tripField("Observações", notes)), error,
    h("div", { class: "btns" },
      h("button", { class: "btn primary", type: "submit" }, icon("check"), "Salvar loja"),
      original ? tripButton("Remover de Minhas lojas", "x", () => removeStore(original), "danger sm") : null,
      tripButton(original ? "Cancelar" : "Voltar à busca", null, () => original ? sheetPlace(original) : sheetAddStore())));
  form.addEventListener("submit", submit);
  form.addEventListener("invalid", event => { const details = event.target.closest("details"); if (details) details.open = true; }, true);
  openSheet(h("h2", { text: original ? "Editar loja" : "Adicionar loja" }),
    h("p", { class: "small muted", text: draft?.osm ? "Confira a unidade e salve em Minhas lojas." : "Seu cadastro fica neste aparelho." }), form);
  if (draft?.osm) {
    detailLabel.textContent = " · buscando…";
    fillStoreDetails(draft).then(details => {
      if (!form.isConnected) return;
      if (location?.osm === draft.osm && address.value === draft.a && details.a !== draft.a) {
        address.value = details.a;
        location.address = details.a;
      }
      if (hours.value === draft.h) hours.value = details.h;
      if (site.value === draft.site) site.value = details.site;
      if (phone.value === draft.phone) phone.value = details.phone;
      detailLabel.textContent = hours.value || site.value || phone.value ? " · dados encontrados" : " · opcional";
    });
  }
}
function removeStore(store) {
  if (!confirm("Remover " + store.n + " de Minhas lojas? As paradas já programadas manterão o nome e o endereço.")) return;
  state.stores = state.stores.filter(p => p.sid !== store.sid);
  save();
  closeSheet();
  if (currentView === "lojas") renderLojas();
  if (currentView === "perto") renderPerto();
  toast("Loja removida de Minhas lojas");
}
