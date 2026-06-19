// Cesium Ion tile proxy — keeps CESIUM_ION_TOKEN server-side
// Returns asset endpoint + access token for Bing Maps Aerial (asset 2)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function requireUser(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

const ION_TOKEN = Deno.env.get("VITE_CESIUM_TOKEN") || Deno.env.get("CESIUM_ION_TOKEN");

// Bing Maps Aerial = Cesium Ion asset 2 (world imagery)
const DEFAULT_ASSET = "2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authFail = await requireUser(req);
    if (authFail) return authFail;

    if (!ION_TOKEN) {
      return new Response(
        JSON.stringify({ error: "CESIUM_ION_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const rawAsset = url.searchParams.get("asset") || DEFAULT_ASSET;
    if (!/^\d{1,10}$/.test(rawAsset)) {
      return new Response(JSON.stringify({ error: "Invalid asset id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const assetId = rawAsset;

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