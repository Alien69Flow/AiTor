/**
 * `GET /api/predictions?venue=polymarket|kalshi|limitless&limit=25`
 *
 * Puente de mismo origen para los venues de predicción que el navegador no
 * puede consultar:
 *
 *  - **Kalshi** responde 403 a cualquier petición con cabecera `Origin`.
 *  - **Limitless** no manda `Access-Control-Allow-Origin`.
 *  - **Polymarket** (gamma-api y clob) bloquea por país: desde España la
 *    conexión ni siquiera se abre, y Cloudflare corta buena parte de la UE.
 *
 * El venue va en whitelist cerrada y los parámetros se validan con expresiones
 * regulares, así que esto no es un proxy abierto. Además del `venue` acepta:
 *
 *   &slug=<evento>        todas las opciones (markets) de un evento Gamma
 *   &token=<clobTokenId>  histórico de precios de un resultado (CLOB)
 *   &interval=1d|1w|1m    ventana del histórico
 *
 * **Este archivo no importa nada del proyecto a propósito.** La versión que
 * importaba `./_venues` respondía `FUNCTION_INVOCATION_FAILED` (HTTP 500) en el
 * despliegue: el runtime ESM de Vercel no resolvía el módulo hermano. Todo lo
 * que necesita vive aquí, y `api/_venues.ts` sólo reexporta estas funciones para
 * el middleware de desarrollo y los tests, de modo que no hay dos
 * implementaciones.
 *
 * Egress: primero se intenta la conexión directa desde la región de la función;
 * si el venue la bloquea (403/451/timeout, el caso normal en la UE) se reintenta
 * a través de un lector HTTP con salida fuera de la UE (`r.jina.ai`). La
 * respuesta incluye `x-aitor-egress: direct|reader` para poder verificar en el
 * log de red cuál de los dos caminos se usó.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Vercel mata la función a los 10 s del plan gratuito; el handler necesita aire. */
export const maxDuration = 30;

export const VENUE_IDS = ["kalshi", "limitless", "polymarket"] as const;
export type VenueId = (typeof VENUE_IDS)[number];

export type PredictionInterval = "1d" | "1w" | "1m";
export type Egress = "direct" | "reader";

export function isVenueId(value: unknown): value is VenueId {
  return typeof value === "string" && (VENUE_IDS as readonly string[]).includes(value);
}

/** Slug de evento Gamma: minúsculas, dígitos y guiones. */
export function isSafeSlug(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(value);
}

/** Id de token del CLOB: entero decimal largo. */
export function isSafeToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,90}$/.test(value);
}

export function isSafeInterval(value: unknown): value is PredictionInterval {
  return value === "1d" || value === "1w" || value === "1m";
}

export interface VenueRequest {
  venue: VenueId;
  limit: number;
  /** Polymarket: evento cuyas opciones se quieren listar. */
  slug?: string | null;
  /** Polymarket: token del CLOB para el histórico de precios. */
  token?: string | null;
  interval?: PredictionInterval | null;
}

/**
 * Tope de filas por venue. Polymarket va a 50 porque su feed completo pesa
 * ~270 KB por evento: 90 eventos son 25 MB y el lector tarda 22 s (el cliente
 * corta a los 20 s y el panel se quedaba en 502).
 */
export const VENUE_MAX_LIMIT: Record<VenueId, number> = {
  polymarket: 50,
  kalshi: 100,
  limitless: 25,
};

