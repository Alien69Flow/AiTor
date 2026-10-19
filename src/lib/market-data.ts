/**
 * Live market data layer for the Markets / Predictions terminal.
 *
 * Every source below was probed from a real browser origin and answers with
 * `Access-Control-Allow-Origin: *`, so quotes, volume and liquidity are fetched
 * straight from the venue instead of a proxy or a deployed edge function:
 *
 *   - Polymarket  gamma-api (market list + full event legs) and CLOB (price history)
 *   - Manifold    api.manifold.markets
 *   - Kalshi      same-origin proxy /api/predictions (venue blocks Origin with 403)
 *   - Limitless   same-origin proxy /api/predictions (venue sends no ACAO header)
 *   - DexScreener every DEX/AMM pool for any token or pair
 *   - DefiLlama   DEX, liquidity-aggregator and options venue volumes
 *   - Hyperliquid perp universe: mark price, funding, open interest, notional
 *   - CoinGecko   exchange spot volumes + global crypto stats
 *   - ECB         reference FX rates (via Frankfurter)
 *   - US Treasury official daily yield curve CSV
 *   - gold-api    metals spot
 *
 * Venues sin API usable ni proxy (PredictIt, sx.bet sin ACAO; Metaculus pide
 * token desde 2026; Overtime pide x-api-key) se listan en
 * PREDICTION_UNAVAILABLE_SOURCES en lugar de presentarse como vivos.
 */
import { safeFetchJson, safeFetchText } from "@/lib/connectors";
import {
  kalshiEventsToPredictionEvents,
  limitlessMarketsToPredictionEvents,
} from "@/lib/prediction-mappers";
import type { PredictionEvent, PredictionOutcome, PredictionSourceId } from "@/lib/prediction-mappers";

export type { PredictionEvent, PredictionOutcome, PredictionSourceId };
export { kalshiMarketUrl, limitlessMarketUrl } from "@/lib/prediction-mappers";

/* ------------------------------------------------------------------ format */

export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function optionalNum(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Gamma stringifies list fields, e.g. `outcomes: "[\"Yes\",\"No\"]"`. */
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function formatUsd(value: number | null | undefined, digits = 1): string {
  const v = num(value);
  const abs = Math.abs(v);
  const grouped = (scaled: number, d: number) =>
    Number(scaled.toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d });
  if (abs >= 1e12) return `$${grouped(v / 1e12, 2)}T`;
  if (abs >= 1e9) return `$${grouped(v / 1e9, 2)}B`;
  if (abs >= 1e6) return `$${grouped(v / 1e6, digits)}M`;
  if (abs >= 1e3) return `$${grouped(v / 1e3, digits)}K`;
  if (abs >= 1) return `$${grouped(v, 0)}`;
  return `$${v.toFixed(2)}`;
}

