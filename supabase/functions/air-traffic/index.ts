// OpenSky Network API - Air Traffic Data
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENSKY_API = "https://opensky-network.org/api";

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
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) {
      return new Response(JSON.stringify(generateMockFlights()), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
      });
    }

    const data = await response.json();
    
    const flights = (data.states || []).slice(0, 80).map((state: any) => ({
      icao24: state[0],
      callsign: state[1]?.trim() || "UNKNOWN",
      origin: state[2] || null,
      destination: state[3] || null,
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
