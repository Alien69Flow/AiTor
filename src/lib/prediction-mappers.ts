/**
 * Mapeadores puros (sin I/O) de venues de predicción al modelo común
 * `PredictionEvent`. Van aquí —y no en market-data.ts— para poder testearlos
 * con fixtures sin arrastrar aliases de Vite ni la capa de red.
 *
 * Kalshi cambió en 2026 su esquema de precios: los enteros en centavos
 * (last_price 45 = 45¢) conviven con los fixed-point en dólares
 * (last_price_dollars "0.45"). Los mapeadores aceptan ambos y lo documentan;
 * la fixture de tests cubre las dos variantes.
 */

export type PredictionSourceId = "polymarket" | "manifold" | "kalshi" | "limitless";

export interface PredictionOutcome {
  id: string;
  label: string;
  /** 0..1 contract price = implied probability. */
  price: number;
  /** 24h move in probability points (e.g. 4.2 = +4.2 pp). */
  changePts: number | null;
  volume24h: number;
  volumeTotal: number;
  liquidity: number;
  openInterest: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  lastTrade: number | null;
  /** CLOB token id — used for the price-history chart. */
  tokenId: string | null;
  url: string | null;
}

export interface PredictionEvent {
  id: string;
  source: PredictionSourceId;
  title: string;
  slug: string;
  url: string;
  image: string | null;
  tags: string[];
  category: string;
  endDate: string | null;
  volume24h: number;
  volumeTotal: number;
  liquidity: number;
  openInterest: number | null;
  /** Manifold only: distinct forecasters. */
  bettors: number | null;
  comments: number | null;
  /** True when only the highest-volume legs were listed (multi-outcome event). */
  truncated: boolean;
  outcomes: PredictionOutcome[];
}

