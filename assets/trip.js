/* ---------------- viagem, programação e organização local ---------------- */
const RESERVATION_TYPES = { voo: "Voo", hospedagem: "Hospedagem", ingresso: "Ingresso", carro: "Carro", outro: "Outra reserva" };
const EXPENSE_TYPES = { compras: "Compras", comida: "Alimentação", passeios: "Passeios", transporte: "Transporte", hospedagem: "Hospedagem", outros: "Outros" };
const RESERVATION_ICONS = { voo: "nav", hospedagem: "home", ingresso: "tag", carro: "car", outro: "list" };
const DEFAULT_TRIP = { title: "", budget: 0, reservations: [], expenses: [], travelers: 1 };
state.trip = { ...DEFAULT_TRIP };

function tripDate(value) {
  if (typeof value !== "string" || !ISO.test(value)) return "";
  const d = parseISO(value);
  return Number.isFinite(d.getTime()) && isoDate(d) === value ? value : "";
}
function validTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function tripMinutes(value) {
  return Math.min(1440, Math.round(num(value)));
}
function tripList(value, cap) {
  return Array.isArray(value) ? value.slice(0, cap).filter(x => x && typeof x === "object" && !Array.isArray(x)) : [];
}
function tripCategory(types, value, fallback) {
  return Object.hasOwn(types, value) ? value : fallback;
}
function tripLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href.slice(0, 1000) : "";
  } catch { return ""; }
}
function cleanTrip(value) {
  const t = value && typeof value === "object" ? value : {};
  const reservations = tripList(t.reservations, 100).map(r => ({
    id: str(r.id, 70), title: str(r.title, 100), type: tripCategory(RESERVATION_TYPES, r.type, "outro"),
    date: tripDate(r.date), time: validTime(r.time) ? r.time : "", place: str(r.place, 200),
    reference: str(r.reference, 100), notes: str(r.notes, 1000), url: tripLink(r.url)
  })).filter(r => r.id && r.title);
  const expenses = tripList(t.expenses, 500).map(e => ({
    id: str(e.id, 70), title: str(e.title, 100), type: tripCategory(EXPENSE_TYPES, e.type, "outros"),
    date: tripDate(e.date), amount: num(e.amount), currency: e.currency === "BRL" ? "BRL" : "USD", rate: num(e.rate)
  })).filter(e => e.id && e.title && e.date && e.amount > 0);
  return { title: str(t.title, 80), budget: num(t.budget), reservations, expenses,
    travelers: Math.max(1, Math.min(30, Math.round(num(t.travelers)))) };
}
function loadTrip(record) {
  state.trip = cleanTrip(record.trip);
}
function tripTitle() { return state.trip.title || "Orlando"; }
function tripFocusDay() {
  const today = agendaToday();
  if (state.tripStart && today < state.tripStart) return state.tripStart;
  if (state.tripEnd && today > state.tripEnd) return state.tripEnd;
  return today;
}
function tripDateLabel(date) {
  return date ? fmtDia(date, { day: "numeric", month: "short", year: "numeric" }) : "";
}
function tripButton(label, symbol, run, style = "") {
  return h("button", { type: "button", class: "btn " + style, onClick: run }, symbol ? icon(symbol) : null, label);
}
function tripRow(symbol, title, subtitle, run, tone = "") {
  return h("button", { type: "button", class: "row", onClick: run },
    h("span", { class: "ico " + tone }, icon(symbol)),
    h("span", { class: "t" }, h("b", { text: title }), h("span", { text: subtitle })),
    icon("chev", "chev"));
}
function tripHeader(view, title, caption) {
  const v = $("#view-" + view);
  v.replaceChildren(h("div", { class: "trip-subhead" },
    tripButton("Minha viagem", "home", () => go("viagem"), "sm tonal"),
    h("h1", { text: title }), h("p", { class: "muted small", text: caption })));
  return v;
}
function tripField(label, input) { return h("label", { class: "trip-field" }, h("span", { text: label }), input); }
function tripSelect(types, value) {
  const el = h("select", {}, ...Object.entries(types).map(([k, title]) => h("option", { value: k, text: title })));
  el.value = value;
  return el;
}
function tripRefresh() {
  renderLista();
  renderHoje();
  if (currentView === "agenda") renderAgenda();
  else if (currentView === "perto") renderPerto();
  else renderTripView(currentView);
}
function tripSaveView() { save(); closeSheet(); tripRefresh(); }

