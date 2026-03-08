import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchPolymarketEvents() {
  try {
    const res = await fetch("https://gamma-api.polymarket.com/events?closed=false&limit=20&active=true&order=volume24hr&ascending=false");
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    const events = await res.json();
    return events.map((event: any) => {
      const market = event.markets?.[0];
      return {
        id: event.id || crypto.randomUUID(),
        title: event.title || "Unknown Event",
        description: event.description?.substring(0, 200) || "",
        category: event.tag || "General",
        yesPrice: market?.outcomePrices ? JSON.parse(market.outcomePrices)[0] : null,
        noPrice: market?.outcomePrices ? JSON.parse(market.outcomePrices)[1] : null,
        volume: market?.volume24hr || 0,
        totalVolume: market?.volume || 0,
        endDate: event.endDate || null,
        image: event.image || null,
        slug: event.slug || null,
        source: "polymarket",
      };
    });
  } catch (e) {
    console.error("Polymarket fetch error:", e);
    return [];
  }
}

async function fetchCoinGeckoTrending() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json();
    return (data.coins || []).map((c: any) => ({
      id: c.item?.id || crypto.randomUUID(),
      title: `${c.item?.name} (${c.item?.symbol?.toUpperCase()})`,
      description: `Rank #${c.item?.market_cap_rank || "?"} — trending on CoinGecko`,
      category: "Crypto",
      price: c.item?.data?.price,
      priceChange24h: c.item?.data?.price_change_percentage_24h?.usd,
      sparkline: c.item?.data?.sparkline,
      image: c.item?.thumb || c.item?.small,
      marketCap: c.item?.data?.market_cap,
      volume: c.item?.data?.total_volume,
      source: "coingecko",
    }));
  } catch (e) {
    console.error("CoinGecko fetch error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "all";

    let result: any = {};

    if (action === "polymarket" || action === "all") {
      result.polymarket = await fetchPolymarketEvents();
    }
    if (action === "trending" || action === "all") {
      result.trending = await fetchCoinGeckoTrending();
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("crypto-signals error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
