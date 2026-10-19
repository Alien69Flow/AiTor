/**
 * Prueba de los mapeadores de venues de predicción (src/lib/prediction-mappers.ts)
 * y del selector del proxy (api/_venues.ts), con fixtures y fetch stubbeado.
 *
 * Ejecutar con:  npx tsx scripts/test-predictions.ts   (exit != 0 si falla)
 */

import {
  kalshiEventsToPredictionEvents,
  kalshiMarketUrl,
  limitlessMarketsToPredictionEvents,
  limitlessMarketUrl,
} from "../src/lib/prediction-mappers";
import { fetchVenue, isVenueId, venueUrl } from "../api/_venues";

let failures = 0;
function check(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.error(`  ✘ ${label}`, detail ?? "");
  }
}

/* ------------------------------------------------------------------ Kalshi */

console.log("1) Kalshi: esquema legacy (centavos enteros)");
{
  const payload = {
    events: [
      {
        event_ticker: "KXFED-26NOV04",
        series_ticker: "KXFED",
        title: "Will the Fed cut rates in November?",
        category: "Economy",
        close_time: "2026-11-04T20:00:00Z",
        markets: [
          {
            ticker: "KXFED-26NOV04-Y",
            title: "Fed cuts",
            yes_sub_title: "Cut",
            status: "active",
            last_price: 62,
            yes_bid: 60,
            yes_ask: 64,
            volume_24h: 1500,
            open_interest: 20000,
            liquidity: 84000,
          },
          {
            ticker: "KXFED-26NOV04-N",
            title: "No cut",
            status: "active",
            last_price: 38,
            yes_bid: 36,
            yes_ask: 40,
            volume_24h: 900,
            open_interest: 15000,
            liquidity: 52000,
          },
        ],
      },
    ],
  };
  const events = kalshiEventsToPredictionEvents(payload);
  check(events.length === 1, "un evento mapeado", events.length);
  const e = events[0];
  check(e.source === "kalshi", "source kalshi", e.source);
  check(e.title === "Will the Fed cut rates in November?", "título del evento", e.title);
  check(e.category === "Economy", "categoría del venue", e.category);
  check(e.outcomes.length === 2, "dos piernas", e.outcomes.length);
  check(Math.abs(e.outcomes[0].price - 0.62) < 1e-9, "precio 62¢ → 0.62", e.outcomes[0].price);
  check(e.outcomes[0].bestBid !== null && Math.abs(e.outcomes[0].bestBid - 0.6) < 1e-9, "bid 60¢ → 0.6", e.outcomes[0].bestBid);
  // Volumen estimado: contratos × precio.
  check(Math.abs(e.outcomes[0].volume24h - 1500 * 0.62) < 1e-6, "vol 24h estimado en USD", e.outcomes[0].volume24h);
  check(e.outcomes[0].url === kalshiMarketUrl("KXFED-26NOV04-Y"), "URL pública del mercado", e.outcomes[0].url);
  check(e.endDate === "2026-11-04T20:00:00Z", "close_time del evento", e.endDate);
  check(e.outcomes[0].label === "Cut", "yes_sub_title como etiqueta", e.outcomes[0].label);
  check(e.liquidity === 84000 + 52000, "liquidez agregada", e.liquidity);
}

console.log("2) Kalshi: esquema nuevo (fixed-point en dólares)");
{
  const payload = {
    events: [
      {
        event_ticker: "KXBTC-26OCT20",
        title: "BTC above $85k on Oct 20?",
        category: "Crypto",
        markets: [
          {
            ticker: "KXBTC-26OCT20-T85000",
            yes_sub_title: "Yes",
            status: "active",
            last_price_dollars: "0.4700",
            yes_bid_dollars: "0.4500",
            yes_ask_dollars: "0.4900",
            volume_24h_dollars: "12345.67",
            open_interest_dollars: "99000.10",
            liquidity_dollars: "15000.00",
          },
        ],
      },
    ],
  };
  const events = kalshiEventsToPredictionEvents(payload);
  check(events.length === 1, "un evento mapeado", events.length);
  const o = events[0].outcomes[0];
  check(Math.abs(o.price - 0.47) < 1e-9, "last_price_dollars 0.47", o.price);
  check(Math.abs((o.bestAsk ?? 0) - 0.49) < 1e-9, "yes_ask_dollars 0.49", o.bestAsk);
  check(Math.abs(o.volume24h - 12345.67) < 1e-6, "volumen 24h en dólares", o.volume24h);
  check(Math.abs(o.liquidity - 15000) < 1e-6, "liquidez en dólares", o.liquidity);
  check(o.openInterest !== null && Math.abs(o.openInterest - 99000.1) < 1e-6, "OI en dólares", o.openInterest);
}

