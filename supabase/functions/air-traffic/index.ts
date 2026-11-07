// Air traffic — real aircraft only: OpenSky (OAuth when configured) with a
// keyless ADSB.lol fallback.
//
// This function used to answer `generateMockFlights()` whenever OpenSky did not
// answer, and OpenSky throttles anonymous callers (`/states/all` is its most
// expensive endpoint), so in practice the layer painted 50 invented flights in
// the Mediterranean on nearly every call and the globe showed them as live
// telemetry. Now every source tried is real; if none answers, the response says
// so with `unavailable: true` and an empty list instead of fabricating traffic.
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENSKY_API = "https://opensky-network.org/api";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const ADSB_LOL_API = "https://api.adsb.lol/v2";

/** Aircraft as the app consumes it: same shape whichever source answered. */
interface Flight {
  icao24: string;
  callsign: string;
  origin: string | null;
  destination: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Metres above sea level. */
  altitude: number;
  /** Metres per second. */
  velocity: number;
  heading: number;
  /** ICAO type code when the source knows it (e.g. A20N); drives the marker. */
  aircraftType: string | null;
  /** ADS-B emitter category (A1..A7, B*, C*); picks the silhouette. */
  aircraftCategory: string | null;
  timestamp: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function openskyAuthHeader(): Promise<Record<string, string>> {
  const id = Deno.env.get("OPENSKY_CLIENT_ID");
  const secret = Deno.env.get("OPENSKY_CLIENT_SECRET");
  if (!id || !secret) return {};
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return { Authorization: `Bearer ${cachedToken.value}` };
  }
  const response = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OpenSky token HTTP ${response.status}`);
  const token = await response.json();
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(60, Number(token.expires_in) || 1_800) * 1_000,
  };
  return { Authorization: `Bearer ${cachedToken.value}` };
}

/**
 * One row of the OpenSky `/states/all` response: 17 positional fields, typed
 * following https://opensky-network.org/apidoc/rest.html#operation/getStates
 */
type OpenSkyState = [
  icao24: string,
  callsign: string | null,
  originCountry: string,
  timePosition: number | null,
  lastContact: number | null,
  longitude: number | null,
  latitude: number | null,
  baroAltitude: number | null,
  onGround: boolean,
  velocity: number | null,
  trueTrack: number | null,
  verticalRate: number | null,
  sensors: number[] | null,
  geoAltitude: number | null,
  squawk: string | null,
  spi: boolean,
  positionSource: number,
];

interface Box {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

/** OpenSky already answers in metres and metres/second. */
async function fetchOpenSky(box: Box): Promise<Flight[]> {
  const response = await fetch(
    `${OPENSKY_API}/states/all?lamin=${box.lamin}&lamax=${box.lamax}&lomin=${box.lomin}&lomax=${box.lomax}`,
    {
      headers: { Accept: "application/json", ...(await openskyAuthHeader()) },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`OpenSky HTTP ${response.status}`);
  const data = await response.json();
  const now = new Date().toISOString();
  return ((data.states ?? []) as OpenSkyState[])
    .filter((state) => typeof state[5] === "number" && typeof state[6] === "number")
    .slice(0, 120)
    .map((state) => ({
      icao24: state[0],
      callsign: state[1]?.trim() || "UNKNOWN",
      // state[2] is the country the aircraft was registered in; `/states/all`
      // carries no route, so `destination` stays null. It used to map state[3]
      // (time_position, a Unix timestamp) as a destination string.
      origin: state[2] || null,
      destination: null,
      // `/states/all` puts longitude at index 5 and latitude at index 6. They
      // used to be read the other way round, which placed every OpenSky
      // aircraft on a point mirrored to the wrong side of the planet.
      latitude: state[6],
      longitude: state[5],
      altitude: Math.round(state[7] ?? 0),
      velocity: Math.round(state[9] ?? 0),
      heading: Math.round(state[10] ?? 0),
      aircraftType: null,
      aircraftCategory: null,
      timestamp: now,
    }));
}

/** One aircraft of an ADSB.lol `/v2/point` answer (ADSBexchange v2 schema). */
interface AdsbLolAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  /** Feet, or the literal string "ground". */
  alt_baro?: number | "ground";
  /** Ground speed in knots. */
  gs?: number;
  /** True track over ground in degrees. */
  track?: number;
  /** ICAO aircraft type code, e.g. "A20N". */
  t?: string;
  /** ADS-B emitter category, e.g. "A3". */
  category?: string;
}

/**
 * ADSB.lol is a community ADS-B network with no API key and no country block,
 * so it is the fallback that keeps this layer real when OpenSky throttles us.
 * It is queried by centre + radius, so the returned area covers the requested
 * box rather than matching it exactly.
 */
async function fetchAdsbLol(box: Box, maxRadiusNm = 250): Promise<Flight[]> {
  const lat = (box.lamin + box.lamax) / 2;
  const lon = (box.lomin + box.lomax) / 2;
  const dLatNm = (box.lamax - box.lamin) * 60; // 1° of latitude ≈ 60 nm
  const dLonNm = (box.lomax - box.lomin) * 60 * Math.cos((lat * Math.PI) / 180);
  const radiusNm = Math.min(maxRadiusNm, Math.max(25, Math.ceil(Math.hypot(dLatNm, dLonNm) / 2)));

  const response = await fetch(
    `${ADSB_LOL_API}/point/${lat.toFixed(3)}/${lon.toFixed(3)}/${radiusNm}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
  );
  if (!response.ok) throw new Error(`ADSB.lol HTTP ${response.status}`);
  const data = await response.json();
  const now = new Date().toISOString();

  return ((data.ac ?? []) as AdsbLolAircraft[])
    .filter((ac) => typeof ac.lat === "number" && typeof ac.lon === "number")
    .slice(0, 120)
    .map((ac) => {
      const feet = typeof ac.alt_baro === "number" ? ac.alt_baro : 0;
      return {
        icao24: (ac.hex || "unknown").toLowerCase(),
        callsign: ac.flight?.trim() || (ac.hex || "UNKNOWN").toUpperCase(),
        origin: null,
        destination: null,
        latitude: ac.lat ?? null,
        longitude: ac.lon ?? null,
        // ft → m and kt → m/s, so both sources reach Cesium in the same units.
        altitude: Math.round(feet * 0.3048),
        velocity: Math.round((ac.gs ?? 0) * 0.514444),
        heading: Math.round(ac.track ?? 0),
        aircraftType: ac.t ?? null,
        aircraftCategory: ac.category ?? null,
        timestamp: now,
      };
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const blocked = guardPublic(req, corsHeaders, 120);
  if (blocked) return blocked;

  const url = new URL(req.url);
  const box: Box = {
    lamin: Number(url.searchParams.get("lamin") ?? 35),
    lamax: Number(url.searchParams.get("lamax") ?? 55),
    lomin: Number(url.searchParams.get("lomin") ?? -10),
    lomax: Number(url.searchParams.get("lomax") ?? 30),
  };

  const failed: string[] = [];
  let flights: Flight[] = [];
  let source: string | null = null;

  for (const [name, probe] of [
    ["opensky", fetchOpenSky],
    ["adsb.lol", fetchAdsbLol],
  ] as const) {
    try {
      const result = await probe(box);
      if (result.length) {
        flights = result;
        source = name;
        break;
      }
      failed.push(`${name}: sin aeronaves`);
    } catch (err) {
      console.warn(`${name} unavailable:`, err);
      failed.push(`${name}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  const body = {
    count: flights.length,
    flights,
    source,
    // No source answered: the UI shows a "sin cobertura" chip. It must never be
    // fed invented aircraft, so an empty list is the honest answer here.
    unavailable: flights.length === 0,
    reason: flights.length ? null : `Ninguna fuente aérea respondió — ${failed.join(" · ")}`,
    bbox: box,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${flights.length ? 120 : 60}`,
    },
  });
});
