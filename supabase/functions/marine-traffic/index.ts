// Marine traffic — real ships only: VesselFinder when a key is configured, then
// the keyless Digitraffic AIS feed, then an explicit "unavailable".
//
// This function used to answer `generateMockShips()` whenever the upstream did
// not answer, and it had no key configured, so the globe painted 40 invented
// ships in the Mediterranean every three minutes and they were indistinguishable
// from live AIS. There is now no fabricated ship in this file: every row comes
// from a real AIS receiver network, and when none answers the response says so.
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Finnish Transport Agency open AIS feed: no key, no country block, CC BY 4.0. */
const DIGITRAFFIC_AIS = "https://meri.digitraffic.fi/api/ais/v1";
/** Cesium stops being fun past a few hundred billboards, and the payload matters. */
const MAX_SHIPS = 500;

/** Ship as the app consumes it. */
interface Ship {
  mmsi: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  /** Knots, as reported by AIS. */
  speed: number;
  heading: number;
  destination: string | null;
  timestamp: string;
}

/** One row of the VesselFinder `/vessels` response (its keys are uppercase). */
interface VesselFinderVessel {
  MMSI?: string;
  NAME?: string | null;
  TYPE?: string | null;
  LAT?: number | null;
  LON?: number | null;
  SPEED?: number | null;
  HEADING?: number | null;
  DESTINATION?: string | null;
}

/** One feature of the Digitraffic `/locations` GeoJSON answer. */
interface DigitrafficLocation {
  mmsi?: number;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mmsi?: number;
    sog?: number;
    cog?: number;
    heading?: number;
    timestampExternal?: number;
  };
}

/** One vessel of the Digitraffic `/vessels` metadata answer. */
interface DigitrafficVessel {
  mmsi?: number;
  name?: string | null;
  shipType?: number | null;
  destination?: string | null;
}

/**
 * AIS ship-type code → readable label. The 70s/80s blocks are what the app
 * actually displays most, so those are named individually.
 */
function shipTypeLabel(code: number | null | undefined): string {
  if (typeof code !== "number" || !Number.isFinite(code)) return "Unknown";
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 60 && code <= 69) return "Passenger";
  if (code >= 40 && code <= 49) return "High-speed craft";
  if (code === 30) return "Fishing";
  if (code === 36) return "Sailing";
  if (code === 52) return "Tug";
  if (code === 51) return "Search and rescue";
  if (code === 55) return "Law enforcement";
  if (code === 35) return "Military";
  if (code >= 20 && code <= 29) return "Wing in ground";
  if (code === 0) return "Not available";
  return "Other";
}

