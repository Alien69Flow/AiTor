// Marine traffic endpoint. Return provider-backed AIS data only; never label generated
// coordinates as live vessel positions.
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const blocked = guardPublic(req, corsHeaders, 180);
  if (blocked) return blocked;

  const url = new URL(req.url);
  const bounds = {
    minLat: parseBound(url.searchParams.get("minLat"), 30, -90, 90),
    maxLat: parseBound(url.searchParams.get("maxLat"), 55, -90, 90),
    minLon: parseBound(url.searchParams.get("minLon"), -20, -180, 180),
    maxLon: parseBound(url.searchParams.get("maxLon"), 40, -180, 180),
  };

  if (
    !Object.values(bounds).every(Number.isFinite) ||
    bounds.minLat >= bounds.maxLat ||
    bounds.minLon >= bounds.maxLon
  ) {
    return jsonResponse({ error: "Invalid marine-traffic bounding box" }, 400);
  }

  const vesselFinderKey = Deno.env.get("VESSELFINDER_API_KEY");
  if (!vesselFinderKey) {
    return jsonResponse({ error: "Marine traffic provider is not configured" }, 503);
  }

  try {
    const query = new URLSearchParams({
      userkey: vesselFinderKey,
      bounds: `${bounds.minLat},${bounds.maxLat},${bounds.minLon},${bounds.maxLon}`,
    });
    const response = await fetch(`https://api.vesselfinder.com/vessels?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn("VesselFinder returned an upstream error:", response.status);
      return jsonResponse({ error: "Marine traffic provider unavailable", upstreamStatus: response.status }, 502);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.vessels)) {
      return jsonResponse({ error: "Invalid response from marine traffic provider" }, 502);
    }

    const ships = data.vessels
      .map((v: any) => {
        const latitude = parseFiniteNumber(v.LAT);
        const longitude = parseFiniteNumber(v.LON);
        if (
          latitude === null || longitude === null ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
        ) return null;

        const rawTimestamp = v.TIMESTAMP ?? v.TIME ?? v.LAST_POSITION;
        const parsedTimestamp = parseProviderTimestamp(rawTimestamp);
        return {
          mmsi: String(v.MMSI ?? "").trim(),
          name: String(v.NAME ?? "").trim() || "Unknown",
          type: String(v.TYPE ?? "").trim() || "Unknown",
          latitude,
          longitude,
          speed: parseFiniteNumber(v.SPEED) ?? 0,
          heading: parseFiniteNumber(v.HEADING) ?? 0,
          destination: String(v.DESTINATION ?? "").trim() || "Unknown",
          // Do not fabricate a fresh position timestamp when the provider omits it.
          timestamp: parsedTimestamp ?? "",
        };
      })
      .filter((ship: unknown) => ship !== null)
      .slice(0, 100);

    if (ships.length === 0) {
      return jsonResponse({ error: "Marine traffic provider returned no valid vessel positions" }, 502);
    }

    return jsonResponse({
      count: ships.length,
      ships,
      bbox: bounds,
      mock: false,
      timestamp: new Date().toISOString(),
    }, 200, 180);
  } catch (err) {
    console.error("Marine traffic provider request failed:", err);
    return jsonResponse({ error: "Marine traffic provider unavailable" }, 502);
  }
});

function parseBound(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProviderTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // AIS providers may return Unix seconds, Unix milliseconds, or a date string.
  if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function jsonResponse(body: Record<string, unknown>, status = 200, maxAgeSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${maxAgeSeconds}`,
    },
  });
}