export function formatCompact(value: number | null | undefined): string {
  const v = num(value);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

/** Signed percentage points, e.g. `+4.20 pp`. */
export function formatPoints(value: number | null | undefined, digits = 2): string {
  const v = optionalNum(value);
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  const v = optionalNum(value);
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function formatPrice(value: number | null | undefined, digits = 2): string {
  const v = optionalNum(value);
  if (v === null) return "—";
  const abs = Math.abs(v);
  const d = abs >= 1000 ? 0 : abs >= 1 ? digits : 4;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

/** Implied probability from a 0..1 contract price. */
export function formatCents(price: number | null | undefined): string {
  const v = optionalNum(price);
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}¢`;
}

export function formatCountdown(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  const ms = target - Date.now();
  if (ms <= 0) return "cerrado";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `cierra en ${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `cierra en ${hours}h`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `cierra en ${mins}m`;
}

/* -------------------------------------------------------- prediction markets */

export interface PredictionSource {
  id: PredictionSourceId;
  label: string;
  kind: string;
  url: string;
}

export const PREDICTION_SOURCES: PredictionSource[] = [
  { id: "polymarket", label: "Polymarket", kind: "Order book · CLOB", url: "https://polymarket.com" },
  { id: "kalshi", label: "Kalshi", kind: "Order book · CFTC", url: "https://kalshi.com" },
  { id: "manifold", label: "Manifold", kind: "Play money · AMM", url: "https://manifold.markets" },
  { id: "limitless", label: "Limitless", kind: "CLOB · crypto 5m", url: "https://limitless.exchange" },
];

/** Fuentes citadas pero sin camino usable hoy (ni directo ni por proxy). */
export const PREDICTION_UNAVAILABLE_SOURCES = [
  { label: "PredictIt", reason: "sin cabecera Access-Control-Allow-Origin" },
  { label: "sx.bet", reason: "sin cabecera Access-Control-Allow-Origin" },
  { label: "Metaculus", reason: "la API exige token de cuenta desde 2026" },
  { label: "Overtime", reason: "los endpoints de mercados exigen x-api-key" },
];

const POLY_GAMMA = "https://gamma-api.polymarket.com";
const POLY_CLOB = "https://clob.polymarket.com";
const POLY_REF = "aitor";

/** Affiliate-tagged URL, matching the existing outbound-link convention. */
export function polymarketEventUrl(slug: string): string {
  return `https://polymarket.com/event/${slug}?ref=${POLY_REF}`;
}

interface GammaMarket {
  id?: string;
  slug?: string;
  question?: string;
  groupItemTitle?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
  volume?: unknown;
  volume24hr?: unknown;
  volumeNum?: unknown;
  liquidity?: unknown;
  liquidityNum?: unknown;
  openInterest?: unknown;
  bestBid?: unknown;
  bestAsk?: unknown;
  spread?: unknown;
  lastTradePrice?: unknown;
  oneDayPriceChange?: unknown;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  events?: GammaEvent[];
}

interface GammaEvent {
  id?: string;
  slug?: string;
  title?: string;
  image?: string;
  icon?: string;
  endDate?: string;
  volume?: unknown;
  volume24hr?: unknown;
  liquidity?: unknown;
  openInterest?: unknown;
  commentCount?: unknown;
  negRisk?: boolean;
  tags?: { label?: string; slug?: string }[];
  markets?: GammaMarket[];
}

function gammaLegs(market: GammaMarket, eventSlug: string | null): PredictionOutcome[] {
  const names = parseList(market.outcomes);
  const prices = parseList(market.outcomePrices).map((p) => num(p));
  const tokens = parseList(market.clobTokenIds);
  const base = {
    volume24h: num(market.volume24hr ?? market.volumeNum),
    volumeTotal: num(market.volume ?? market.volumeNum),
    liquidity: num(market.liquidityNum ?? market.liquidity),
    openInterest: optionalNum(market.openInterest),
    bestBid: optionalNum(market.bestBid),
    bestAsk: optionalNum(market.bestAsk),
    spread: optionalNum(market.spread),
    lastTrade: optionalNum(market.lastTradePrice),
    changePts: optionalNum(market.oneDayPriceChange) === null ? null : num(market.oneDayPriceChange) * 100,
    url: market.slug ? `https://polymarket.com/market/${market.slug}?ref=${POLY_REF}` : eventSlug ? polymarketEventUrl(eventSlug) : null,
  };

  // Multi-outcome events (one market per outcome) carry the outcome name in
  // `groupItemTitle` and price that outcome's YES side.
  if (market.groupItemTitle && prices.length >= 1) {
    return [
      {
        id: market.id ?? `${eventSlug}-${market.slug}`,
        label: market.groupItemTitle,
        price: prices[0],
        tokenId: tokens[0] ?? null,
        ...base,
      },
    ];
  }

  if (names.length && prices.length) {
    return names.map((name, i) => ({
      id: `${market.id ?? market.slug}-${i}`,
      label: name,
      price: num(prices[i]),
      tokenId: tokens[i] ?? null,
      ...base,
    }));
  }

  return [
    {
      id: market.id ?? market.slug ?? "leg",
      label: market.question ?? "Outcome",
      price: num(market.lastTradePrice),
      tokenId: tokens[0] ?? null,
      ...base,
    },
  ];
}

/**
 * Gamma does not return topic tags on the market list, so the category shown on
 * each card is inferred from the question. It is deterministic and labelled in
 * the UI as inferred, never presented as venue metadata.
 */
export const CATEGORY_RULES: { label: string; pattern: RegExp }[] = [
  { label: "Crypto", pattern: /\b(bitcoin|btc|ethereum|eth|solana|xrp|doge|crypto|token|stablecoin|defi|nft|airdrop|binance|coinbase)\b/i },
  { label: "Sports", pattern: /\b(nba|nfl|mlb|nhl|fifa|uefa|world cup|super bowl|olympic|champions league|premier league|la liga|tennis|grand prix|playoff|match|league|cup)\b/i },
  { label: "Politics", pattern: /\b(election|president|senate|congress|parliament|minister|prime minister|trump|biden|vote|impeach|mayor|governor|coalition|referendum)\b/i },
  { label: "Economy", pattern: /\b(fed|interest rate|inflation|cpi|gdp|recession|rate cut|treasury|unemployment|tariff|stocks?|s&p|nasdaq)\b/i },
  { label: "Tech", pattern: /\b(openai|apple|google|microsoft|tesla|spacex|nvidia|iphone|android|ai model|gpt|chatgpt|launch|satellite)\b/i },
  { label: "World", pattern: /\b(war|ceasefire|russia|ukraine|china|taiwan|israel|iran|gaza|nato|conflict|invasion|strike)\b/i },
  { label: "Science", pattern: /\b(climate|nasa|space|mars|moon|asteroid|earthquake|volcano|hurricane|temperature|solar)\b/i },
  { label: "Culture", pattern: /\b(oscar|grammy|movie|film|album|music|celebrity|box office|series|netflix|eurovision)\b/i },
];

export function inferCategory(title: string, tags: string[] = []): string {
  if (tags.length) return tags[0];
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return rule.label;
  }
  return "Other";
}

function gammaEventsToPredictionEvents(rows: GammaMarket[]): PredictionEvent[] {
  const byEvent = new Map<string, PredictionEvent>();
  const multiOutcome = new Map<string, boolean>();

  for (const row of rows) {
    if (row.closed || row.active === false) continue;
    const event = row.events?.[0];
    const slug = event?.slug ?? row.slug ?? "";
    const key = event?.id ?? slug;
    if (!key) continue;

    const legs = gammaLegs(row, slug).filter((leg) => leg.label);
    if (!legs.length) continue;

    let entry = byEvent.get(key);
    if (!entry) {
      entry = {
        id: key,
        source: "polymarket",
        title: event?.title ?? row.question ?? slug,
        slug,
        url: slug ? polymarketEventUrl(slug) : POLY_GAMMA,
        image: event?.image ?? event?.icon ?? null,
        tags: (event?.tags ?? []).map((t) => t.label ?? t.slug ?? "").filter(Boolean),
        category: "Other",
        endDate: event?.endDate ?? row.endDate ?? null,
        volume24h: 0,
        volumeTotal: num(event?.volume),
        liquidity: num(event?.liquidity),
        openInterest: optionalNum(event?.openInterest),
        bettors: null,
        comments: optionalNum(event?.commentCount),
        truncated: false,
        outcomes: [],
      };
      byEvent.set(key, entry);
    }

    if (row.groupItemTitle) multiOutcome.set(key, true);
    entry.outcomes.push(...legs);
    // Event level numbers when present, otherwise accumulate from the legs we have.
    entry.volume24h = num(event?.volume24hr) || entry.volume24h + legs.reduce((s, l) => s + l.volume24h, 0);
    if (!entry.volumeTotal) entry.volumeTotal = legs.reduce((s, l) => s + l.volumeTotal, 0);
    if (!entry.liquidity) entry.liquidity = legs.reduce((s, l) => s + l.liquidity, 0);
  }

  const events = [...byEvent.values()];
  for (const event of events) {
    event.category = inferCategory(event.title, event.tags);
    event.outcomes.sort((a, b) => b.volume24h - a.volume24h || b.volumeTotal - a.volumeTotal);
    // Multi-outcome events list one market per outcome upstream; the card shows
    // the busiest legs and offers to pull the complete list on demand.
    event.truncated = multiOutcome.get(event.id) === true;
    if (event.outcomes.length > 12) event.outcomes = event.outcomes.slice(0, 12);
  }

  return events.filter((e) => e.outcomes.length > 0).sort((a, b) => b.volume24h - a.volume24h);
}

/**
 * Highest-volume live markets, grouped back into their events so each card can
 * show every outcome with its own price, volume and liquidity.
 *
 * `/markets` is deprecated upstream (the response carries a `sunset` header),
 * so the keyset feed is tried first, then a light `/events` page, then the old
 * endpoint. A browser that cannot reach Gamma at all gets a human error instead
 * of a bare "Failed to fetch".
 */
export async function fetchPolymarketMarkets(limit = 60, signal?: AbortSignal): Promise<PredictionEvent[]> {
  const query = `limit=${limit}&closed=false&active=true&order=volume24hr&ascending=false`;
  const attempts: { url: string; parse: (payload: unknown) => PredictionEvent[] }[] = [
    {
      url: `${POLY_GAMMA}/markets/keyset?${query}`,
      parse: (payload) => {
        const rows = (payload as { markets?: GammaMarket[] } | null)?.markets;
        return Array.isArray(rows) ? gammaEventsToPredictionEvents(rows) : [];
      },
    },
    {
      url: `${POLY_GAMMA}/events?${query}`,
      parse: (payload) => {
        if (!Array.isArray(payload)) return [];
        const rows = (payload as GammaEvent[]).flatMap((event) =>
          (event.markets ?? []).map((market) => ({ ...market, events: [event] })),
        );
        return gammaEventsToPredictionEvents(rows);
      },
    },
    {
      url: `${POLY_GAMMA}/markets?${query}`,
      parse: (payload) => (Array.isArray(payload) ? gammaEventsToPredictionEvents(payload as GammaMarket[]) : []),
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const payload = await safeFetchJson<unknown>(attempt.url, { signal, timeoutMs: 14_000 });
      const events = attempt.parse(payload);
      if (events.length) return events;
      lastError = new Error("la respuesta llegó vacía");
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
    }
  }

  const raw = lastError instanceof Error ? lastError.message : String(lastError ?? "error desconocido");
  throw new Error(
    /fetch|network|load failed/i.test(raw)
      ? "el navegador no pudo conectar con Polymarket (red, CORS o bloqueo de Cloudflare). Reintenta o usa Manifold."
      : raw,
  );
}

/** All live legs of one event (the "see every option" expansion). */
export async function fetchPolymarketEventLegs(slug: string, signal?: AbortSignal): Promise<PredictionOutcome[]> {
  const rows = await safeFetchJson<GammaEvent[]>(`${POLY_GAMMA}/events?slug=${encodeURIComponent(slug)}`, {
    signal,
    timeoutMs: 12_000,
  });
  const event = Array.isArray(rows) ? rows[0] : undefined;
  if (!event?.markets?.length) return [];
  const legs = event.markets
    .filter((m) => !m.closed && m.active !== false)
    .flatMap((m) => gammaLegs(m, event.slug ?? slug))
    .filter((leg) => leg.label);
  return legs.sort((a, b) => b.volume24h - a.volume24h || b.volumeTotal - a.volumeTotal);
}

const historyCache = new Map<string, { at: number; points: number[] }>();

/**
 * Real traded price history for one outcome (CLOB midpoints), used for the
 * sparkline. Cached for 2 minutes because a card can mount many times.
 */
export async function fetchPolymarketHistory(
  tokenId: string,
  interval: "1d" | "1w" | "1m" = "1d",
  signal?: AbortSignal,
): Promise<number[]> {
  const key = `${tokenId}:${interval}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < 120_000) return cached.points;

  const res = await safeFetchJson<{ history?: { t: number; p: number }[] }>(
    `${POLY_CLOB}/prices-history?market=${encodeURIComponent(tokenId)}&interval=${interval}&fidelity=60`,
    { signal, timeoutMs: 10_000 },
  );
  const points = (res.history ?? []).map((p) => num(p.p)).filter((p) => p > 0);
  historyCache.set(key, { at: Date.now(), points });
  return points;
}

interface ManifoldMarket {
  id?: string;
  question?: string;
  slug?: string;
  url?: string;
  probability?: number;
  volume?: number;
  volume24Hours?: number;
  totalLiquidity?: number;
  uniqueBettorCount?: number;
  isResolved?: boolean;
  outcomeType?: string;
  closeTime?: number;
  createdTime?: number;
}

/** Manifold binary markets, ranked by lifetime volume. Play-money venue. */
export async function fetchManifoldMarkets(limit = 60, signal?: AbortSignal): Promise<PredictionEvent[]> {
  const rows = await safeFetchJson<ManifoldMarket[]>(`https://api.manifold.markets/v0/markets?limit=${Math.min(limit, 100)}`, {
    signal,
    timeoutMs: 12_000,
  });
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((m) => !m.isResolved && typeof m.probability === "number" && m.outcomeType === "BINARY")
    .map<PredictionEvent>((m) => {
      const price = num(m.probability);
      const liquidity = num(m.totalLiquidity);
      return {
        id: String(m.id ?? m.slug),
        source: "manifold",
        title: m.question ?? "",
        slug: m.slug ?? "",
        url: m.url ?? `https://manifold.markets/${m.slug ?? ""}`,
        image: null,
        tags: [],
        category: "Play money",
        endDate: m.closeTime ? new Date(m.closeTime).toISOString() : null,
        volume24h: num(m.volume24Hours),
        volumeTotal: num(m.volume),
        liquidity,
        openInterest: null,
        bettors: m.uniqueBettorCount ?? null,
        comments: null,
        truncated: false,
        outcomes: [
          {
            id: `${m.id}-yes`,
            label: "Yes",
            price,
            changePts: null,
            volume24h: 0,
            volumeTotal: num(m.volume),
            liquidity,
            openInterest: null,
            bestBid: null,
            bestAsk: null,
            spread: null,
            lastTrade: null,
            tokenId: null,
            url: m.url ?? null,
          },
          {
            id: `${m.id}-no`,
            label: "No",
            price: 1 - price,
            changePts: null,
            volume24h: 0,
            volumeTotal: 0,
            liquidity,
            openInterest: null,
            bestBid: null,
            bestAsk: null,
            spread: null,
            lastTrade: null,
            tokenId: null,
            url: m.url ?? null,
          },
        ],
      };
    })
    .sort((a, b) => b.volumeTotal - a.volumeTotal);
}

