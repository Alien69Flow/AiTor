// Aggregated public globe feeds (internet outages, NASA FIRMS active fires).
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IODA = "https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary";

async function outages() {
  const until = Math.floor(Date.now() / 1000);
  const from = until - 24 * 3600;
  const res = await fetch(
    `${IODA}?from=${from}&until=${until}&entityType=country&limit=40`,
    { signal: AbortSignal.timeout(9000) },
  );
  if (!res.ok) throw new Error(`IODA ${res.status}`);
  const json = await res.json();
  return (json?.data ?? [])
    .filter((d: any) => d?.entity?.code && (d?.event_cnt ?? 0) > 0)
    .map((d: any) => ({
      code: String(d.entity.code).toUpperCase(),
      name: d.entity.name as string,
      events: d.event_cnt as number,
      score: Math.round(d?.scores?.overall ?? 0),
    }));
}

/** NASA FIRMS VIIRS active fire detections for a country (ISO3), last 24h. */
async function firms(country: string) {
  const key = Deno.env.get("NASA_FIRMS_MAP_KEY") ?? Deno.env.get("FIRMS_MAP_KEY");
  if (!key) return { fires: [], note: "FIRMS map key not configured" };

  const safeCountry = /^[A-Z]{3}$/.test(country) ? country : "ESP";
  const url =
    `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${key}/VIIRS_NOAA20_NRT/${safeCountry}/1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const csv = await res.text();
  const [head, ...rows] = csv.trim().split("\n");
  const cols = head.split(",").map((c) => c.trim());
  const idx = (n: string) => cols.indexOf(n);

  const fires = rows.slice(0, 800).map((line, i) => {
    const v = line.split(",");
    return {
      id: `firms-${safeCountry}-${i}`,
      lat: Number(v[idx("latitude")]),
      lon: Number(v[idx("longitude")]),
      brightness: Number(v[idx("bright_ti4")] ?? 0),
      confidence: String(v[idx("confidence")] ?? ""),
      acquired: `${v[idx("acq_date")] ?? ""} ${v[idx("acq_time")] ?? ""}`.trim(),
      satellite: String(v[idx("satellite")] ?? "VIIRS"),
    };
  }).filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon));

  return { fires };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const blocked = guardPublic(req, corsHeaders, 60);
  if (blocked) return blocked;

  const url = new URL(req.url);
  const feed = url.searchParams.get("feed") ?? "outages";
  const json = (body: unknown, maxAge = 600) =>
    new Response(JSON.stringify(body), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${maxAge}`,
      },
    });

  try {
    if (feed === "outages") {
      return json({ outages: await outages(), timestamp: new Date().toISOString() });
    }
    if (feed === "firms") {
      const country = (url.searchParams.get("country") ?? "ESP").toUpperCase();
      const data = await firms(country);
      return json({ ...data, country, timestamp: new Date().toISOString() }, 1800);
    }
    return new Response(JSON.stringify({ error: "unknown feed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("globe-feeds error:", err);
    // Silent-fail contract: always 200 with empty payload so one dead upstream
    // never breaks the other globe layers.
    return new Response(
      JSON.stringify({
        outages: [],
        fires: [],
        error: String(err).slice(0, 200),
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