/** URL del venue con sus parámetros. El límite va acotado (nunca 10 000). */
export function venueUrl(request: VenueRequest): string {
  const { venue } = request;
  const requested = Number.isFinite(request.limit) ? Math.floor(request.limit) : 25;
  const limit = Math.min(VENUE_MAX_LIMIT[venue], Math.max(1, requested));

  if (venue === "polymarket") {
    if (isSafeToken(request.token)) {
      const interval = isSafeInterval(request.interval) ? request.interval : "1d";
      return (
        `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(request.token)}` +
        `&interval=${interval}&fidelity=60`
      );
    }
    if (isSafeSlug(request.slug)) {
      return `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(request.slug)}`;
    }
    return `https://gamma-api.polymarket.com/events?limit=${limit}&closed=false&active=true&order=volume24hr&ascending=false`;
  }

  if (venue === "kalshi") {
    return `https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=${limit}`;
  }

  return `https://api.limitless.exchange/markets/active?limit=${limit}`;
}

/** Lector con salida fuera de la UE que devuelve el cuerpo original. */
export const READER_PREFIX = "https://r.jina.ai/";

export function readerUrl(target: string): string {
  return `${READER_PREFIX}${target}`;
}

/**
 * `r.jina.ai` responde de dos formas según la cabecera `Accept`:
 *  - `text/markdown`: preámbulo (`Title:`, `URL Source:`, `Markdown Content:`)
 *    seguido del cuerpo original.
 *  - `application/json`: sobre propio `{ code, status, data: { content,
 *    httpStatus } }` donde `content` es **otra** cadena JSON del venue.
 *
 * Devolver el sobre tal cual rompía el cliente (recibía `{code,data}` en lugar
 * del array de eventos), así que se desenvuelve aquí.
 */
export function parseReaderPayload(text: string): unknown {
  const marker = text.lastIndexOf("Markdown Content:");
  const body = marker >= 0 ? text.slice(marker + "Markdown Content:".length) : text;
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("el lector no devolvió JSON");
  try {
    return unwrapReaderEnvelope(JSON.parse(body.slice(start).trim()));
  } catch {
    throw new Error("el lector devolvió un cuerpo que no es JSON");
  }
}

/** Desenvuelve el sobre `{ data: { content } }` del lector si lo hubiera. */
function unwrapReaderEnvelope(payload: unknown): unknown {
  const data = (payload as { data?: unknown })?.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || !("content" in data)) return payload;
  const { content, httpStatus } = data as { content?: unknown; httpStatus?: unknown };
  if (typeof httpStatus === "number" && (httpStatus < 200 || httpStatus >= 300)) {
    throw new Error(`el lector recibió HTTP ${httpStatus} del origen`);
  }
  return typeof content === "string" ? JSON.parse(content) : content;
}

/**
 * Cuerpo de una respuesta de venue: JSON directo, sobre del lector o texto con
 * preámbulo. Un solo punto de entrada para no depender del `Accept`.
 */
export function parseVenueBody(text: string): unknown {
  const head = text.trimStart()[0];
  if (head === "{" || head === "[") {
    return unwrapReaderEnvelope(JSON.parse(text));
  }
  return parseReaderPayload(text);
}

/**
 * Campos que de verdad consume `src/lib/market-data.ts` al mapear Gamma. Todo lo
 * demás (`description`, `series`, `teams`, `eventMetadata`…) viaja igual por el
 * cable pero no se usa: 25 eventos con sus mercados pesan 6,2 MB, y una función
 * serverless de Vercel corta la respuesta en 4,5 MB.
 */
const GAMMA_EVENT_FIELDS = [
  "id",
  "slug",
  "title",
  "image",
  "icon",
  "endDate",
  "volume",
  "volume24hr",
  "liquidity",
  "openInterest",
  "commentCount",
  "negRisk",
  "tags",
] as const;

const GAMMA_MARKET_FIELDS = [
  "id",
  "slug",
  "question",
  "groupItemTitle",
  "outcomes",
  "outcomePrices",
  "clobTokenIds",
  "volume",
  "volume24hr",
  "volumeNum",
  "liquidity",
  "liquidityNum",
  "openInterest",
  "bestBid",
  "bestAsk",
  "spread",
  "lastTradePrice",
  "oneDayPriceChange",
  "endDate",
  "active",
  "closed",
] as const;