/**
 * Kalshi desde el proxy de mismo origen (`/api/predictions?venue=kalshi`):
 * el venue devuelve 403 a cualquier petición con cabecera `Origin`, así que
 * el navegador nunca lo consulta directo. El mapeo acepta tanto el esquema
 * legacy (centavos enteros) como el fixed-point en dólares de 2026.
 */
export async function fetchKalshiMarkets(limit = 30, signal?: AbortSignal): Promise<PredictionEvent[]> {
  let payload: unknown;
  try {
    payload = await safeFetchJson<unknown>(`/api/predictions?venue=kalshi&limit=${limit}`, {
      signal,
      timeoutMs: 15_000,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(
      /HTTP 400|unknown venue/.test(raw)
        ? "el proxy de Kalshi no está desplegado en este entorno; usa Polymarket o Manifold."
        : `el proxy de Kalshi no respondió (${raw}).`,
    );
  }
  const events = kalshiEventsToPredictionEvents(payload);
  if (!events.length) throw new Error("Kalshi devolvió eventos sin mercados negociables");
  return events;
}

/**
 * Limitless desde el proxy de mismo origen: mercados binarios de corto plazo
 * (5 min… diarios) sobre precio de cripto, con precios Up/Down en `prices`.
 */
export async function fetchLimitlessMarkets(limit = 25, signal?: AbortSignal): Promise<PredictionEvent[]> {
  let payload: unknown;
  try {
    payload = await safeFetchJson<unknown>(`/api/predictions?venue=limitless&limit=${limit}`, {
      signal,
      timeoutMs: 15_000,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(
      /HTTP 400|unknown venue/.test(raw)
        ? "el proxy de Limitless no está desplegado en este entorno; usa Polymarket o Manifold."
        : `el proxy de Limitless no respondió (${raw}).`,
    );
  }
  const events = limitlessMarketsToPredictionEvents(payload);
  if (!events.length) throw new Error("Limitless devolvió mercados sin precios válidos");
  return events;
}

/* --------------------------------------------------------------- DEX / AMM */

export interface DexPool {
  id: string;
  chain: string;
  dex: string;
  /** DEX generation label from DexScreener, e.g. `v3`, `v2`, `CLMM`. */
  kind: string;
  pair: string;
  priceUsd: number | null;
  liquidityUsd: number;
  volume24h: number;
  change24h: number | null;
  url: string;
}

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  url?: string;
  labels?: string[];
  baseToken?: { symbol?: string; name?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
}

/** Any token or pair, priced across every indexed DEX/AMM. */
export async function fetchDexPools(query: string, signal?: AbortSignal): Promise<DexPool[]> {
  const res = await safeFetchJson<{ pairs?: DexScreenerPair[] }>(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
    { signal, timeoutMs: 12_000 },
  );
  const pairs = res.pairs ?? [];
  return pairs
    .map<DexPool>((p) => ({
      id: `${p.chainId}-${p.pairAddress}`,
      chain: p.chainId ?? "?",
      dex: p.dexId ?? "?",
      kind: (p.labels ?? []).join(" ") || "amm",
      pair: `${p.baseToken?.symbol ?? "?"}/${p.quoteToken?.symbol ?? "?"}`,
      priceUsd: optionalNum(p.priceUsd),
      liquidityUsd: num(p.liquidity?.usd),
      volume24h: num(p.volume?.h24),
      change24h: optionalNum(p.priceChange?.h24),
      url: p.url ?? "https://dexscreener.com",
    }))
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
}

export interface VenueVolume {
  name: string;
  category: string;
  volume24h: number;
  change1d: number | null;
  chains: string[];
  url: string;
  logo: string | null;
}

interface LlamaProtocol {
  name?: string;
  displayName?: string;
  category?: string;
  total24h?: number;
  change_1d?: number;
  chains?: string[];
  slug?: string;
  logo?: string;
}

async function fetchLlamaOverview(kind: "dexs" | "aggregators" | "options", signal?: AbortSignal): Promise<VenueVolume[]> {
  const res = await safeFetchJson<{ protocols?: LlamaProtocol[] }>(
    `https://api.llama.fi/overview/${kind}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
    { signal, timeoutMs: 14_000 },
  );
  return (res.protocols ?? [])
    .filter((p) => num(p.total24h) > 0)
    .sort((a, b) => num(b.total24h) - num(a.total24h))
    .map<VenueVolume>((p) => ({
      name: p.displayName ?? p.name ?? "—",
      category: p.category ?? kind,
      volume24h: num(p.total24h),
      change1d: optionalNum(p.change_1d),
      chains: p.chains ?? [],
      url: p.slug ? `https://defillama.com/protocol/${p.slug}` : "https://defillama.com",
      logo: p.logo ?? null,
    }));
}

export const fetchDexVenues = (signal?: AbortSignal) => fetchLlamaOverview("dexs", signal);
export const fetchAggregatorVenues = (signal?: AbortSignal) => fetchLlamaOverview("aggregators", signal);
export const fetchOptionsVenues = (signal?: AbortSignal) => fetchLlamaOverview("options", signal);

/* ------------------------------------------------------------------- crypto */

export interface GlobalCrypto {
  marketCap: number;
  volume24h: number;
  btcDominance: number;
  ethDominance: number;
  change24h: number;
  activeCoins: number;
}

export async function fetchGlobalCrypto(signal?: AbortSignal): Promise<GlobalCrypto> {
  const res = await safeFetchJson<{
    data?: {
      total_market_cap?: Record<string, number>;
      total_volume?: Record<string, number>;
      market_cap_percentage?: Record<string, number>;
      market_cap_change_percentage_24h_usd?: number;
      active_cryptocurrencies?: number;
    };
  }>("https://api.coingecko.com/api/v3/global", { signal, timeoutMs: 10_000 });
  const d = res.data ?? {};
  return {
    marketCap: num(d.total_market_cap?.usd),
    volume24h: num(d.total_volume?.usd),
    btcDominance: num(d.market_cap_percentage?.btc),
    ethDominance: num(d.market_cap_percentage?.eth),
    change24h: num(d.market_cap_change_percentage_24h_usd),
    activeCoins: num(d.active_cryptocurrencies),
  };
}

export interface CexVenue {
  id: string;
  name: string;
  country: string | null;
  year: number | null;
  trustScore: number | null;
  volume24hBtc: number;
  url: string;
  logo: string | null;
}

/** Centralised spot venues, ranked by reported 24h volume. */
export async function fetchCexVenues(signal?: AbortSignal): Promise<CexVenue[]> {
  const rows = await safeFetchJson<
    {
      id?: string;
      name?: string;
      country?: string | null;
      year_established?: number | null;
      trust_score?: number | null;
      trade_volume_24h_btc?: number;
      url?: string;
      image?: string;
    }[]
  >("https://api.coingecko.com/api/v3/exchanges?per_page=25", { signal, timeoutMs: 12_000 });

  return (Array.isArray(rows) ? rows : [])
    .map<CexVenue>((e) => ({
      id: e.id ?? e.name ?? "—",
      name: e.name ?? "—",
      country: e.country ?? null,
      year: e.year_established ?? null,
      trustScore: optionalNum(e.trust_score),
      volume24hBtc: num(e.trade_volume_24h_btc),
      url: e.url ?? "https://www.coingecko.com/en/exchanges",
      logo: e.image ?? null,
    }))
    .filter((e) => e.volume24hBtc > 0)
    .sort((a, b) => b.volume24hBtc - a.volume24hBtc);
}

/* ------------------------------------------------------------------ tradfi */

export interface FxRate {
  /** e.g. `USD/JPY`. */
  pair: string;
  rate: number;
  changePct: number | null;
  series: number[];
}

const FX_MAJORS = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "MXN", "BRL", "INR"];

/** ECB reference rates (daily fix) with the last 10 days for a trend line. */
export async function fetchFxRates(signal?: AbortSignal): Promise<{ date: string; base: string; rates: FxRate[] }> {
  const start = new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=${FX_MAJORS.join(",")}`;
  const res = await safeFetchJson<{ start_date: string; end_date: string; rates: Record<string, Record<string, number>> }>(url, {
    signal,
    timeoutMs: 12_000,
  });

  const dates = Object.keys(res.rates ?? {}).sort();
  const rates: FxRate[] = FX_MAJORS.map((code) => {
    const series = dates.map((d) => num(res.rates?.[d]?.[code])).filter((v) => v > 0);
    const rate = series.at(-1) ?? 0;
    const prev = series.at(-2) ?? null;
    return {
      pair: `USD/${code}`,
      rate,
      changePct: prev ? (rate / prev - 1) * 100 : null,
      series,
    };
  }).filter((r) => r.rate > 0);

  return { date: dates.at(-1) ?? res.end_date ?? "", base: "USD", rates };
}

export interface YieldPoint {
  label: string;
  months: number;
  yieldPct: number;
  changeBp: number | null;
}

const YIELD_LABELS = ["1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr", "5 Yr", "10 Yr", "30 Yr"];

function monthsFromLabel(label: string): number {
  const value = Number(label.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(value)) return 0;
  return /yr/i.test(label) ? value * 12 : value;
}

/** Official US Treasury daily yield curve (par yields, %). */
export async function fetchTreasuryCurve(signal?: AbortSignal): Promise<{ date: string; points: YieldPoint[] }> {
  const year = new Date().getUTCFullYear();
  const csv = await safeFetchText(
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`,
    { signal, timeoutMs: 14_000 },
  );

  // The file is published newest-first; the header names are quoted.
  const rows = csv
    .trim()
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (rows.length < 2) throw new Error("treasury CSV empty");

  const header = rows[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const latest = rows[1].split(",").map((v) => v.trim());
  const previous = rows[2]?.split(",").map((v) => v.trim());

  const points = header
    .map((label, i) => {
      if (i === 0) return null;
      const yieldPct = Number(latest[i]);
      if (!Number.isFinite(yieldPct)) return null;
      const prev = previous ? Number(previous[i]) : NaN;
      return {
        label,
        months: monthsFromLabel(label),
        yieldPct,
        changeBp: Number.isFinite(prev) ? (yieldPct - prev) * 100 : null,
      };
    })
    .filter((p): p is YieldPoint => p !== null);

  const wanted = YIELD_LABELS.map((label) => points.find((p) => p.label === label)).filter(
    (p): p is YieldPoint => Boolean(p),
  );

  return { date: latest[0] ?? "", points: wanted.length ? wanted : points };
}

export interface MetalQuote {
  symbol: string;
  name: string;
  price: number;
  updatedAt: string | null;
}

const METALS = [
  { symbol: "XAU", name: "Gold" },
  { symbol: "XAG", name: "Silver" },
  { symbol: "XPT", name: "Platinum" },
  { symbol: "XPD", name: "Palladium" },
];

/** Spot metals (USD per troy ounce). */
export async function fetchMetals(signal?: AbortSignal): Promise<MetalQuote[]> {
  const quotes = await Promise.all(
    METALS.map(async ({ symbol, name }) => {
      try {
        const res = await safeFetchJson<{ price?: number; updatedAt?: string }>(
          `https://api.gold-api.com/price/${symbol}`,
          { signal, timeoutMs: 9_000 },
        );
        const price = optionalNum(res.price);
        if (price === null) return null;
        return { symbol, name, price, updatedAt: res.updatedAt ?? null };
      } catch {
        return null;
      }
    }),
  );
  return quotes.filter((q): q is MetalQuote => q !== null);
}

/* ------------------------------------------------------- perps / own venues */

export interface HyperliquidPerp {
  asset: string;
  markPrice: number;
  /** Funding de 8h en puntos básicos (positivo = longs pagan). */
  fundingBp: number | null;
  /** Open interest en USD (unidades × precio de marca). */
  openInterestUsd: number | null;
  /** Volumen nominal 24h en USD. */
  notional24h: number;
  maxLeverage: number | null;
}

/**
 * Hyperliquid perps (POST /info, CORS `*` verificado): universo + contextos
 * con precio de marca, funding, open interest y volumen nominal 24h.
 */
export async function fetchHyperliquidPerps(signal?: AbortSignal): Promise<HyperliquidPerp[]> {
  const payload = await safeFetchJson<[
    { universe?: { name?: string; maxLeverage?: number }[] },
    { markPx?: string; funding?: string; openInterest?: string; dayNtlVlm?: string }[],
  ]>("https://api.hyperliquid.xyz/info", {
    signal,
    timeoutMs: 12_000,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    },
  });

  const universe = payload?.[0]?.universe ?? [];
  const contexts = payload?.[1] ?? [];

  return universe
    .map((asset, i) => {
      const ctx = contexts[i] ?? {};
      const markPrice = num(ctx.markPx);
      const openInterestUsd = optionalNum(ctx.openInterest);
      const funding = optionalNum(ctx.funding);
      return {
        asset: asset.name ?? "?",
        markPrice,
        fundingBp: funding === null ? null : funding * 10_000,
        // openInterest viene en unidades del activo; se convierte a USD con el mark.
        openInterestUsd: openInterestUsd === null ? null : openInterestUsd * markPrice,
        notional24h: num(ctx.dayNtlVlm),
        maxLeverage: optionalNum(asset.maxLeverage),
      };
    })
    .filter((p) => p.markPrice > 0 && p.notional24h > 0)
    .sort((a, b) => b.notional24h - a.notional24h);
}

