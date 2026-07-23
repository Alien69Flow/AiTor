// Cesium Ion tile proxy — keeps CESIUM_ION_TOKEN server-side
// Returns asset endpoint + access token for Bing Maps Aerial (asset 2)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ION_TOKEN = Deno.env.get("VITE_CESIUM_TOKEN") || Deno.env.get("CESIUM_ION_TOKEN");

// Bing Maps Aerial = Cesium Ion asset 2 (world imagery)
const DEFAULT_ASSET = "2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ION_TOKEN) {
      return new Response(
        JSON.stringify({ error: "CESIUM_ION_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const assetId = url.searchParams.get("asset") || DEFAULT_ASSET;

    // Ask Cesium Ion for the tileset endpoint + short-lived access token
    const ionRes = await fetch(`https://api.cesium.com/v1/assets/${assetId}/endpoint`, {
      headers: { Authorization: `Bearer ${ION_TOKEN}` },
    });

    if (!ionRes.ok) {
      const txt = await ionRes.text();
      return new Response(
        JSON.stringify({ error: "Cesium Ion error", detail: txt.slice(0, 200) }),
        { status: ionRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await ionRes.json();
    // data: { url, accessToken, type, attributions, ... }
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy failure", detail: String(err).slice(0, 200) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});