function toNum(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function toOptionalNum(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Precio de contrato 0..1 desde los dos esquemas de Kalshi:
 * fixed-point en dólares (`*_dollars: "0.45"`) o legacy en centavos
 * (`last_price: 45`). Cualquier valor > 1 se trata como centavos.
 */
function kalshiPrice(dollars: unknown, cents: unknown): number | null {
  if (dollars !== undefined && dollars !== null && dollars !== "") {
    const d = typeof dollars === "string" ? Number(dollars) : dollars;
    if (typeof d === "number" && Number.isFinite(d)) return clamp01(d);
  }
  const c = typeof cents === "string" ? Number(cents) : cents;
  if (typeof c === "number" && Number.isFinite(c)) return clamp01(c > 1 ? c / 100 : c);
  return null;
}

/** Importe en dólares: fixed-point string o número legacy. */
function kalshiDollars(...fields: unknown[]): number | null {
  for (const field of fields) {
    if (field === undefined || field === null || field === "") continue;
    const n = typeof field === "string" ? Number(field) : field;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

/* ------------------------------------------------------------------- Kalshi */

export interface KalshiMarket {
  ticker?: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  status?: string;
  close_time?: string;
  /** Legacy: centavos enteros (0..100). */
  last_price?: number | string;
  yes_bid?: number | string;
  yes_ask?: number | string;
  /** Nuevo esquema: dólares fixed-point ("0.45"). */
  last_price_dollars?: number | string;
  yes_bid_dollars?: number | string;
  yes_ask_dollars?: number | string;
  /** Contratos (legacy) o dólares fixed-point. */
  volume?: number | string;
  volume_24h?: number | string;
  volume_24h_dollars?: number | string;
  volume_fp?: number | string;
  open_interest?: number | string;
  open_interest_fp?: number | string;
  open_interest_dollars?: number | string;
  liquidity?: number | string;
  liquidity_dollars?: number | string;
}

export interface KalshiEvent {
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  category?: string;
  close_time?: string;
  markets?: KalshiMarket[];
}

/** Per-market public page: `https://kalshi.com/markets/{ticker}`. */
export function kalshiMarketUrl(ticker: string): string {
  return `https://kalshi.com/markets/${encodeURIComponent(ticker)}`;
}

/** Máximo de piernas por tarjeta; Kalshi agrupa strikes en un mismo evento. */
const KALSHI_MAX_LEGS = 12;

export function kalshiEventsToPredictionEvents(payload: unknown): PredictionEvent[] {
  const events = (payload as { events?: KalshiEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];

  const mapped: PredictionEvent[] = [];

  for (const event of events) {
    const eventTicker = event.event_ticker ?? "";
    const markets = (event.markets ?? []).filter((m) => m.status !== "closed" && m.status !== "settled");
    if (!eventTicker || markets.length === 0) continue;

    const outcomes: PredictionOutcome[] = [];
    for (const market of markets) {
      const ticker = market.ticker ?? eventTicker;
      const price =
        kalshiPrice(market.last_price_dollars, market.last_price) ??
        (() => {
          // Sin último trade: media de la mejor compra/venta del YES.
          const bid = kalshiPrice(market.yes_bid_dollars, market.yes_bid);
          const ask = kalshiPrice(market.yes_ask_dollars, market.yes_ask);
          return bid !== null && ask !== null ? (bid + ask) / 2 : null;
        })();
      if (price === null) continue;

      // Volumen/OI en dólares cuando el venue lo publica; si solo vienen
      // contratos, se estima el notional como contratos × precio.
      const volume24h =
        kalshiDollars(market.volume_24h_dollars) ??
        (toNum(market.volume_24h) > 0 ? toNum(market.volume_24h) * price : 0);
      const openInterest =
        kalshiDollars(market.open_interest_dollars) ??
        (toNum(market.open_interest) > 0 ? toNum(market.open_interest) * price : null);
      const bestBid = kalshiPrice(market.yes_bid_dollars, market.yes_bid);
      const bestAsk = kalshiPrice(market.yes_ask_dollars, market.yes_ask);

      outcomes.push({
        id: ticker,
        label: market.yes_sub_title?.trim() || market.title?.trim() || ticker,
        price,
        changePts: null,
        volume24h,
        volumeTotal: 0,
        liquidity: kalshiDollars(market.liquidity_dollars, market.liquidity) ?? 0,
        openInterest,
        bestBid,
        bestAsk,
        spread: bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null,
        lastTrade: kalshiPrice(market.last_price_dollars, market.last_price),
        tokenId: null,
        url: kalshiMarketUrl(ticker),
      });
    }

    if (!outcomes.length) continue;

    outcomes.sort((a, b) => b.volume24h - a.volume24h || b.price - a.price);
    const volume24h = outcomes.reduce((s, o) => s + o.volume24h, 0);
    const liquidity = outcomes.reduce((s, o) => s + o.liquidity, 0);

    mapped.push({
      id: eventTicker,
      source: "kalshi",
      title: event.title?.trim() || eventTicker,
      slug: eventTicker.toLowerCase(),
      // El ticker de mercado es la única URL pública verificada del API.
      url: outcomes[0].url ?? kalshiMarketUrl(eventTicker),
      image: null,
      tags: event.series_ticker ? [event.series_ticker] : [],
      category: event.category?.trim() || "Other",
      endDate: event.close_time ?? markets[0]?.close_time ?? null,
      volume24h,
      volumeTotal: 0,
      liquidity,
      openInterest: outcomes.reduce((s, o) => s + (o.openInterest ?? 0), 0) || null,
      bettors: null,
      comments: null,
      // Las piernas de más allá de KALSHI_MAX_LEGS se recortan sin botón de
      // expansión: la carga completa solo existe para Polymarket en la UI.
      truncated: false,
      outcomes: outcomes.slice(0, KALSHI_MAX_LEGS),
    });
  }

  return mapped.sort((a, b) => b.volume24h - a.volume24h);
}

/* ----------------------------------------------------------------- Limitless */

export interface LimitlessMarket {
  id?: number;
  title?: string;
  slug?: string;
  description?: string;
  prices?: number[];
  volume?: number | string;
  volumeFormatted?: number | string;
  openInterestFormatted?: number | string;
  liquidityFormatted?: number | string;
  expirationTimestamp?: number;
  imageUrl?: string;
  categories?: string[];
  status?: string;
  expired?: boolean;
  hidden?: boolean;
  priceOracleMetadata?: { ticker?: string; assetType?: string };
}

/** Página pública verificada (HTTP 200 probado): `https://limitless.exchange/markets/{slug}`. */
export function limitlessMarketUrl(slug: string): string {
  return `https://limitless.exchange/markets/${encodeURIComponent(slug)}`;
}

export function limitlessMarketsToPredictionEvents(payload: unknown): PredictionEvent[] {
  const rows = (payload as { data?: LimitlessMarket[] } | null)?.data;
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((m) => m && !m.expired && m.hidden !== true && m.slug && Array.isArray(m.prices) && m.prices.length >= 2)
    .map<PredictionEvent>((m) => {
      const slug = m.slug as string;
      const url = limitlessMarketUrl(slug);
      const up = clamp01(toNum(m.prices?.[0]));
      const liquidity = toNum(m.liquidityFormatted);
      // El feed público publica volumen acumulado del mercado, no ventana 24h;
      // volume24h queda a 0 y no se inventa una cifra.
      const volumeTotal = toNum(m.volumeFormatted) || toNum(m.volume);
      const openInterest = toOptionalNum(m.openInterestFormatted);
      const ticker = m.priceOracleMetadata?.ticker;

      return {
        id: `limitless-${m.id ?? slug}`,
        source: "limitless",
        title: m.title?.trim() || slug,
        slug,
        url,
        image: m.imageUrl ?? null,
        tags: (m.categories ?? []).filter(Boolean),
        category: ticker ? `${m.priceOracleMetadata?.assetType ?? "Crypto"} · ${ticker}` : "Crypto",
        endDate: m.expirationTimestamp ? new Date(m.expirationTimestamp).toISOString() : null,
        volume24h: 0,
        volumeTotal,
        liquidity,
        openInterest,
        bettors: null,
        comments: null,
        truncated: false,
        outcomes: [
          {
            id: `${slug}-up`,
            label: "Up",
            price: up,
            changePts: null,
            volume24h: 0,
            volumeTotal,
            liquidity,
            openInterest,
            bestBid: null,
            bestAsk: null,
            spread: null,
            lastTrade: up,
            tokenId: null,
            url,
          },
          {
            id: `${slug}-down`,
            label: "Down",
            price: clamp01(1 - up),
            changePts: null,
            volume24h: 0,
            volumeTotal,
            liquidity,
            openInterest,
            bestBid: null,
            bestAsk: null,
            spread: null,
            lastTrade: clamp01(1 - up),
            tokenId: null,
            url,
          },
        ],
      };
    })
    .sort((a, b) => b.liquidity - a.liquidity || b.volumeTotal - a.volumeTotal);
}