export interface AlienDexToken {
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
}

/**
 * El set de activos que lista AlienDEX (adex.alienflow.space), leído del
 * bundle real de esa app. ADEX no expone API de mercado propia todavía
 * (su `/api/markets` responde 404), así que los precios vienen de la misma
 * fuente que usa ADEX internamente —CoinGecko simple/price— y cada fila
 * enlaza a operar en el venue propio.
 */
const ADEX_COINS: { id: string; symbol: string; name: string }[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "tron", symbol: "TRX", name: "Tron" },
  { id: "the-open-network", symbol: "TON", name: "Toncoin" },
  { id: "polygon-ecosystem-token", symbol: "POL", name: "Polygon" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "stellar", symbol: "XLM", name: "Stellar" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
  { id: "tether", symbol: "USDT", name: "Tether" },
];

export const ADEX_URL = "https://adex.alienflow.space";

export async function fetchAlienDexTokens(signal?: AbortSignal): Promise<AlienDexToken[]> {
  const ids = ADEX_COINS.map((c) => c.id).join(",");
  const res = await safeFetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { signal, timeoutMs: 10_000 },
  );
  return ADEX_COINS.map((coin) => ({
    symbol: coin.symbol,
    name: coin.name,
    priceUsd: optionalNum(res?.[coin.id]?.usd),
    change24h: optionalNum(res?.[coin.id]?.usd_24h_change),
  }));
}
