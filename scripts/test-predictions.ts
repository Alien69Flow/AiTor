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
import {
  compactGammaPayload,
  fetchVenue,
  isVenueId,
  trimToByteBudget,
  venueUrl,
} from "../api/_venues";

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

console.log("4b) Limitless: un mercado que no es Up/Down conserva su categoría");
{
  const payload = {
    data: [
      {
        id: 900,
        title: "Dplus KIA vs Movistar KOI",
        slug: "dplus-kia-vs-movistar-koi",
        prices: [0.5, 0.5],
        volumeFormatted: 1260.152,
        categories: ["Esports"],
      },
    ],
  };
  const [event] = limitlessMarketsToPredictionEvents(payload);
  check(event?.category === "Esports", "categoría real del venue", event?.category);
  check(event?.outcomes[0]?.label === "Sí" && event?.outcomes[1]?.label === "No", "etiquetas Sí/No", event?.outcomes.map((o) => o.label));
}

/* ------------------------------------------------------- selector de venues */

console.log("5) venueUrl: whitelist y límites");
{
  check(isVenueId("kalshi") && isVenueId("limitless") && isVenueId("polymarket"), "ids válidos");
  check(!isVenueId("evil") && !isVenueId("") && !isVenueId(null), "ids rechazados");
  const polymarket = new URL(venueUrl({ venue: "polymarket", limit: 40 }));
  check(polymarket.hostname === "gamma-api.polymarket.com", "host Polymarket", polymarket.hostname);
  check(polymarket.pathname === "/events", "feed de eventos de Gamma", polymarket.pathname);
  check(polymarket.searchParams.get("closed") === "false", "solo mercados abiertos");
  check(polymarket.searchParams.get("limit") === "40", "limit pasado a Polymarket");
  const cappedPoly = new URL(venueUrl({ venue: "polymarket", limit: 90 }));
  check(
    cappedPoly.searchParams.get("limit") === "50",
    "Polymarket acotado a 50 (90 eventos tardaban 22 s en el lector)",
    cappedPoly.searchParams.get("limit"),
  );
  const kalshi = new URL(venueUrl({ venue: "kalshi", limit: 40 }));
  check(kalshi.hostname === "api.elections.kalshi.com", "host Kalshi", kalshi.hostname);
  check(kalshi.searchParams.get("with_nested_markets") === "true", "mercados anidados");
  check(kalshi.searchParams.get("limit") === "40", "limit pasado");
  const clamped = new URL(venueUrl({ venue: "kalshi", limit: 9999 }));
  check(clamped.searchParams.get("limit") === "100", "limit acotado a 100", clamped.searchParams.get("limit"));
  const limitless = new URL(venueUrl({ venue: "limitless", limit: 80 }));
  check(limitless.searchParams.get("limit") === "25", "Limitless acotado a 25 (límite del venue)", limitless.searchParams.get("limit"));
}

