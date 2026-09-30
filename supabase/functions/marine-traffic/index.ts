// Marine Traffic API - Ship Tracking
// VesselFinder LiveData is the live AIS provider. Provider failures are
// surfaced to the connector so the client can retain its last known-good data.
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
    const apiKey = Deno.env.get("VESSELFINDER_API_KEY");
    if (!apiKey) return unavailable("Marine provider key not configured");

    const response = await fetch(
      `https://api.vesselfinder.com/livedata?userkey=${encodeURIComponent(apiKey)}&format=json&interval=10`,
      { headers: { Accept: "application/json" } },
    );

    const raw = await response.text();
    if (!response.ok) return unavailable(`Marine provider HTTP ${response.status}`);

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return unavailable("Marine provider returned invalid JSON");
    }

    if (!Array.isArray(payload)) {
      const providerError =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : "Marine provider returned an unexpected payload";
      return unavailable(providerError);
    }

    const ships = payload
      .map((entry: any) => entry?.AIS)
      .filter(
        (ais: any) =>
          ais &&
          Number.isFinite(Number(ais.LATITUDE)) &&
          Number.isFinite(Number(ais.LONGITUDE)) &&
          Number.isFinite(Number(ais.MMSI)),
      )
      .slice(0, 500)
      .map((ais: any) => ({
        mmsi: String(ais.MMSI),
        name: ais.NAME || "Unknown",
        type: String(ais.TYPE ?? "Unknown"),
        latitude: Number(ais.LATITUDE),
        longitude: Number(ais.LONGITUDE),
        speed: Number(ais.SPEED ?? 0),
        heading: Number(ais.HEADING ?? 0),
        destination: ais.DESTINATION || "Unknown",
        timestamp: ais.TIMESTAMP || new Date().toISOString(),
      }));

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
