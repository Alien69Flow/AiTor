// OpenSky Network API - Air Traffic Data
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENSKY_API = "https://opensky-network.org/api";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

/**
 * OpenSky throttles anonymous callers (the `/states/all` box query is the most
 * expensive endpoint), so in practice an unauthenticated request often answers
 * 429 and this function fell back to invented flights on every single call.
 * With OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET set, the OAuth2 client
 * credentials grant raises the quota to a usable level.
 */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const blocked = guardPublic(req, corsHeaders, 120);
  if (blocked) return blocked;
  
  try {
    const url = new URL(req.url);
    const lamin = url.searchParams.get("lamin") || "35.0";
    const lamax = url.searchParams.get("lamax") || "55.0";
    const lomin = url.searchParams.get("lomin") || "-10.0";
    const lomax = url.searchParams.get("lomax") || "30.0";
    
    const response = await fetch(
      `${OPENSKY_API}/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`,
      {
        headers: { Accept: "application/json", ...(await openskyAuthHeader()) },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      return new Response(JSON.stringify(generateMockFlights()), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
      });
    }

    const data = await response.json();
    
    const flights = ((data.states ?? []) as OpenSkyState[]).slice(0, 80).map((state) => ({
      icao24: state[0],
      callsign: state[1]?.trim() || "UNKNOWN",
      // state[2] is the country the aircraft was registered in; `/states/all`
      // carries no route, so `destination` stays null. It used to map state[3]
      // (time_position, a Unix timestamp) as a destination string.
      origin: state[2] || null,
      destination: null,
      latitude: state[5],
      longitude: state[6],
      altitude: Math.round(state[7] || 0),
      velocity: Math.round(state[9] || 0),
      heading: Math.round(state[10] || 0),
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      count: flights.length,
      flights,
      bbox: { lamin, lamax, lomin, lomax },
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
    });
  } catch (err) {
    console.error("Air traffic upstream unavailable, serving mock:", err);
    const mock = generateMockFlights();
    return new Response(JSON.stringify({
      ...mock,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  }
});

function generateMockFlights() {
  const airlines = ["AFR", "BAW", "DLH", "UAE", "THY", "RYR", "EZY", "VLG", "SAS", "WZZ", "IBE", "AEA"];
  const routes = [
    { from: "LHR", to: "JFK" }, { from: "CDG", to: "DXB" }, { from: "FRA", to: "SIN" },
    { from: "MAD", to: "BOG" }, { from: "BCN", to: "MIA" }, { from: "ZAZ", to: "BCN" },
    { from: "AGP", to: "LHR" }, { from: "LIS", to: "GRU" }, { from: "FCO", to: "EZE" },
  ];
  
  const flights = [];
  for (let i = 0; i < 50; i++) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    flights.push({
      icao24: `mock${i.toString(16).padStart(4, '0')}`,
      callsign: `${airline}${Math.floor(Math.random() * 9000 + 1000)}`,
      origin: route.from,
      destination: route.to,
      latitude: 35 + Math.random() * 20,
      longitude: -10 + Math.random() * 40,
      altitude: Math.round(9000 + Math.random() * 4000),
      velocity: Math.round(200 + Math.random() * 200),
      heading: Math.round(Math.random() * 360),
      timestamp: new Date().toISOString(),
    });
  }
  
  return { count: flights.length, flights, mock: true };
}
