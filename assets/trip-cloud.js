/* ---------------- viagem compartilhada, opcional ---------------- */
const CLOUD_LINK_KEY = "guia.viagem.link";
const CLOUD_SESSION_KEY = "guia.viagem.sessao";
let cloudLink = null;
let cloudSession = null;
let cloudSyncTimer;
let cloudBusy = false;
let cloudConflict = null;
let cloudMessage = "";
let cloudRefresh = null;

function cleanSharedTrip(value) {
  const data = value && typeof value === "object" ? value : {};
  const trip = cleanTrip(data.trip);
  const done = Object.fromEntries(Object.entries(data.done || {}).filter(([key, flag]) => flag === true && key.length <= 60).sort().slice(0, 2000));
  return {
    trip: { title: trip.title, travelers: trip.travelers },
    tripStart: tripDate(data.tripStart), tripEnd: tripDate(data.tripEnd),
    agenda: cleanAgenda(data.agenda), plan: cleanPlan(tripList(data.plan, 60)),
    routeOrder: cleanRouteOrder(data.routeOrder),
    people: cleanPeople(tripList(data.people, 50)),
    items: cleanItems(tripList(data.items, 500)).map(({ foto, fotoUrl, ...item }) => item),
    done
  };
}
function sharedTripSnapshot() { return cleanSharedTrip(state); }
function applySharedTrip(data, keepPhotos = false) {
  const { trip, items, ...fields } = cleanSharedTrip(data);
  const photos = new Map(keepPhotos ? state.items.map(x => [x.id, x]) : []);
  Object.assign(state, fields);
  Object.assign(state.trip, trip);
  state.items = items.map(item => ({ ...item, foto: photos.get(item.id)?.foto || "", fotoUrl: photos.get(item.id)?.fotoUrl || "" }));
}
function cloudString() { return JSON.stringify(sharedTripSnapshot()); }
function setCloudLink(link) {
  cloudLink = link;
  cloudConflict = null;
  try {
    if (link) localStorage.setItem(CLOUD_LINK_KEY, JSON.stringify(link));
    else localStorage.removeItem(CLOUD_LINK_KEY);
  } catch { toast("Não foi possível guardar o vínculo neste aparelho"); }
}
function detachTripCloud() {
  clearTimeout(cloudSyncTimer);
  setCloudLink(null);
}
function setCloudSession(session) {
  cloudSession = session;
  try {
    if (session) sessionStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(CLOUD_SESSION_KEY);
  } catch { /* mantém a sessão enquanto a página estiver aberta */ }
}
function loadCloudSession(data) {
  if (!data?.access_token || !data.refresh_token || !data.user?.id) throw new Error("Sessão inválida");
  setCloudSession({ token: data.access_token, refresh: data.refresh_token, user: data.user.id,
    email: data.user.email || "", expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 });
}
async function cloudRequest(path, body, token) {
  if (!navigator.onLine) throw new Error("Conecte-se à internet para continuar.");
  const res = await fetch(CLOUD.url + path, {
    method: "POST", signal: AbortSignal.timeout(12000), cache: "no-store", referrerPolicy: "no-referrer",
    headers: { apikey: CLOUD.key, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(res.status === 429 ? "Muitas tentativas. Aguarde um pouco." : "Não foi possível concluir a operação online.");
    error.status = res.status;
    throw error;
  }
  return data;
}
async function cloudToken() {
  if (!cloudSession) throw new Error("Entre para sincronizar.");
  if (cloudSession.expires > Date.now() + 60000) return cloudSession.token;
  if (!cloudRefresh) {
    const previous = cloudSession;
    cloudRefresh = cloudRequest("/auth/v1/token?grant_type=refresh_token", { refresh_token: previous.refresh })
      .then(data => { if (cloudSession === previous) loadCloudSession(data); })
      .catch(error => { if ([400, 401, 403].includes(error.status) && cloudSession === previous) setCloudSession(null); throw error; })
      .finally(() => { cloudRefresh = null; });
  }
  await cloudRefresh;
  if (!cloudSession) throw new Error("Entre novamente para sincronizar.");
  return cloudSession.token;
}
async function tripRPC(action, params = {}) {
  return cloudRequest("/rest/v1/rpc/guia_" + action, params, await cloudToken());
}
function queueTripSync() {
  if (!cloudLink || !cloudSession || cloudLink.user !== cloudSession.user || cloudBusy || cloudConflict || !navigator.onLine) return;
  if (cloudString() === cloudLink.base) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(syncTrip, 900);
}
async function syncTrip(forceLocal = false) {
  const link = cloudLink;
  if (!link || !cloudSession || cloudSession.user !== link.user || !navigator.onLine || cloudBusy || (cloudConflict && !forceLocal)) return;
  const revision = forceLocal ? cloudConflict?.revision : link.revision;
  if (revision == null) return;
  const snapshot = sharedTripSnapshot();
  const before = JSON.stringify(snapshot);
  const sending = forceLocal || before !== link.base;
  cloudBusy = true;
  let synced = false;
  try {
    const args = { p_trip: link.id, p_revision: revision };
    const remote = sending ? await tripRPC("push_trip", { ...args, p_snapshot: snapshot }) : await tripRPC("read_trip", args);
    if (cloudLink !== link) return;
    if (!remote || typeof remote.revision !== "number") throw new Error("Resposta inválida");
    if (remote.conflict || (!sending && remote.snapshot && cloudString() !== before)) {
      cloudConflict = remote;
      cloudMessage = "Há alterações nos dois aparelhos. Escolha qual versão manter.";
      return;
    }
    if (!sending && remote.snapshot) {
      applySharedTrip(remote.snapshot, true);
      save();
      if (!sheetOpen) tripRefresh();
    }
    setCloudLink({ ...link, revision: remote.revision, base: sending ? before : cloudString() });
    cloudMessage = "Sincronizada em " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    synced = true;
  } catch { cloudMessage = "Sincronização pendente. A programação continua salva neste aparelho."; }
  finally {
    cloudBusy = false;
    if (currentView === "familia" && !sheetOpen) renderTripFamily();
    if (synced) queueTripSync();
  }
}
function startTripSync() {
  if (CLOUD.url) {
    try {
      const link = JSON.parse(localStorage.getItem(CLOUD_LINK_KEY));
      if (link?.id && link.user && typeof link.revision === "number" && typeof link.base === "string") cloudLink = link;
      const session = JSON.parse(sessionStorage.getItem(CLOUD_SESSION_KEY));
      if (session?.user && session.token && session.refresh) cloudSession = session;
    } catch { /* abre a viagem local */ }
    const poll = () => { if (!document.hidden && !sheetOpen) syncTrip(); };
    setInterval(poll, 45000);
    document.addEventListener("visibilitychange", poll);
    poll();
  }
  const refreshConnection = () => {
    if (currentView === "viagem" || currentView === "familia") renderTripView(currentView);
    if (CLOUD.url) syncTrip();
  };
  window.addEventListener("online", refreshConnection);
  window.addEventListener("offline", refreshConnection);
}
function renderTripFamily() {
  const v = tripHeader("familia", "Família e backup", "Convide a família para acompanhar a mesma programação ou guarde uma cópia da viagem.");
  const cloud = h("section", { class: "card" }, h("h2", { text: "Viagem compartilhada" }));
  if (!CLOUD.url) {
    cloud.appendChild(h("p", { class: "small muted", text: "A sincronização online ainda não está configurada. Neste aparelho, você já pode exportar ou restaurar uma cópia." }));
  } else if (!cloudSession) {
    cloud.append(h("p", { class: "small muted", text: "Entre por e-mail para criar uma viagem compartilhada ou aceitar um convite." }),
      tripButton("Entrar por e-mail", "share", sheetCloudLogin, "primary"));
  } else {
    cloud.append(h("p", { class: "small muted", text: cloudSession.email }),
      h("p", { class: "small", text: cloudLink?.user === cloudSession.user ? (cloudMessage || "Viagem vinculada neste aparelho") : "Nenhuma viagem vinculada a esta sessão." }));
    const actions = h("div", { class: "btns" });
    if (cloudLink?.user === cloudSession.user) {
      actions.appendChild(tripButton("Sincronizar agora", "check", () => syncTrip(), "primary"));
      if (cloudLink.role === "owner") actions.append(tripButton("Gerar convite", "share", sheetCloudInvite, "tonal"),
        tripButton("Gerenciar acesso", "passport", sheetCloudAccess, "sm"));
      if (cloudConflict) actions.appendChild(tripButton("Resolver alterações", "alert", sheetCloudConflict, "tonal"));
      actions.appendChild(tripButton("Desvincular neste aparelho", "", () => { detachTripCloud(); renderTripFamily(); }, "sm"));
    } else {
      actions.append(tripButton("Compartilhar minha viagem", "share", sheetCloudCreate, "primary"),
        tripButton("Aceitar convite", "plus", sheetCloudJoin, "tonal"),
        tripButton("Abrir viagem compartilhada", "list", sheetCloudTrips));
    }
    actions.appendChild(tripButton("Sair da conta", "", () => { setCloudSession(null); renderTripFamily(); }, "sm"));
    cloud.appendChild(actions);
  }
  v.append(cloud, h("section", { class: "card" }, h("h2", { text: "Cópia da viagem" }),
    h("p", { class: "small muted", text: "O arquivo inclui programação, lojas cadastradas, reservas, gastos e lista. Fotos e anexos ficam fora da cópia." }),
    h("div", { class: "btns" }, tripButton("Baixar cópia", "device", tripBackup, "primary"), tripButton("Restaurar cópia", "list", sheetRestoreTrip, "tonal"))));
}
function runCloudAction(button, status, action) {
  if (button.disabled) return;
  button.disabled = true;
  status.textContent = "Aguarde…";
  Promise.resolve().then(action).catch(error => { status.textContent = error.message || "Tente novamente."; })
    .finally(() => { button.disabled = false; });
}
function sheetCloudLogin() {
  const email = h("input", { type: "email", autocomplete: "email", maxlength: 254 });
  const code = h("input", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 10 });
  const status = h("p", { class: "small muted", role: "status" });
  let sentTo = "";
  const send = tripButton("Enviar código", "share", () => runCloudAction(send, status, async () => {
    if (!email.value.trim() || !email.checkValidity()) throw new Error("Informe um e-mail válido.");
    const destination = email.value.trim();
    await cloudRequest("/auth/v1/otp", { email: destination, create_user: true });
    sentTo = destination;
    status.textContent = "Digite o código recebido em " + sentTo + ".";
  }), "tonal");
  const enter = tripButton("Entrar", "check", () => runCloudAction(enter, status, async () => {
    if (!sentTo || !/^\d{6,10}$/.test(code.value.trim())) throw new Error("Envie o código por e-mail e digite os números recebidos.");
    const result = await cloudRequest("/auth/v1/verify", { email: sentTo, token: code.value.trim(), type: "email" });
    loadCloudSession(result);
    closeSheet(); renderTripFamily(); syncTrip();
  }), "primary");
  openSheet(h("h2", { text: "Entrar por e-mail" }), tripField("E-mail", email), send,
    tripField("Código recebido", code), status, h("div", { class: "btns" }, enter, closeBtn()));
}
function linkCloudTrip(remote) {
  if (!remote?.id || !remote.snapshot || typeof remote.revision !== "number") throw new Error("Viagem indisponível.");
  applySharedTrip(remote.snapshot);
  state.routeDate = "";
  agSel = "";
  setCloudLink({ id: remote.id, user: cloudSession.user, role: remote.role, revision: remote.revision, base: cloudString() });
  cloudMessage = "Viagem vinculada";
  tripSaveView();
}
function sheetCloudCreate() {
  const status = h("p", { class: "small muted", role: "status" });
  const create = tripButton("Criar viagem compartilhada", "share", () => runCloudAction(create, status, async () => {
    const sent = sharedTripSnapshot();
    const remote = await tripRPC("create_trip", { p_snapshot: sent });
    if (!remote?.id) throw new Error("Não foi possível criar a viagem.");
    setCloudLink({ id: remote.id, user: cloudSession.user, role: "owner", revision: remote.revision, base: JSON.stringify(sent) });
    cloudMessage = "Viagem vinculada";
    closeSheet(); renderTripFamily(); queueTripSync();
  }), "primary");
  openSheet(h("h2", { text: "Compartilhar minha viagem" }),
    h("p", { text: "Pessoas convidadas poderão ver e editar as datas, a programação, o roteiro e os pedidos de compra." }),
    h("p", { class: "small muted", text: "Endereço pessoal, reservas, anexos, fotos e gastos ficam neste aparelho. Confira os itens da lista antes de compartilhar." }),
    status, h("div", { class: "btns" }, create, closeBtn()));
}
function sheetCloudInvite() {
  const email = h("input", { type: "email", autocomplete: "email", maxlength: 254 });
  const status = h("p", { class: "small muted", role: "status" });
  const create = tripButton("Gerar código", "share", () => runCloudAction(create, status, async () => {
    if (!email.value.trim() || !email.checkValidity()) throw new Error("Informe o e-mail da pessoa convidada.");
    const remote = await tripRPC("invite_trip", { p_trip: cloudLink.id, p_email: email.value.trim() });
    const input = h("input", { readonly: true, value: remote.code, "aria-label": "Código de convite" });
    openSheet(h("h2", { text: "Convite gerado" }),
      h("p", { text: "Envie o código à pessoa convidada. Ela deve entrar no Guia com o mesmo e-mail e tocar em Aceitar convite." }),
      input, h("div", { class: "btns" }, tripButton("Copiar código", "share", async () => {
        try { await navigator.clipboard.writeText(remote.code); toast("Código copiado"); } catch { input.select(); }
      }, "primary"), closeBtn()));
  }), "primary");
  openSheet(h("h2", { text: "Convidar viajante" }), tripField("E-mail de quem vai participar", email),
    h("p", { class: "small muted", text: "O código é válido por 72 horas e só pode ser usado pelo e-mail informado." }), status,
    h("div", { class: "btns" }, create, closeBtn()));
}
async function sheetCloudAccess() {
  const id = cloudLink.id;
  const status = h("div", { role: "status" }, h("p", { class: "small muted", text: "Carregando…" }));
  openSheet(h("h2", { text: "Gerenciar acesso" }), status, closeBtn());
  try {
    const data = await tripRPC("trip_access", { p_trip: id });
    const records = data.members.map(user => ({ ...user, label: "Acesso de edição", action: "Remover acesso" }))
      .concat(data.invites.map(email => ({ email, id: null, label: "Convite pendente", action: "Cancelar convite" })));
    if (!records.length) { status.textContent = "Nenhum convite ou participante ativo."; return; }
    status.replaceChildren(...records.map(record => {
      const message = h("p", { class: "small muted" });
      const remove = tripButton(record.action, "x", () => {
        if (!confirm(record.action + " para " + record.email + "?")) return;
        runCloudAction(remove, message, async () => {
          await tripRPC("revoke_access", { p_trip: id, p_user: record.id, p_email: record.email });
          await sheetCloudAccess();
        });
      }, "sm");
      return h("div", { class: "card flat" }, h("b", { text: record.email }), h("p", { class: "small muted", text: record.label }), remove, message);
    }));
  } catch { status.textContent = "Não foi possível carregar os acessos."; }
}
function sheetCloudJoin() {
  const code = h("input", { maxlength: 48, autocomplete: "off", autocapitalize: "off" });
  const status = h("p", { class: "small muted", role: "status" });
  const join = tripButton("Vincular viagem", "check", () => runCloudAction(join, status, async () => {
    if (!/^[a-f0-9]{32}$/i.test(code.value.trim())) throw new Error("Confira o código de convite.");
    linkCloudTrip(await tripRPC("join_trip", { p_code: code.value.trim().toLowerCase() }));
  }), "primary");
  openSheet(h("h2", { text: "Aceitar convite" }), tripField("Código recebido", code),
    h("p", { class: "small muted", text: "Vincular substitui programação, rota e lista deste aparelho pelos dados compartilhados. Reservas e gastos locais são preservados." }),
    status, h("div", { class: "btns" }, tripButton("Baixar cópia primeiro", "device", tripBackup, "tonal"), join, closeBtn()));
}
async function sheetCloudTrips() {
  const box = h("div", { class: "list" }, h("p", { class: "empty", text: "Buscando viagens…" }));
  openSheet(h("h2", { text: "Viagens compartilhadas" }), box, closeBtn());
  try {
    const trips = await tripRPC("list_trips");
    box.replaceChildren(...trips.map(trip => tripRow("home", str(trip.title, 80) || "Orlando", trip.role === "owner" ? "Organizador" : "Convidado", () => sheetCloudOpen(trip.id))));
    if (!trips.length) box.appendChild(h("p", { class: "empty", text: "Nenhuma viagem compartilhada nesta conta." }));
  } catch { box.replaceChildren(h("p", { class: "empty", text: "Não consegui carregar as viagens." })); }
}
function sheetCloudOpen(id) {
  const status = h("p", { class: "small muted", role: "status" });
  const load = tripButton("Abrir esta viagem", "check", () => runCloudAction(load, status, async () => {
    linkCloudTrip(await tripRPC("read_trip", { p_trip: id, p_revision: -1 }));
  }), "primary");
  openSheet(h("h2", { text: "Abrir viagem compartilhada" }),
    h("p", { text: "Isso substitui a programação, a rota e a lista locais pela versão compartilhada." }), status,
    h("div", { class: "btns" }, tripButton("Baixar cópia primeiro", "device", tripBackup, "tonal"), load, closeBtn()));
}
function sheetCloudConflict() {
  const remote = cloudConflict;
  if (!remote) return;
  openSheet(h("h2", { text: "Alterações em dois aparelhos" }),
    h("p", { text: "Sua versão ficou salva neste aparelho. Escolha qual programação, roteiro e lista devem valer para todos." }),
    h("div", { class: "btns" }, tripButton("Baixar cópia local", "device", tripBackup, "tonal"),
      tripButton("Usar versão compartilhada", "check", () => linkCloudTrip({ ...remote, id: cloudLink.id, role: cloudLink.role })),
      tripButton("Publicar esta versão", "share", () => { closeSheet(); syncTrip(true); }), closeBtn()));
}