/** Tope de opciones por evento en el feed; el resto se pide al expandir. */
export const GAMMA_MAX_MARKETS = 40;

/** Tope duro de respuesta: Vercel corta las funciones en 4,5 MB. */
export const RESPONSE_MAX_BYTES = 4_000_000;

function pickFields(source: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const row = source as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields) if (row[field] !== undefined) out[field] = row[field];
  return Object.keys(out).length ? out : null;
}

function compactGammaMarket(market: unknown): Record<string, unknown> | null {
  return pickFields(market, GAMMA_MARKET_FIELDS);
}

function compactGammaEvent(event: unknown): Record<string, unknown> | null {
  const base = pickFields(event, GAMMA_EVENT_FIELDS);
  const markets = (event as { markets?: unknown })?.markets;
  if (!base || !Array.isArray(markets)) return base;
  base.markets = markets
    .slice(0, GAMMA_MAX_MARKETS)
    .map(compactGammaMarket)
    .filter((market): market is Record<string, unknown> => market !== null);
  return base;
}

/**
 * Recorta el payload de Gamma a los campos que el cliente mapea, sin tocar
 * ninguna otra forma: si el cuerpo no se reconoce se devuelve tal cual, para que
 * un cambio de esquema del venue nunca deje el panel sin datos.
 */
export function compactGammaPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    const rows = payload as unknown[];
    const isEventList = rows.some((row) => Array.isArray((row as { markets?: unknown })?.markets));
    const compacted = rows
      .map((row) => (isEventList ? compactGammaEvent(row) : compactGammaMarket(row)))
      .filter((row): row is Record<string, unknown> => row !== null);
    // Un payload reconocido pero vacío se deja intacto: mejor un error del mapeo
    // que un array vacío silencioso.
    return compacted.length ? compacted : payload;
  }
  const markets = (payload as { markets?: unknown } | null)?.markets;
  if (Array.isArray(markets)) {
    const compacted = markets
      .map(compactGammaMarket)
      .filter((market): market is Record<string, unknown> => market !== null);
    return compacted.length ? { ...(payload as Record<string, unknown>), markets: compacted } : payload;
  }
  return payload;
}

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Última red de seguridad si un feed sigue por encima del límite de Vercel. */
export function trimToByteBudget<T>(payload: T, budget = RESPONSE_MAX_BYTES): T {
  if (byteLength(payload) <= budget) return payload;
  if (Array.isArray(payload)) {
    const kept = [...(payload as unknown[])];
    while (kept.length > 1 && byteLength(kept) > budget) kept.pop();
    return kept as T;
  }
  return payload;
}

/**
 * Tiempos medidos: el camino directo contesta en ~1 s o falla al instante (el
 * bloqueo por país no espera); el lector tarda ~10 s con 30 eventos de Gamma.
 * 6 + 22 = 28 s, por debajo de los 30 s que declara `maxDuration`.
 */
export const VENUE_TIMEOUT_MS = 6_000;
export const READER_TIMEOUT_MS = 22_000;

/**
 * El lector (`r.jina.ai`) descarga el evento completo de Gamma sin recortar, así
 * que con 50 eventos tarda ~20 s — justo el timeout del cliente. El respaldo
 * pide menos filas para contestar a tiempo; el camino directo de producción
 * (región iad1) sigue trayendo el máximo.
 */
export const GAMMA_READER_MAX_EVENTS = 30;

/** TTL de caché compartido (Vercel lo usa como s-maxage; el dev lo ignora). */
export const VENUE_CACHE_SECONDS = 60;

export interface VenueFetchDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  readerTimeoutMs?: number;
}

export interface VenueResult {
  ok: boolean;
  status: number;
  body: unknown;
  egress: Egress;
  /** Detalle del último fallo, útil para el cliente y para depurar. */
  reason?: string;
}

