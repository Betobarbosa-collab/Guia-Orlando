const allowedOrigins = (Deno.env.get("GUIA_ALLOWED_ORIGINS") || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (!allowedOrigins.includes(origin)) return new Response(null, { status: 403 });
  const cors = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
  const respond = (data: unknown, status = 200) => Response.json(data, {
    status, headers: { ...cors, "Cache-Control": "no-store" }
  });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return respond({ error: "Método inválido" }, 405);

  const supabase = Deno.env.get("SUPABASE_URL");
  const apikey = Deno.env.get("GUIA_CLOUD_PUBLISHABLE_KEY");
  const googleKey = Deno.env.get("GOOGLE_ROUTES_API_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabase || !apikey || !googleKey) return respond({ error: "Rotas não configuradas" }, 503);
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Entre para consultar" }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 6000) return respond({ error: "Trajeto muito longo" }, 413);
    const { places } = JSON.parse(raw);
    if (!Array.isArray(places) || places.length < 2 || places.length > 12 ||
      places.some((address) => typeof address !== "string" || !address.trim() || address.length > 400)) {
      return respond({ error: "Endereços inválidos" }, 400);
    }
    const quota = await fetch(supabase + "/rest/v1/rpc/guia_reserve_route", {
      method: "POST", signal: AbortSignal.timeout(3000),
      headers: { apikey, Authorization: authorization, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!quota.ok) return respond({ error: "Sessão inválida ou consulta indisponível" }, quota.status === 401 ? 401 : 502);
    if (await quota.json() !== true) return respond({ error: "Limite diário atingido" }, 429);

    const waypoint = (address: string) => ({ address });
    const result = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
      body: JSON.stringify({
        origin: waypoint(places[0]), destination: waypoint(places.at(-1)),
        intermediates: places.slice(1, -1).map(waypoint),
        travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "pt-BR", units: "METRIC"
      })
    });
    if (!result.ok) return respond({ error: "Trajeto indisponível" }, 502);
    const route = (await result.json()).routes?.[0];
    const seconds = Number.parseFloat(route?.duration);
    if (!Number.isFinite(seconds) || !Number.isFinite(route?.distanceMeters)) return respond({ error: "Trajeto indisponível" }, 404);
    return respond({ seconds, meters: route.distanceMeters });
  } catch { return respond({ error: "Não foi possível consultar o trajeto" }, 502); }
});