console.log("6) fetchVenue: directo, lector de respaldo y errores");
{
  const okFetch = (async () =>
    new Response(JSON.stringify({ events: [] }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const ok = await fetchVenue({ venue: "kalshi", limit: 10 }, { fetchImpl: okFetch });
  check(ok.ok && ok.status === 200, "respuesta 200 pasa el status");
  check(ok.egress === "direct", "egress directo cuando el venue contesta", ok.egress);

  // Un 403 es el bloqueo por país: se reintenta por el lector fuera de la UE.
  const seen: string[] = [];
  const blockedThenReader = (async (url: string | URL | Request) => {
    const href = String(url);
    seen.push(href);
    if (href.startsWith("https://r.jina.ai/")) {
      return new Response('Title: \n\nMarkdown Content:\n{"events":[{"event_ticker":"X"}]}', { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }) as unknown as typeof fetch;
  const fallback = await fetchVenue({ venue: "polymarket", limit: 5 }, { fetchImpl: blockedThenReader });
  check(fallback.ok && fallback.egress === "reader", "403 en directo → lector", fallback);
  check(seen[1]?.startsWith("https://r.jina.ai/https://gamma-api.polymarket.com/"), "el lector recibe la URL del venue", seen[1]);

  // El lector descarga el evento completo: con 50 filas tardaba ~20 s, justo el
  // timeout del cliente. El respaldo pide menos y el directo mantiene el máximo.
  const seenLimits: string[] = [];
  const limitSniffer = (async (url: string | URL | Request) => {
    const href = String(url);
    if (href.startsWith("https://r.jina.ai/")) {
      seenLimits.push(new URL(href.slice("https://r.jina.ai/".length)).searchParams.get("limit") ?? "");
      return new Response("[]", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }) as unknown as typeof fetch;
  await fetchVenue({ venue: "polymarket", limit: 50 }, { fetchImpl: limitSniffer });
  check(seenLimits[0] === "30", "el respaldo del lector pide 30 eventos, no 50", seenLimits[0]);

  const directLimit = (async () =>
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  let directUrl = "";
  await fetchVenue(
    { venue: "polymarket", limit: 50 },
    {
      fetchImpl: (async (url: string | URL | Request) => {
        directUrl = String(url);
        return directLimit(url as string);
      }) as unknown as typeof fetch,
    },
  );
  check(new URL(directUrl).searchParams.get("limit") === "50", "el camino directo mantiene las 50 filas", directUrl);
  check(
    Array.isArray((fallback.body as { events?: unknown[] })?.events),
    "el preámbulo del lector se recorta y el JSON se parsea",
    fallback.body,
  );

  const denied = (async () => new Response("forbidden", { status: 403 })) as unknown as typeof fetch;
  const deniedResult = await fetchVenue({ venue: "kalshi", limit: 10 }, { fetchImpl: denied });
  check(!deniedResult.ok && deniedResult.status === 403, "sin lector válido se devuelve el fallo", deniedResult.status);
  check(/directo: HTTP 403/.test(deniedResult.reason ?? ""), "el motivo incluye el fallo directo", deniedResult.reason);

  const boom = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  let threw = false;
  const networkFail = await fetchVenue(
    { venue: "limitless", limit: 10 },
    { fetchImpl: boom, timeoutMs: 500, readerTimeoutMs: 500 },
  ).catch(() => {
    threw = true;
    return null;
  });
  check(!threw && networkFail?.ok === false, "un error de red no lanza: se traduce a 502", networkFail);

  const capturing = (async (url: string | URL | Request) => {
    seen.push(String(url));
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  const limitless = await fetchVenue({ venue: "limitless", limit: 5 }, { fetchImpl: capturing });
  check(limitless.ok, "Limitless responde");
  check(
    seen.at(-1)?.includes("api.limitless.exchange/markets/active"),
    "URL correcta",
    seen.at(-1),
  );
}

console.log("7) venueUrl: variantes de Polymarket");
{
  const legs = new URL(venueUrl({ venue: "polymarket", limit: 5, slug: "ballon-dor-winner-2026" }));
  check(legs.pathname === "/events" && legs.searchParams.get("slug") === "ballon-dor-winner-2026", "evento por slug", legs.href);

  const history = new URL(venueUrl({ venue: "polymarket", limit: 5, token: "1234567890", interval: "1w" }));
  check(history.hostname === "clob.polymarket.com", "histórico va al CLOB", history.hostname);
  check(history.searchParams.get("interval") === "1w", "intervalo del histórico", history.href);

  const unsafe = new URL(venueUrl({ venue: "polymarket", limit: 5, slug: "../etc/passwd" }));
  check(unsafe.pathname === "/events" && !unsafe.searchParams.get("slug"), "slug inválido se ignora", unsafe.href);

  const unsafeToken = new URL(venueUrl({ venue: "polymarket", limit: 5, token: "12/../34" }));
  check(unsafeToken.hostname === "gamma-api.polymarket.com", "token inválido no sale del CLOB", unsafeToken.hostname);
}

console.log("8) compactGammaPayload: el payload de Gamma cabe en la respuesta de Vercel");
{
  const heavy = "x".repeat(5_000);
  const gammaEvent = {
    id: "48361",
    slug: "ballon-dor-winner-2026",
    title: "Ballon d'Or Winner 2026",
    image: "https://polymarket-upload.s3.us-east-2.amazonaws.com/a.jpg",
    icon: "https://polymarket-upload.s3.us-east-2.amazonaws.com/i.jpg",
    endDate: "2026-12-31T00:00:00Z",
    volume: 1234.5,
    volume24hr: 99.5,
    liquidity: 500,
    openInterest: 42,
    commentCount: 7,
    negRisk: false,
    tags: [{ id: "1", label: "Sports", slug: "sports" }],
    description: heavy,
    series: [{ id: "9", title: heavy }],
    teams: [{ id: "1", name: heavy }],
    markets: [
      {
        id: "m1",
        slug: "will-lebron-win",
        question: "Will LeBron win?",
        groupItemTitle: "LeBron James",
        outcomes: '["Yes", "No"]',
        outcomePrices: '["0.12", "0.88"]',
        clobTokenIds: '["111", "222"]',
        volume: 900,
        volume24hr: 50,
        liquidity: 300,
        liquidityNum: 300,
        openInterest: 20,
        bestBid: 0.11,
        bestAsk: 0.13,
        spread: 0.02,
        lastTradePrice: 0.12,
        oneDayPriceChange: 0.03,
        endDate: "2026-12-31T00:00:00Z",
        active: true,
        closed: false,
        description: heavy,
        events: [{ id: "48361", title: heavy }],
      },
    ],
  };

  const compacted = compactGammaPayload([gammaEvent]) as Record<string, unknown>[];
  const before = JSON.stringify([gammaEvent]).length;
  const after = JSON.stringify(compacted).length;
  check(after < before / 10, "el recorte baja el peso más de 10×", { before, after });
  check(compacted.length === 1, "se conserva el evento", compacted.length);
  check(compacted[0].slug === "ballon-dor-winner-2026" && compacted[0].volume24hr === 99.5, "campos del evento intactos");
  check(compacted[0].description === undefined && compacted[0].teams === undefined, "description y teams fuera");
  const market = (compacted[0].markets as Record<string, unknown>[])[0];
  check(market.slug === "will-lebron-win" && market.groupItemTitle === "LeBron James", "opción apostada conservada");
  check(market.outcomePrices === '["0.12", "0.88"]', "precios reales por opción", market.outcomePrices);
  check(market.clobTokenIds === '["111", "222"]', "clobTokenIds para el histórico", market.clobTokenIds);
  check(market.liquidityNum === 300 && market.volume === 900, "liquidez y volumen por opción", {
    liquidity: market.liquidityNum,
    volume: market.volume,
  });
  check(market.description === undefined && market.events === undefined, "description/events del mercado fuera");

  const keyset = compactGammaPayload({ markets: [gammaEvent.markets[0]], extra: 1 }) as Record<string, unknown>;
  check(Array.isArray(keyset.markets) && keyset.extra === 1, "forma { markets } recortada y resto intacto");

  const untouched = { events: [{ event_ticker: "X" }] };
  check(compactGammaPayload(untouched) === untouched, "una forma desconocida se devuelve tal cual");
  check(compactGammaPayload([{ history: [] }]) !== undefined, "un array sin mercados no revienta");

  const big = Array.from({ length: 40 }, (_, i) => ({ id: String(i), blob: "y".repeat(200_000) }));
  const trimmed = trimToByteBudget(big, 500_000) as unknown[];
  check(trimmed.length < big.length && JSON.stringify(trimmed).length <= 500_000, "trimToByteBudget recorta la cola", trimmed.length);
}

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallida(s)`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones de predicciones pasan.");