async function fetchVesselFinder(key: string, bounds: string): Promise<Ship[]> {
  const response = await fetch(
    `https://api.vesselfinder.com/vessels?userkey=${encodeURIComponent(key)}&bounds=${bounds}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(9_000) },
  );
  if (!response.ok) throw new Error(`VesselFinder HTTP ${response.status}`);
  const data = await response.json();
  const now = new Date().toISOString();
  return ((data.vessels ?? []) as VesselFinderVessel[])
    .filter((v) => typeof v.LAT === "number" && typeof v.LON === "number")
    .slice(0, MAX_SHIPS)
    .map((v) => ({
      mmsi: v.MMSI || "unknown",
      name: v.NAME || "Unknown",
      type: v.TYPE || "Unknown",
      latitude: v.LAT as number,
      longitude: v.LON as number,
      speed: Math.round((v.SPEED ?? 0) * 10) / 10,
      heading: Math.round(v.HEADING ?? 0),
      destination: v.DESTINATION || null,
      timestamp: now,
    }));
}

/**
 * Digitraffic publishes live AIS from the Finnish receiver network, so coverage
 * is the Baltic and the Finnish coast rather than the whole planet. That limit
 * is reported as `coverage` instead of being hidden: real ships in the Baltic
 * beat invented ships everywhere.
 */
async function fetchDigitraffic(): Promise<Ship[]> {
  const [locationsRes, vesselsRes] = await Promise.all([
    fetch(`${DIGITRAFFIC_AIS}/locations`, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip" },
      signal: AbortSignal.timeout(12_000),
    }),
    fetch(`${DIGITRAFFIC_AIS}/vessels`, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip" },
      signal: AbortSignal.timeout(12_000),
    }),
  ]);
  if (!locationsRes.ok) throw new Error(`Digitraffic locations HTTP ${locationsRes.status}`);

  const locations = (await locationsRes.json()) as { features?: DigitrafficLocation[] };
  // Names and types are static data; a failure here costs labels, not positions,
  // so it must not take the whole layer down.
  const vessels = vesselsRes.ok
    ? ((await vesselsRes.json()) as DigitrafficVessel[])
    : [];

  const meta = new Map<number, DigitrafficVessel>();
  for (const vessel of vessels) {
    if (typeof vessel.mmsi === "number") meta.set(vessel.mmsi, vessel);
  }

  return (locations.features ?? [])
    .map((feature) => {
      const coords = feature.geometry?.coordinates;
      const props = feature.properties ?? {};
      const mmsi = props.mmsi ?? feature.mmsi;
      if (!coords || typeof coords[0] !== "number" || typeof coords[1] !== "number") return null;
      if (typeof mmsi !== "number") return null;
      const info = meta.get(mmsi);
      const external = props.timestampExternal;
      return {
        mmsi: String(mmsi),
        name: info?.name || `MMSI ${mmsi}`,
        type: shipTypeLabel(info?.shipType),
        // GeoJSON is [longitude, latitude].
        longitude: coords[0],
        latitude: coords[1],
        speed: Math.round((props.sog ?? 0) * 10) / 10,
        heading: Math.round(props.heading ?? props.cog ?? 0),
        destination: info?.destination || null,
        timestamp: typeof external === "number" ? new Date(external).toISOString() : new Date().toISOString(),
      } satisfies Ship;
    })
    .filter((ship): ship is Ship => ship !== null)
    .slice(0, MAX_SHIPS);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const blocked = guardPublic(req, corsHeaders, 180); // 3 min cache
  if (blocked) return blocked;

  const url = new URL(req.url);
  const minLat = Number(url.searchParams.get("minLat") ?? 30);
  const maxLat = Number(url.searchParams.get("maxLat") ?? 55);
  const minLon = Number(url.searchParams.get("minLon") ?? -20);
  const maxLon = Number(url.searchParams.get("maxLon") ?? 40);

  const failed: string[] = [];
  let ships: Ship[] = [];
  let source: string | null = null;
  let coverage: string | null = null;

  const vesselFinderKey = Deno.env.get("VESSELFINDER_API_KEY");
  if (vesselFinderKey) {
    try {
      ships = await fetchVesselFinder(vesselFinderKey, `${minLat},${maxLat},${minLon},${maxLon}`);
      if (ships.length) {
        source = "vesselfinder";
        coverage = `bbox ${minLat},${maxLat},${minLon},${maxLon}`;
      } else {
        failed.push("vesselfinder: sin buques en el área");
      }
    } catch (err) {
      console.warn("VesselFinder unavailable:", err);
      failed.push(`vesselfinder: ${err instanceof Error ? err.message : "error"}`);
    }
  } else {
    failed.push("vesselfinder: VESSELFINDER_API_KEY sin configurar");
  }

  if (!ships.length) {
    try {
      ships = await fetchDigitraffic();
      if (ships.length) {
        source = "digitraffic";
        coverage = "Red AIS de Finlandia (Báltico) · Digitraffic, CC BY 4.0";
      } else {
        failed.push("digitraffic: sin posiciones");
      }
    } catch (err) {
      console.warn("Digitraffic unavailable:", err);
      failed.push(`digitraffic: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  const body = {
    count: ships.length,
    ships,
    source,
    coverage,
    // Nobody answered: the layer reports it instead of drawing fake hulls.
    unavailable: ships.length === 0,
    reason: ships.length ? null : `Ninguna fuente AIS respondió — ${failed.join(" · ")}`,
    bbox: { minLat, maxLat, minLon, maxLon },
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ships.length ? 180 : 60}`,
    },
  });
});
