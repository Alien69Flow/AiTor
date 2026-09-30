// Marine Traffic API - Ship Tracking
// VesselFinder LiveData provides AIS positions for the account's configured area.
// Provider failures are surfaced so the client can retain its last known-good data.
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const blocked = guardPublic(req, corsHeaders, 180);
  if (blocked) return blocked;

  try {
    const vesselFinderKey = Deno.env.get("VESSELFINDER_API_KEY");
    if (!vesselFinderKey) {
      return unavailable("Marine provider key not configured");
    }

    const response = await fetch(
      `https://api.vesselfinder.com/livedata?userkey=${encodeURIComponent(vesselFinderKey)}&format=json&interval=5&errormode=409`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return unavailable(`Marine provider HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.error) {
      return unavailable(`Marine provider: ${String(payload.error)}`);
    }

    const records = Array.isArray(payload) ? payload : [];
    const ships = records
      .map((record: any) => record?.AIS ?? record)
      .map((v: any) => ({
        mmsi: String(v?.MMSI ?? ""),
        name: String(v?.NAME ?? "Unknown"),
        type: String(v?.TYPE ?? "Unknown"),
        latitude: Number(v?.LATITUDE),
        longitude: Number(v?.LONGITUDE),
        speed: Number(v?.SPEED ?? 0),
        heading: Number(v?.HEADING ?? 0),
        destination: String(v?.DESTINATION ?? ""),
        timestamp: String(v?.TIMESTAMP ?? new Date().toISOString()),
      }))
      .filter(
        (ship: any) =>
          ship.mmsi.length > 0 &&
          Number.isFinite(ship.latitude) &&
          Number.isFinite(ship.longitude),
      )
      .slice(0, 500);

    return new Response(
      JSON.stringify({
        count: ships.length,
        ships,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=180",
        },
      },
    );
  } catch (err) {
    console.error("Marine traffic error:", err);
    return unavailable("Marine provider unavailable");
  }
});

function unavailable(error: string) {
  return new Response(
    JSON.stringify({
      error,
      count: 0,
      ships: [],
      timestamp: new Date().toISOString(),
    }),
    {
      status: 503,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
