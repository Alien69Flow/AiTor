// OpenSky Network API - Air Traffic Data
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENSKY_API = "https://opensky-network.org/api";
const DEFAULT_BOUNDS = { lamin: 35, lamax: 55, lomin: -10, lomax: 30 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const blocked = guardPublic(req, corsHeaders, 120);
  if (blocked) return blocked;

  try {
    const url = new URL(req.url);
    const bounds = {
      lamin: parseBound(url.searchParams.get("lamin"), DEFAULT_BOUNDS.lamin, -90, 90),
      lamax: parseBound(url.searchParams.get("lamax"), DEFAULT_BOUNDS.lamax, -90, 90),
      lomin: parseBound(url.searchParams.get("lomin"), DEFAULT_BOUNDS.lomin, -180, 180),
      lomax: parseBound(url.searchParams.get("lomax"), DEFAULT_BOUNDS.lomax, -180, 180),
    };

    if (bounds.lamin >= bounds.lamax || bounds.lomin >= bounds.lomax) {
      return jsonResponse({ error: "Invalid air-traffic bounding box" }, 400);
    }

    const query = new URLSearchParams({
      lamin: String(bounds.lamin),
      lamax: String(bounds.lamax),
      lomin: String(bounds.lomin),
      lomax: String(bounds.lomax),
    });
    const response = await fetch(`${OPENSKY_API}/states/all?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn("OpenSky returned an upstream error:", response.status);
      return jsonResponse({ error: "Air-traffic provider unavailable", upstreamStatus: response.status }, 502);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.states)) {
      return jsonResponse({ error: "Invalid response from air-traffic provider" }, 502);
    }

    // OpenSky state-vector indexes: longitude=5, latitude=6. Index 3 is
    // position time and index 4 is last-contact time; neither is a destination.
    const flights = data.states
      .filter((state: unknown) => Array.isArray(state) && state.length >= 11)
      .map((state: any) => {
        const latitude = state[6];
        const longitude = state[5];
        if (
          typeof latitude !== "number" || !Number.isFinite(latitude) ||
          typeof longitude !== "number" || !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
        ) return null;

        const lastContact = typeof state[4] === "number" && Number.isFinite(state[4])
          ? new Date(state[4] * 1000).toISOString()
          : new Date().toISOString();

        return {
          icao24: typeof state[0] === "string" ? state[0].toLowerCase() : "",
          callsign: typeof state[1] === "string" ? state[1].trim() || "UNKNOWN" : "UNKNOWN",
          origin: typeof state[2] === "string" ? state[2] : null,
          destination: null,
          latitude,
          longitude,
          altitude: typeof state[7] === "number" && Number.isFinite(state[7]) ? Math.round(state[7]) : 0,
          velocity: typeof state[9] === "number" && Number.isFinite(state[9]) ? Math.round(state[9]) : 0,
          heading: typeof state[10] === "number" && Number.isFinite(state[10]) ? Math.round(state[10]) : 0,
          timestamp: lastContact,
        };
      })
      .filter((flight: unknown) => flight !== null)
      .slice(0, 80);

    if (flights.length === 0) {
      return jsonResponse({ error: "Air-traffic provider returned no aircraft with valid positions" }, 502);
    }

    return jsonResponse({
      count: flights.length,
      flights,
      bbox: bounds,
      mock: false,
      timestamp: new Date().toISOString(),
    }, 200, 120);
  } catch (err) {
    console.error("Air-traffic provider request failed:", err);
    return jsonResponse({ error: "Air-traffic provider unavailable" }, 502);
  }
});

function parseBound(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN;
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
