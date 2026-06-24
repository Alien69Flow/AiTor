// OpenWeather proxy — keeps OPENWEATHER_API_KEY server-side.
// GET /openweather?lat=..&lon=..  -> current weather JSON
// GET /openweather?points=lat,lon;lat,lon  -> batched array
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isCoord(v: string | null, max: number): boolean {
  if (!v) return false;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max;
}

const KEY = Deno.env.get("OPENWEATHER_API_KEY");

async function fetchOne(lat: string, lon: string) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  return {
    lat: Number(lat),
    lon: Number(lon),
    clouds: d?.clouds?.all ?? 0,
    rain: d?.rain?.["1h"] ?? d?.rain?.["3h"] ?? 0,
    temp: d?.main?.temp ?? null,
    wind: d?.wind?.speed ?? null,
    desc: d?.weather?.[0]?.main ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!KEY) {
      return new Response(JSON.stringify({ error: "OPENWEATHER_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = new URL(req.url);
    const points = url.searchParams.get("points");
    if (points) {
      const parsed = points
        .split(";")
        .map((s) => s.split(","))
        .filter((p) => p.length === 2 && isCoord(p[0], 90) && isCoord(p[1], 180));
      // Cap at 60 to respect OWM free tier (60 req/min)
      const capped = parsed.slice(0, 60);
      const out = await Promise.all(capped.map(([la, lo]) => fetchOne(la, lo).catch(() => null)));
      return new Response(JSON.stringify(out.filter(Boolean)), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      });
    }
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!isCoord(lat, 90) || !isCoord(lon, 180)) {
      return new Response(JSON.stringify({ error: "valid lat/lon or points required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await fetchOne(lat!, lon!);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err).slice(0, 200) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});