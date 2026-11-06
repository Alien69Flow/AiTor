// Marine Traffic API - Ship Tracking
// Using VesselFinder API (free tier available) or mock data
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const blocked = guardPublic(req, corsHeaders, 180); // 3 min cache
  if (blocked) return blocked;
  
  try {
    const url = new URL(req.url);
    const minLat = parseFloat(url.searchParams.get("minLat") || "30");
    const maxLat = parseFloat(url.searchParams.get("maxLat") || "55");
    const minLon = parseFloat(url.searchParams.get("minLon") || "-20");
    const maxLon = parseFloat(url.searchParams.get("maxLon") || "40");
    
    // Try VesselFinder API if key is available
    const vesselFinderKey = Deno.env.get("VESSELFINDER_API_KEY");
    
    if (vesselFinderKey) {
      try {
        const response = await fetch(
          `https://api.vesselfinder.com/vessels?userkey=${vesselFinderKey}&bounds=${minLat},${maxLat},${minLon},${maxLon}`,
          { headers: { "Accept": "application/json" } }
        );
        
        if (response.ok) {
          const data = await response.json();
          const ships = (data.vessels || []).slice(0, 100).map((v: any) => ({
            mmsi: v.MMSI,
            name: v.NAME || "Unknown",
            type: v.TYPE || "Cargo",
            latitude: v.LAT,
            longitude: v.LON,
            speed: v.SPEED || 0,
            heading: v.HEADING || 0,
            destination: v.DESTINATION || "Unknown",
            timestamp: new Date().toISOString(),
          }));
          
          return new Response(JSON.stringify({
            count: ships.length,
            ships,
            bbox: { minLat, maxLat, minLon, maxLon },
            timestamp: new Date().toISOString(),
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=180" },
          });
        }
      } catch (e) {
        console.warn("VesselFinder API error:", e);
      }
    }
    
    // Return mock data if no API key or API fails
    return new Response(JSON.stringify(generateMockShips()), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=180" },
    });
    
  } catch (err) {
    console.error("Marine traffic error:", err);
    return new Response(JSON.stringify({
      error: "Failed to fetch marine data",
      count: 0,
      ships: generateMockShips().ships,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateMockShips() {
  const shipTypes = ["Container Ship", "Tanker", "Bulk Carrier", "Cargo", "Passenger", "Fishing", "Sailing"];
  const routes = [
    { from: "Rotterdam", to: "Shanghai" },
    { from: "Singapore", to: "Rotterdam" },
    { from: "Algeciras", to: "New York" },
    { from: "Barcelona", to: "Algiers" },
    { from: "Valencia", to: "Genoa" },
    { from: "Cartagena", to: "Lisbon" },
    { from: "Malaga", to: "Ceuta" },
    { from: "Cadiz", to: "Canary Islands" },
  ];
  
  const ships = [];
  for (let i = 0; i < 40; i++) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    const type = shipTypes[Math.floor(Math.random() * shipTypes.length)];
    ships.push({
      mmsi: `mock${i.toString().padStart(9, '0')}`,
      name: `${type} ${i + 1}`,
      type,
      latitude: 30 + Math.random() * 25,
      longitude: -15 + Math.random() * 35,
      speed: Math.round(Math.random() * 20),
      heading: Math.round(Math.random() * 360),
      destination: route.to,
      timestamp: new Date().toISOString(),
    });
  }
  
  return {
    count: ships.length,
    ships,
    mock: true,
    bbox: { minLat: 30, maxLat: 55, minLon: -20, maxLon: 40 },
    timestamp: new Date().toISOString(),
  };
}
