/* ---------------- lojas cadastradas neste aparelho ---------------- */
const STORE_TYPES = { "local-shop": "Loja", mall: "Shopping", outlet: "Outlet" };
state.stores = [];

function cleanStores(records) {
  const seen = new Set();
  return tripList(records, 200).map(record => {
    const la = coord(record.la, 90);
    const lo = coord(record.lo, 180);
    return {
      sid: str(record.sid, 70), n: str(record.n, 100), a: str(record.a, 200),
      c: tripCategory(STORE_TYPES, record.c, "local-shop"),
      h: str(record.h, 120), dica: str(record.dica, 600), site: tripLink(record.site),
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
    tripButton("Adicionar loja", "plus", () => sheetStore(), "primary"),
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
function sheetStore(original = null) {
  const name = h("input", { value: original?.n || "", maxlength: 100, required: true, placeholder: "Ex.: Target da região" });
  const address = h("input", { value: original?.a || "", maxlength: 200, required: true, placeholder: "Rua, número, cidade e estado" });
  const type = tripSelect(STORE_TYPES, original?.c || "local-shop");
  const hours = h("input", { value: original?.h || "", maxlength: 120, placeholder: "Ex.: seg a sáb, 9h–21h" });
  const site = h("input", { type: "url", value: original?.site || "", maxlength: 1000, placeholder: "https://…" });
  const notes = h("textarea", { maxlength: 600, rows: 3 }, original?.dica || "");
  const status = h("p", { class: "small muted", role: "status", text: "O endereço já permite incluir a loja no roteiro. Localizar no mapa é opcional e usa internet." });
  const error = h("p", { class: "small store-error", role: "alert" });
  let location = original && placeHasCoordinates(original) ? { ...original, address: original.a } : null;
  if (location) status.textContent = "Localização guardada no aparelho.";
  address.addEventListener("input", () => {
    if (location && str(address.value, 200) === location.address) status.textContent = "Localização guardada para este endereço.";
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
    } catch {
      if (str(address.value, 200) === query) status.textContent = "A localização está indisponível. Você pode salvar o endereço.";
    } finally { locate.disabled = false; }
  }, "tonal sm");

  function submit(event) {
    event.preventDefault();
    error.textContent = "";
    const n = str(name.value, 100), a = str(address.value, 200);
    const website = tripLink(site.value);
    if (!n || !a) { error.textContent = "Preencha o nome e o endereço da loja."; (n ? address : name).focus(); return; }
    if (site.value.trim() && !website) { error.textContent = "Use um link que comece com https://."; site.focus(); return; }
    if (!original && state.stores.length >= 200) { error.textContent = "Você pode guardar até 200 lojas neste aparelho."; return; }
    const duplicate = allPlaces().find(p => (!original || p.sid !== original.sid) && norm(placeName(p)) === norm(n) && norm(p.a) === norm(a));
    if (duplicate) { error.textContent = "Já existe uma loja com esse nome e endereço."; return; }
    const point = location?.address === a ? location : null;
    const [store] = cleanStores([{
      sid: original?.sid || "store_" + uid(), n, a, c: type.value,
      h: hours.value, dica: notes.value, site: website, la: point?.la, lo: point?.lo
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
  const form = h("form", { class: "store-form" },
    tripField("Nome da loja (obrigatório)", name), tripField("Tipo", type), tripField("Endereço (obrigatório)", address),
    locate, status, tripField("Horário", hours), tripField("Site da loja", site), tripField("Observações", notes), error,
    h("div", { class: "btns" },
      h("button", { class: "btn primary", type: "submit" }, icon("check"), "Salvar loja"),
      original ? tripButton("Remover de Minhas lojas", "x", () => removeStore(original), "danger sm") : null,
      tripButton("Cancelar", null, () => original ? sheetPlace(original) : closeSheet())));
  form.addEventListener("submit", submit);
  openSheet(h("h2", { text: original ? "Editar loja" : "Adicionar loja" }),
    h("p", { class: "small muted", text: "Cadastre uma loja, shopping ou outlet. Seu cadastro fica neste aparelho." }), form);
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
