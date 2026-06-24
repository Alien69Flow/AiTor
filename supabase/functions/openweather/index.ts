// OpenWeather proxy — keeps OPENWEATHER_API_KEY server-side.
// GET /openweather?lat=..&lon=..  -> current weather JSON
// GET /openweather?points=lat,lon;lat,lon  -> batched array
// GET /openweather?tile=clouds_new&z=2&x=1&y=1  -> PNG raster tile (proxied)
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
const ALLOWED_TILE_LAYERS = new Set([
  "clouds_new",
  "precipitation_new",
  "wind_new",
  "pressure_new",
  "temp_new",
]);

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

    // Tile proxy: keeps the API key server-side while letting the globe
    // overlay OpenWeatherMap raster layers (clouds/precip/wind/pressure).
    const tile = url.searchParams.get("tile");
    if (tile) {
      if (!ALLOWED_TILE_LAYERS.has(tile)) {
        return new Response(JSON.stringify({ error: "invalid tile layer" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const z = Number(url.searchParams.get("z"));
      const x = Number(url.searchParams.get("x"));
      const y = Number(url.searchParams.get("y"));
      if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
          z < 0 || z > 6 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
        return new Response(JSON.stringify({ error: "invalid z/x/y" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const upstream = `https://tile.openweathermap.org/map/${tile}/${z}/${x}/${y}.png?appid=${KEY}`;
      const r = await fetch(upstream);
      if (!r.ok) {
        return new Response(JSON.stringify({ error: `tile upstream ${r.status}` }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const buf = await r.arrayBuffer();
      return new Response(buf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=600",
        },
      });
    }

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