async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: unknown; reason?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: {
        accept: "application/json",
        // Los venues devuelven 403 a UAs vacíos o de script.
        "user-agent": "Mozilla/5.0 (compatible; AiTor-MarketTerminal/1.0)",
      },
    });
    if (!res.ok) return { ok: false, status: res.status, body: null, reason: `HTTP ${res.status}` };
    try {
      return { ok: true, status: 200, body: parseVenueBody(await res.text()) };
    } catch (error) {
      return {
        ok: false,
        status: res.status,
        body: null,
        reason: error instanceof Error ? error.message : "la respuesta no era JSON",
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, body: null, reason: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Descarga el payload crudo de un venue: directo y, si el país está bloqueado,
 * a través del lector. Nunca lanza.
 */
export async function fetchVenue(
  request: VenueRequest,
  deps: VenueFetchDeps = {},
): Promise<VenueResult> {
  const { fetchImpl = fetch, timeoutMs = VENUE_TIMEOUT_MS, readerTimeoutMs = READER_TIMEOUT_MS } = deps;
  const target = venueUrl(request);

  // Gamma es el único venue cuyo payload hay que recortar: el evento completo
  // con sus mercados no cabe en la respuesta de una función de Vercel.
  const shape = (body: unknown) =>
    request.venue === "polymarket" ? trimToByteBudget(compactGammaPayload(body)) : body;

  const direct = await requestJson(fetchImpl, target, timeoutMs);
  if (direct.ok) return { ok: true, status: 200, body: shape(direct.body), egress: "direct" };
  const firstReason = direct.reason ?? `HTTP ${direct.status}`;

  const readerTarget =
    request.venue === "polymarket"
      ? venueUrl({ ...request, limit: Math.min(request.limit, GAMMA_READER_MAX_EVENTS) })
      : target;
  const viaReader = await requestJson(fetchImpl, readerUrl(readerTarget), readerTimeoutMs);
  if (viaReader.ok) return { ok: true, status: 200, body: shape(viaReader.body), egress: "reader" };

  return {
    ok: false,
    status: viaReader.status || direct.status || 502,
    body: null,
    egress: "reader",
    reason: `directo: ${firstReason} · lector: ${viaReader.reason ?? "sin respuesta"}`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const query = req.query ?? {};
  const venue = query.venue;
  if (!isVenueId(venue)) {
    res.status(400).json({ error: "unknown venue; use polymarket, kalshi or limitless" });
    return;
  }

  const slug = typeof query.slug === "string" ? query.slug : null;
  const token = typeof query.token === "string" ? query.token : null;
  const interval = typeof query.interval === "string" ? query.interval : null;

  if (slug !== null && !isSafeSlug(slug)) {
    res.status(400).json({ error: "slug inválido" });
    return;
  }
  if (token !== null && !isSafeToken(token)) {
    res.status(400).json({ error: "token inválido" });
    return;
  }
  if (interval !== null && !isSafeInterval(interval)) {
    res.status(400).json({ error: "interval inválido; usa 1d, 1w o 1m" });
    return;
  }

  const limit = typeof query.limit === "string" ? Number(query.limit) : 25;

  try {
    const result = await fetchVenue({ venue, limit, slug, token, interval });
    res.setHeader("x-aitor-egress", result.egress);
    if (result.ok) {
      const size = byteLength(result.body);
      res.setHeader("x-aitor-bytes", String(size));
    }

    if (!result.ok) {
      // Un fallo transitorio no se cachea: si el CDN guardase el 502, el
      // «Reintentar» del cliente devolvería el mismo error durante un minuto.
      res.setHeader("Cache-Control", "no-store");
      res.status(502).json({
        error: `${venue} no respondió por ninguno de los dos caminos`,
        detail: result.reason,
        egress: result.egress,
      });
      return;
    }

    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${VENUE_CACHE_SECONDS}, stale-while-revalidate=${VENUE_CACHE_SECONDS * 5}`,
    );
    res.status(200).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream fetch failed";
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: `${venue} inaccesible: ${message}` });
  }
}