console.log("3) Kalshi: defensas (payload vacío, mercados cerrados, sin precio)");
{
  check(kalshiEventsToPredictionEvents(null).length === 0, "payload null → []");
  check(kalshiEventsToPredictionEvents({}).length === 0, "payload sin events → []");
  const filtered = kalshiEventsToPredictionEvents({
    events: [
      {
        event_ticker: "E1",
        markets: [
          { ticker: "E1-A", status: "closed", last_price: 90 },
          { ticker: "E1-B", status: "active" },
        ],
      },
    ],
  });
  check(filtered.length === 0, "mercados cerrados o sin precio se descartan", filtered.length);
  const fallback = kalshiEventsToPredictionEvents({
    events: [
      {
        event_ticker: "E2",
        markets: [{ ticker: "E2-A", status: "active", yes_bid_dollars: "0.30", yes_ask_dollars: "0.40" }],
      },
    ],
  });
  check(
    fallback.length === 1 && Math.abs(fallback[0].outcomes[0].price - 0.35) < 1e-9,
    "sin last_price usa la media bid/ask",
    fallback[0]?.outcomes[0]?.price,
  );
}

/* --------------------------------------------------------------- Limitless */

console.log("4) Limitless: mercado binario Up/Down");
{
  const payload = {
    data: [
      {
        id: 436603,
        title: "ETH Up or Down - 5 Min",
        slug: "eth-up-or-down-5-min-1792420500",
        prices: [0.6435, 0.3565],
        volumeFormatted: 1234.5,
        openInterestFormatted: 800.25,
        liquidityFormatted: 4200.75,
        expirationTimestamp: 1792420800000,
        imageUrl: "https://cdn.limitless.exchange/x.png",
        categories: ["Minutely", "5 min"],
        priceOracleMetadata: { ticker: "ETH", assetType: "CRYPTO" },
      },
      { id: 1, title: "hidden", slug: "hidden-slug", prices: [0.5, 0.5], hidden: true },
      { id: 2, title: "expired", slug: "expired-slug", prices: [0.5, 0.5], expired: true },
      { id: 3, title: "no prices", slug: "no-prices-slug" },
    ],
  };
  const events = limitlessMarketsToPredictionEvents(payload);
  check(events.length === 1, "solo el mercado activo y visible", events.length);
  const e = events[0];
  check(e.source === "limitless", "source limitless", e.source);
  check(e.outcomes.length === 2, "dos outcomes", e.outcomes.length);
  check(e.outcomes[0].label === "Up" && Math.abs(e.outcomes[0].price - 0.6435) < 1e-9, "precio Up", e.outcomes[0].price);
  check(e.outcomes[1].label === "Down" && Math.abs(e.outcomes[1].price - (1 - 0.6435)) < 1e-9, "precio Down = 1 − Up", e.outcomes[1].price);
  check(e.volume24h === 0, "sin inventar volumen 24h (el feed no lo trae)", e.volume24h);
  check(Math.abs(e.volumeTotal - 1234.5) < 1e-6, "volumen acumulado", e.volumeTotal);
  check(e.url === limitlessMarketUrl("eth-up-or-down-5-min-1792420500"), "URL /markets/{slug}", e.url);
  check(e.endDate === new Date(1792420800000).toISOString(), "endDate desde expirationTimestamp", e.endDate);
  check(e.category.includes("ETH"), "ticker del oráculo en la categoría", e.category);
  check(limitlessMarketsToPredictionEvents(null).length === 0, "payload null → []");
}

/* ------------------------------------------------------- selector de venues */

console.log("5) venueUrl: whitelist y límites");
{
  check(isVenueId("kalshi") && isVenueId("limitless"), "ids válidos");
  check(!isVenueId("evil") && !isVenueId("") && !isVenueId(null), "ids rechazados");
  const kalshi = new URL(venueUrl("kalshi", 40));
  check(kalshi.hostname === "api.elections.kalshi.com", "host Kalshi", kalshi.hostname);
  check(kalshi.searchParams.get("with_nested_markets") === "true", "mercados anidados");
  check(kalshi.searchParams.get("limit") === "40", "limit pasado");
  const clamped = new URL(venueUrl("kalshi", 9999));
  check(clamped.searchParams.get("limit") === "100", "limit acotado a 100", clamped.searchParams.get("limit"));
  const limitless = new URL(venueUrl("limitless", 80));
  check(limitless.searchParams.get("limit") === "25", "Limitless acotado a 25 (límite del venue)", limitless.searchParams.get("limit"));
}

console.log("6) fetchVenue: fetch stubbeado, status y errores");
{
  const okFetch = (async () =>
    new Response(JSON.stringify({ events: [] }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const ok = await fetchVenue("kalshi", 10, { fetchImpl: okFetch });
  check(ok.ok && ok.status === 200, "respuesta 200 pasa el status");

  const denied = (async () => new Response("forbidden", { status: 403 })) as unknown as typeof fetch;
  const deniedResult = await fetchVenue("kalshi", 10, { fetchImpl: denied });
  check(!deniedResult.ok && deniedResult.status === 403, "403 del venue se propaga", deniedResult.status);

  const boom = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  let threw = false;
  try {
    await fetchVenue("limitless", 10, { fetchImpl: boom, timeoutMs: 500 });
  } catch (e) {
    threw = e instanceof Error && e.message === "network down";
  }
  check(threw, "error de red propaga para que el caller responda 502");

  const seen: string[] = [];
  const capturing = (async (url: string | URL | Request) => {
    seen.push(String(url));
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  await fetchVenue("limitless", 5, { fetchImpl: capturing });
  check(seen[0]?.includes("api.limitless.exchange/markets/active"), "URL correcta", seen[0]);
}

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallida(s)`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones de predicciones pasan.");