function renderTripView(view) {
  switch (view) {
    case "viagem": renderTrip(); break;
    case "explorar": renderExplore(); break;
    case "reservas": renderReservations(); break;
    case "gastos": renderExpenses(); break;
    case "familia": renderTripFamily(); break;
  }
}
function renderTrip() {
  const v = $("#view-viagem");
  const day = tripFocusDay();
  const items = timelineEntries(day);
  const label = state.tripStart ? tripDateLabel(state.tripStart) + (state.tripEnd ? " a " + tripDateLabel(state.tripEnd) : "") : "Adicione as datas para planejar a viagem";
  v.replaceChildren(
    h("section", { class: "trip-hero" },
      h("div", { class: "trip-eyebrow", text: "Minha viagem" }),
      h("h1", { text: tripTitle() }),
      h("p", { class: "small", text: label }),
      h("div", { class: "trip-hero-meta" },
        h("span", {}, icon("passport"), state.trip.travelers + (state.trip.travelers === 1 ? " viajante" : " viajantes")),
        h("span", {}, icon("device"), navigator.onLine ? "Dados neste aparelho" : "Você está offline")),
      h("div", { class: "btns" },
        tripButton("Ver programação", "cal", () => { agSel = day; go("agenda"); }, "primary sm"),
        tripButton("Editar viagem", "gear", sheetTripDetails, "tonal sm"))),
    liveTripCard(),
    h("section", { class: "trip-section" },
      h("h2", { text: "Próximos passos" }),
      h("div", { class: "list" },
        tripRow("cal", cap(fmtDia(day, { weekday: "long", day: "numeric", month: "long" })),
          items.length ? items.length + (items.length === 1 ? " compromisso" : " compromissos") : "Escolha os lugares e eventos do dia", () => { agSel = day; go("agenda"); }),
        tripRow("route", "Roteiro do dia", "Organize suas paradas e veja o mapa", () => openDayRoute(day), "trip-sun"),
        tripRow("home", "Meu endereço", state.home || "Cadastre sua hospedagem ou ponto de partida", () => state.home ? sheetBig(state.home) : sheetSettings()))),
    h("section", { class: "trip-section" },
      h("h2", { text: "Tudo da viagem" }),
      h("div", { class: "list" },
        tripRow("passport", "Reservas e documentos", state.trip.reservations.length ? state.trip.reservations.length + " reservas salvas" : "Voos, hospedagem, carro e ingressos", () => go("reservas")),
        tripRow("dollar", "Gastos e orçamento", state.trip.expenses.length ? state.trip.expenses.length + " gastos registrados" : "Planeje em dólar e acompanhe em reais", () => go("gastos"), "trip-sun"),
        tripRow("share", "Família e backup", "Compartilhamento e cópia da viagem", () => go("familia"), "trip-peach"),
        tripRow("list", "Lista de compras", "Pedidos, preços e marcações de comprado", () => go("lista"))))
  );
}
function sheetTripDetails() {
  const title = h("input", { value: state.trip.title, placeholder: "Orlando em família", maxlength: 80 });
  const start = h("input", { type: "date", value: state.tripStart });
  const end = h("input", { type: "date", value: state.tripEnd });
  const travelers = h("input", { type: "number", min: 1, max: 30, value: state.trip.travelers });
  openSheet(h("h2", { text: "Editar viagem" }), tripField("Nome da viagem", title),
    h("div", { class: "trip-fields" }, tripField("Início", start), tripField("Fim", end)),
    tripField("Viajantes", travelers),
    h("div", { class: "btns" }, tripButton("Salvar viagem", "check", () => {
      const from = tripDate(start.value), to = tripDate(end.value);
      if (from && to && from > to) { toast("A data final precisa ser depois do início"); return; }
      state.trip.title = str(title.value, 80);
      state.trip.travelers = Math.max(1, Math.min(30, Math.round(num(travelers.value))));
      state.tripStart = from;
      state.tripEnd = to;
      agSel = "";
      tripSaveView();
    }, "primary"), closeBtn()));
}
function liveTripCard() {
  const day = agendaToday();
  const w = state.wx;
  const rate = effectiveRate();
  const rateLabel = state.rateManual ? "Cotação manual" : state.rateAt ? "Cotação de " + new Date(state.rateAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "Cotação de referência";
  const weatherLabel = w ? w.t + " °C" : "Clima";
  const weatherDetail = w ? (Date.now() - w.at > 3 * 3600e3 ? "Última consulta" : (WMO[w.code] || "Ver previsão")) : navigator.onLine ? "Consultar previsão" : "Sem previsão salva";
  const showWeather = async () => {
    if (!state.wx) await refreshWeather(true);
    if (state.wx) sheetWeather();
    else toast("Previsão indisponível");
  };
  return h("section", { class: "card trip-today", "aria-labelledby": "trip-today-title" },
    h("div", { class: "trip-today-heading" },
      h("div", {}, h("h2", { id: "trip-today-title", text: "Hoje" }),
        h("time", { class: "small muted", datetime: day, text: fmtDia(day) })),
      tripButton("Mais sobre hoje", null, () => go("hoje"), "sm")),
    h("div", { class: "trip-today-facts" },
      h("button", { type: "button", class: "trip-today-fact", onClick: showWeather }, icon("sun"),
        h("span", {}, h("b", { text: weatherLabel }), h("small", { text: weatherDetail }))),
      h("div", { class: "trip-today-fact" },
        h("span", {}, h("b", { text: rate ? "US$ 1 = " + brl(rate) : "Cotação indisponível" }), h("small", { text: rate ? rateLabel : "Informe no conversor" })))),
    tripButton("Converter com imposto", "dollar", sheetConverter, "primary sm block"));
}
function renderExplore() {
  const v = $("#view-explorar");
  const shortcuts = [
    ["bag", "Marcas e lojas", "Outlets e shoppings", () => { seg = "compras"; storeQuery = ""; go("lojas"); }],
    ["pin", "Lugares por perto", "Por região ou endereço", () => go("perto")],
    ["cal", "Eventos e ofertas", "Veja por dia", () => go("agenda")],
    ["tag", "Minhas lojas", "Seus lugares salvos", myStores],
    ["bulb", "Dicas de viagem", "Cupons, tamanhos e mais", () => go("dicas")],
    ["sun", "Hoje no guia", "Clima, descontos e frases", () => go("hoje")]
  ];
  v.replaceChildren(h("h1", { class: "explore-title", text: "Explore Orlando" }),
    h("div", { class: "store-actions" }, tripButton("Adicionar loja", "search", sheetAddStore, "primary sm block")),
    h("div", { class: "tiles explore-grid" }, ...shortcuts.map(([symbol, label, description, run]) =>
      h("button", { class: "tile", type: "button", onClick: run }, h("span", { class: "ico" }, icon(symbol)),
        h("div", {}, h("b", { text: label }), h("span", { text: description }))))));
}

/* A Agenda preserva os registros antigos e acrescenta horários editáveis. */
function timelineEntries(day) {
  const entries = state.agenda.filter(x => x.d === day);
  const extra = state.plan.filter(x => x.d === day && !entries.some(e => e.id === x.id));
  return entries.concat(extra).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}
function timeOffset(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function dayTimeline(day) {
  const entries = timelineEntries(day);
  const timed = entries.filter(x => x.time && x.minutes);
  const conflict = timed.some((x, i) => timed.slice(i + 1).some(y => timeOffset(y.time) < timeOffset(x.time) + x.minutes));
  const rows = entries.map(x => {
    const extra = state.plan.includes(x);
    const description = [x.a, x.minutes ? x.minutes + " min" : "", x.fixed ? "Horário fixo" : ""].filter(Boolean).join(" · ");
    return h("div", { class: "trip-timeline-item" },
      h("span", { class: "trip-time", text: x.time || "—" }),
      tripRow(x.k === "ev" ? "cal" : x.k === "nota" ? "bulb" : "pin", x.n, description || "Toque para definir o horário",
        () => sheetTripActivity(day, x, extra), x.k === "ev" ? "trip-peach" : x.k === "nota" ? "trip-sun" : ""));
  });
  return h("section", { class: "card day-plan" }, h("h2", { text: "Minha programação" }),
    conflict ? h("p", { class: "callout warn small", role: "status", text: "Há atividades com horários sobrepostos. Confira o tempo previsto antes de sair." }) : null,
    entries.length ? h("div", { class: "trip-timeline" }, ...rows) : h("p", { class: "empty", text: "Nada programado para este dia ainda." }),
    h("div", { class: "btns" },
      tripButton("Adicionar atividade", "plus", () => sheetTripActivity(day), "primary sm"),
      tripButton("Ver e organizar roteiro", "route", () => openDayRoute(day), "tonal sm"),
      tripButton("Escolher lugar", "bag", () => go("lojas"), "sm")));
}
function sheetTripActivity(day, entry, extra = false) {
  const title = h("input", { value: entry?.n || "", maxlength: 160, placeholder: "Ex.: Almoço em Winter Park" });
  const place = h("input", { value: entry?.a || "", maxlength: 200, placeholder: "Opcional, para incluir no roteiro" });
  const date = h("input", { type: "date", value: day });
  const time = h("input", { type: "time", value: entry?.time || "" });
  const duration = h("input", { type: "number", min: 0, max: 1440, value: entry?.minutes || "", placeholder: "Opcional" });
  const lock = h("input", { type: "checkbox" });
  lock.checked = !!entry?.fixed;
  const catalog = entry && (extra || entry.k === "ev" || entry.k === "pl");
  if (catalog) date.disabled = true;
  openSheet(h("h2", { text: entry ? "Editar atividade" : "Adicionar atividade" }),
    catalog ? h("p", { text: entry.n }) : tripField("Atividade", title),
    catalog ? (entry.a ? h("p", { class: "small muted", text: entry.a }) : null) : tripField("Local ou endereço", place),
    tripField("Data", date), h("div", { class: "trip-fields" }, tripField("Horário", time), tripField("Duração em minutos", duration)),
    h("label", { class: "trip-check" }, lock, "Horário fixo no roteiro"),
    h("div", { class: "btns" },
      tripButton("Salvar atividade", "check", () => {
        const when = tripDate(date.value);
        const n = catalog ? entry.n : str(title.value, 160);
        if (!n || !when) { toast("Preencha a atividade e a data"); return; }
        if (lock.checked && !validTime(time.value)) { toast("Defina um horário para fixar a atividade"); return; }
        if (!entry && state.agenda.length >= 300) { toast("A programação está cheia"); return; }
        const item = { ...entry, id: entry?.id || uid(), k: extra ? "pl" : catalog ? entry.k : "custom",
          n, a: catalog ? entry.a : str(place.value, 200), d: when, time: time.value, minutes: tripMinutes(duration.value), fixed: lock.checked };
        if (extra) state.plan = state.plan.filter(x => x !== entry);
        if (entry && !extra) state.agenda = state.agenda.map(x => x === entry ? item : x);
        else state.agenda.push(item);
        agSel = when;
        tripSaveView();
      }, "primary"),
      entry ? tripButton("Remover", "x", () => {
        if (!confirm("Remover esta atividade da programação?")) return;
        if (extra) state.plan = state.plan.filter(x => x !== entry);
        else state.agenda = state.agenda.filter(x => x !== entry);
        tripSaveView();
      }, "danger") : null,
      closeBtn()));
}

/* Reservas e gastos ficam disponíveis sem conexão. */
function renderReservations() {
  const v = tripHeader("reservas", "Reservas e documentos", "Voos, hospedagem, ingressos e carro em um só lugar.");
  const records = state.trip.reservations.slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  v.appendChild(h("div", { class: "btns" }, tripButton("Adicionar reserva", "plus", () => sheetReservation(), "primary")));
  v.appendChild(records.length ? h("div", { class: "list" }, ...records.map(r => tripRow(RESERVATION_ICONS[r.type], r.title,
    [RESERVATION_TYPES[r.type], tripDateLabel(r.date), r.time, r.place].filter(Boolean).join(" · "), () => showReservation(r))))
    : h("div", { class: "empty card", text: "Você ainda não cadastrou nenhuma reserva." }));
  v.appendChild(h("p", { class: "small muted", text: "Dados de reserva e arquivos ficam neste aparelho. Links externos precisam de internet." }));
}
function showReservation(record) {
  const attachment = h("div", { class: "btns" });
  readReservationFile(record.id).then(file => {
    if (file) attachment.appendChild(tripButton("Baixar documento salvo", "passport", () => saveBlob(file, file.name || "documento")));
  }).catch(() => {});
  openSheet(h("h2", { text: record.title }), h("p", { class: "muted small", text: [RESERVATION_TYPES[record.type], tripDateLabel(record.date), record.time].filter(Boolean).join(" · ") }),
    record.place ? h("p", { text: record.place }) : null,
    record.reference ? h("p", { text: "Código de confirmação: " + record.reference }) : null,
    record.notes ? h("p", { text: record.notes }) : null, attachment,
    h("div", { class: "btns" },
      record.url ? h("a", { class: "btn", href: record.url }, "Abrir confirmação online") : null,
      tripButton("Editar reserva", "gear", () => sheetReservation(record), "tonal"), closeBtn()));
}
function sheetReservation(record = {}) {
  const title = h("input", { value: record.title || "", maxlength: 100 });
  const kind = tripSelect(RESERVATION_TYPES, record.type || "hospedagem");
  const date = h("input", { type: "date", value: record.date || "" });
  const time = h("input", { type: "time", value: record.time || "" });
  const place = h("input", { value: record.place || "", maxlength: 200 });
  const reference = h("input", { value: record.reference || "", maxlength: 100 });
  const url = h("input", { type: "url", value: record.url || "", placeholder: "https://…" });
  const notes = h("textarea", { maxlength: 1000, rows: 3 }, record.notes || "");
  const file = h("input", { type: "file", accept: "application/pdf,image/jpeg,image/png,image/webp" });
  const status = h("p", { class: "small muted", text: "PDF ou imagem, até 8 MB. O arquivo fica no aparelho." });
  const id = record.id || uid();
  const submit = tripButton("Salvar reserva", "check", async () => {
    const link = tripLink(url.value);
    if (!str(title.value, 100)) { toast("Informe o nome da reserva"); return; }
    if (url.value && !link) { toast("Use um link HTTPS válido"); return; }
    if (!record.id && state.trip.reservations.length >= 100) { toast("Limite de reservas atingido"); return; }
    const attachment = file.files[0];
    if (attachment && (attachment.size > 8 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(attachment.type))) {
      toast("Selecione um PDF ou imagem de até 8 MB"); return;
    }
    submit.disabled = true;
    try {
      if (attachment) await writeReservationFile(id, attachment);
      const updated = { id, title: title.value, type: kind.value, date: date.value, time: time.value,
        place: place.value, reference: reference.value, notes: notes.value, url: link };
      const reservations = state.trip.reservations.filter(r => r.id !== id).concat(updated);
      state.trip = cleanTrip({ ...state.trip, reservations });
      tripSaveView();
    } catch { status.textContent = "Não foi possível guardar o arquivo. Verifique o espaço disponível."; }
    finally { submit.disabled = false; }
  }, "primary");
  openSheet(h("h2", { text: record.id ? "Editar reserva" : "Nova reserva" }),
    tripField("Nome", title), tripField("Tipo", kind),
    h("div", { class: "trip-fields" }, tripField("Data", date), tripField("Horário", time)),
    tripField("Local", place), tripField("Código de confirmação", reference), tripField("Link", url),
    tripField("Observações", notes), tripField("Anexo local", file), status,
    h("div", { class: "btns" }, submit,
      record.id ? tripButton("Remover reserva", "x", async () => {
        if (!confirm("Remover a reserva e o anexo deste aparelho?")) return;
        try { await deleteReservationFile(id); } catch { toast("Não foi possível remover o anexo"); return; }
        state.trip.reservations = state.trip.reservations.filter(r => r.id !== id);
        tripSaveView();
      }, "danger") : null, closeBtn()));
}
const TRIP_FILES = "guia-reservas";
function reservationFile(action, mode = "readonly") {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRIP_FILES, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("files", mode);
      const op = action(tx.objectStore("files"));
      tx.oncomplete = () => { db.close(); resolve(op.result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
function readReservationFile(id) { return reservationFile(store => store.get(id)); }
function writeReservationFile(id, file) { return reservationFile(store => store.put(file, id), "readwrite"); }
function deleteReservationFile(id) { return reservationFile(store => store.delete(id), "readwrite"); }
function clearReservationFiles() { return reservationFile(store => store.clear(), "readwrite"); }

function expenseUSD(expense) {
  return expense.currency === "USD" ? expense.amount : expense.amount / (expense.rate || effectiveRate() || 1);
}
function renderExpenses() {
  const v = tripHeader("gastos", "Gastos e orçamento", "Registre gastos em dólar ou real e acompanhe o total da viagem.");
  const rows = state.trip.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((sum, e) => sum + expenseUSD(e), 0);
  const budget = state.trip.budget;
  const remaining = budget - total;
  v.appendChild(h("section", { class: "trip-hero" },
    h("div", { class: "trip-eyebrow", text: "Gasto registrado" }), h("h2", { text: money(total) }),
    h("p", { class: "small", text: budget ? (remaining >= 0 ? money(remaining) + " disponível" : money(-remaining) + " acima do orçamento") + " · limite " + money(budget) : "Defina um orçamento para acompanhar o saldo." }),
    budget ? h("progress", { class: "trip-progress", max: budget, value: Math.min(total, budget), "aria-label": "Orçamento usado" }) : null,
    h("div", { class: "btns" }, tripButton("Adicionar gasto", "plus", () => sheetExpense(), "primary"), tripButton("Editar orçamento", "gear", sheetBudget, "tonal"))));
  if (rows.length) {
    const amounts = Object.entries(EXPENSE_TYPES).map(([key, label]) => [label, rows.filter(e => e.type === key).reduce((sum, e) => sum + expenseUSD(e), 0)]);
    v.appendChild(h("div", { class: "trip-totals" }, ...amounts.filter(([, value]) => value > 0).map(([label, value]) =>
      h("div", { class: "card flat" }, h("span", { class: "small muted", text: label }), h("b", { text: money(value) })))));
    v.append(h("h2", { text: "Lançamentos" }), h("div", { class: "list" }, ...rows.map(e =>
      tripRow("dollar", e.title, [e.currency === "BRL" ? brl(e.amount) : money(e.amount), EXPENSE_TYPES[e.type], tripDateLabel(e.date)].join(" · "), () => sheetExpense(e)))));
  }
}
function sheetBudget() {
  const input = h("input", { type: "number", inputmode: "decimal", min: 0, step: "0.01", value: state.trip.budget || "" });
  openSheet(h("h2", { text: "Orçamento da viagem" }), tripField("Total em dólares", input),
    h("div", { class: "btns" }, tripButton("Salvar orçamento", "check", () => { state.trip.budget = num(input.value); tripSaveView(); }, "primary"), closeBtn()));
}
function sheetExpense(record = {}) {
  const title = h("input", { value: record.title || "", maxlength: 100 });
  const value = h("input", { type: "number", min: "0.01", step: "0.01", inputmode: "decimal", value: record.amount || "" });
  const currency = tripSelect({ USD: "Dólar (US$)", BRL: "Real (R$)" }, record.currency || "USD");
  const category = tripSelect(EXPENSE_TYPES, record.type || "compras");
  const date = h("input", { type: "date", value: record.date || agendaToday() });
  openSheet(h("h2", { text: record.id ? "Editar gasto" : "Novo gasto" }), tripField("Descrição", title),
    h("div", { class: "trip-fields" }, tripField("Valor", value), tripField("Moeda", currency)),
    tripField("Categoria", category), tripField("Data", date),
    h("div", { class: "btns" },
      tripButton("Salvar gasto", "check", () => {
        if (!str(title.value, 100) || !num(value.value) || !tripDate(date.value)) { toast("Preencha a descrição, o valor e a data"); return; }
        if (!record.id && state.trip.expenses.length >= 500) { toast("Limite de gastos atingido"); return; }
        const rate = record.currency === currency.value && record.rate ? record.rate : effectiveRate();
        if (currency.value === "BRL" && !rate) { toast("Defina uma cotação antes de lançar em reais"); return; }
        const updated = { id: record.id || uid(), title: title.value, amount: num(value.value), currency: currency.value, type: category.value, date: date.value, rate };
        const expenses = state.trip.expenses.filter(e => e.id !== updated.id).concat(updated);
        state.trip = cleanTrip({ ...state.trip, expenses });
        tripSaveView();
      }, "primary"),
      record.id ? tripButton("Remover gasto", "x", () => {
        if (!confirm("Remover este gasto?")) return;
        state.trip.expenses = state.trip.expenses.filter(e => e.id !== record.id);
        tripSaveView();
      }, "danger") : null, closeBtn()));
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = h("a", { download: name });
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function tripBackup() {
  const data = {
    format: "guia-orlando-viagem", version: 1,
    trip: state.trip, home: state.home, homeLat: state.homeLat, homeLng: state.homeLng,
    tripStart: state.tripStart, tripEnd: state.tripEnd,
    agenda: state.agenda, plan: state.plan, routeOrder: state.routeOrder, stores: state.stores,
    people: state.people, items: state.items.map(({ foto, ...item }) => item), done: state.done
  };
  saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "guia-orlando-viagem-" + agendaToday() + ".json");
}
function sheetRestoreTrip() {
  const file = h("input", { type: "file", accept: ".json,application/json" });
  openSheet(h("h2", { text: "Restaurar cópia da viagem" }), tripField("Arquivo JSON", file),
    h("p", { class: "small muted", text: "A restauração substitui os dados da viagem deste aparelho. Guarde uma cópia antes, se quiser manter os dados atuais." }),
    h("div", { class: "btns" }, tripButton("Conferir arquivo", "list", async () => {
      if (!file.files[0] || file.files[0].size > 1500000) { toast("Selecione um arquivo de backup de até 1,5 MB"); return; }
      try {
        const data = JSON.parse(await file.files[0].text());
        if (data?.format !== "guia-orlando-viagem" || data.version !== 1 || !Array.isArray(data.agenda) || !data.trip) throw new Error("formato");
        const trip = cleanTrip(data.trip);
        const snapshot = cleanSharedTrip(data);
        const stores = Array.isArray(data.stores) ? cleanStores(data.stores) : null;
        openSheet(h("h2", { text: "Conferir restauração" }), h("p", { text: (trip.title || "Orlando") + " · " + snapshot.agenda.length + " atividades · " + trip.reservations.length + " reservas" + (stores ? " · " + stores.length + " lojas" : "") }),
          h("p", { class: "small muted", text: "Confirme para substituir os dados locais por esta cópia." }),
          h("div", { class: "btns" }, tripButton("Restaurar esta viagem", "check", () => {
            detachTripCloud();
            applySharedTrip(snapshot);
            state.trip = trip;
            if (stores) state.stores = stores;
            state.home = str(data.home, 160);
            state.homeLat = coord(data.homeLat, 90);
            state.homeLng = coord(data.homeLng, 180);
            agSel = "";
            state.routeDate = "";
            tripSaveView();
          }, "primary"), closeBtn()));
      } catch { toast("Arquivo de backup inválido"); }
    }, "primary"), closeBtn()));
}

function sheetDayMap(day) {
  const stops = routeStops(day);
  const located = stops.map((stop, index) => ({ stop, index, point: stopCoords(stop) })).filter(x => x.point);
  const canvas = h("div", { class: "trip-map", "aria-label": "Mapa das paradas" });
  let dayMap;
  const showTiles = tripButton("Carregar mapa de ruas", "map", () => {
    if (!navigator.onLine) { toast("Conecte-se para carregar o mapa de ruas"); return; }
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(dayMap);
    showTiles.disabled = true;
  }, "tonal sm");
  openSheet(h("h2", { text: "Mapa das paradas" }), h("p", { class: "small muted", text: tripDateLabel(day) + " · ligações em linha reta" }),
    located.length ? canvas : h("p", { class: "empty", text: "Ainda não há paradas com coordenadas cadastradas." }),
    located.length < stops.length ? h("p", { class: "small muted", text: "Paradas sem coordenadas aparecem na lista abaixo." }) : null,
    h("ol", { class: "trip-map-list" }, ...stops.map(stop => h("li", { text: stop.n }))),
    h("div", { class: "btns" }, located.length && window.L ? showTiles : null,
      CLOUD.routes ? tripButton("Calcular tempo com trânsito", "car", () => sheetRoadEstimate(day), "tonal sm") : null,
      tripButton("Abrir trajeto no Google Maps", "nav", openRoute, "primary sm"), closeBtn()));
  if (!located.length || !window.L) return;
  dayMap = L.map(canvas, { attributionControl: true, scrollWheelZoom: false });
  const points = located.map(({ stop, index, point }) => {
    const at = [point.la, point.lo];
    L.circleMarker(at, { radius: 10, color: "#fff", fillColor: "#16304C", weight: 2, fillOpacity: 1 })
      .bindTooltip(h("span", { text: String(index + 1) }), { permanent: true, direction: "top", offset: [0, -6] })
      .bindPopup(h("span", { text: stop.n })).addTo(dayMap);
    return at;
  });
  if (points.length > 1 && points.length === stops.length) L.polyline(points, { color: "#A74634", dashArray: "6 6" }).addTo(dayMap);
  dayMap.fitBounds(points, { padding: [22, 25], maxZoom: 14 });
  const observer = new ResizeObserver(() => dayMap.invalidateSize({ pan: false }));
  observer.observe(canvas);
  sheetCleanup = () => { observer.disconnect(); dayMap.remove(); };
}

function sheetRoadEstimate(day) {
  const stops = routeStops(day);
  if (stops.some(s => s.choices > 1 && !s.pId)) { toast("Escolha as unidades das lojas antes de calcular"); return; }
  const places = stops.map(s => s.q || s.a);
  if (state.home) places.unshift(state.home);
  if (places.length < 2 || places.length > 12) { toast("Use de 2 a 12 pontos para calcular o trajeto"); return; }
  const status = h("div", { class: "small", role: "status" });
  const estimate = tripButton("Consultar tempo agora", "car", () => runCloudAction(estimate, status, async () => {
    if (!cloudSession) throw new Error("Entre na conta em Família e backup para consultar.");
    const route = await cloudRequest("/functions/v1/guia-route", { places }, await cloudToken());
    if (!Number.isFinite(route?.seconds) || !Number.isFinite(route?.meters)) throw new Error("Trajeto indisponível.");
    const minutes = Math.ceil(route.seconds / 60);
    status.replaceChildren(h("p", { text: Math.round(route.meters / 1000) + " km · cerca de " + minutes + " min de carro" }),
      h("p", { class: "muted", text: "Estimativa do Google Maps consultada agora. Mantém a ordem do roteiro e não inclui tempo nas paradas." }));
  }), "primary");
  openSheet(h("h2", { text: "Tempo pelas ruas" }),
    h("p", { class: "small muted", text: "Esta consulta usa o trânsito atual. Ao confirmar, os endereços das paradas e o ponto de partida cadastrado são enviados ao Google Maps." }),
    status, h("div", { class: "btns" }, estimate, closeBtn()));
}
