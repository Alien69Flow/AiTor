/**
 * Señal de mercado: precio, fuente y hora, sin modelo de por medio.
 *
 * La fase 9 pide algo comprobable. Un LLM no puede dar eso: inventa la cifra y
 * la hora. Aquí el precio sale de una API pública (CoinGecko, sin clave) y la
 * respuesta lleva la URL exacta consultada y las dos horas: la del dato
 * (`asOf`, la que publica la fuente) y la de la lectura (`fetchedAt`, la de este
 * proceso). Cualquiera abre la URL y compara.
 *
 * Si la fuente no responde no hay señal: se dice con un código, no se rellena
 * con una cifra de mentira.
 */

/** Símbolos que entiende la señal, con su id en la fuente. */
export const SIGNAL_SYMBOLS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  TON: "the-open-network",
} as const;

export type SignalSymbol = keyof typeof SIGNAL_SYMBOLS;

export interface MarketSignal {
  symbol: SignalSymbol;
  id: string;
  priceUsd: number;
  /** Hora que publica la fuente para ese precio (ISO 8601). */
  asOf: string;
  /** Hora en la que este proceso leyó el dato (ISO 8601). */
  fetchedAt: string;
  /** URL exacta consultada: es la prueba que se puede abrir. */
  source: string;
  sourceName: string;
}

export type SignalErrorCode = "symbol" | "source" | "shape";

export class SignalError extends Error {
  constructor(
    message: string,
    readonly code: SignalErrorCode,
  ) {
    super(message);
    this.name = "SignalError";
  }
}

/** La caché de Redis: 60 s. El precio no cambia tanto, la fuente tiene cuota. */
export const SIGNAL_TTL_SECONDS = 60;
/** A partir de aquí el dato se considera viejo y se dice en la respuesta. */
export const SIGNAL_STALE_AFTER_SECONDS = 300;
export const SIGNAL_SOURCE_TIMEOUT_MS = 8_000;
export const SIGNAL_SOURCE_NAME = "CoinGecko";

const API = "https://api.coingecko.com/api/v3/simple/price";

export function parseSignalSymbol(raw: string | null | undefined): SignalSymbol | null {
  const symbol = (raw ?? "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(SIGNAL_SYMBOLS, symbol) ? (symbol as SignalSymbol) : null;
}

export function signalSourceUrl(symbol: SignalSymbol): string {
  const id = SIGNAL_SYMBOLS[symbol];
  return `${API}?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_last_updated_at=true`;
}

/** ISO 8601 válido o `null`; sirve para no aceptar una fecha inventada. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function signalAgeSeconds(signal: Pick<MarketSignal, "fetchedAt">, now = Date.now()): number {
  const at = Date.parse(signal.fetchedAt);
  if (Number.isNaN(at)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((now - at) / 1000));
}

export function humanAge(seconds: number): string {
  if (!Number.isFinite(seconds)) return "hora desconocida";
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Convierte la respuesta de la fuente en una señal. Devuelve `null` si falta el
 * precio: quien llama decide qué contar, pero nunca se inventa una cifra.
 */
export function parseSignal(
  symbol: SignalSymbol,
  payload: unknown,
  now: Date = new Date(),
): MarketSignal | null {
  if (!isRecord(payload)) return null;
  const entry = payload[SIGNAL_SYMBOLS[symbol]];
  if (!isRecord(entry)) return null;
  const price = entry.usd;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;

  const fetchedAt = now.toISOString();
  const updated = entry.last_updated_at;
  const asOf =
    typeof updated === "number" && Number.isFinite(updated) && updated > 0
      ? new Date(updated * 1000).toISOString()
      : fetchedAt;

  return {
    symbol,
    id: SIGNAL_SYMBOLS[symbol],
    priceUsd: price,
    asOf,
    fetchedAt,
    source: signalSourceUrl(symbol),
    sourceName: SIGNAL_SOURCE_NAME,
  };
}

/**
 * Valida una señal ya normalizada (la que devuelve `/api/signal`, o la que hay
 * en caché). Así el bot y la caché no se creen cualquier objeto con `priceUsd`.
 */
export function parseMarketSignal(raw: unknown): MarketSignal | null {
  if (!isRecord(raw)) return null;
  const symbol = parseSignalSymbol(typeof raw.symbol === "string" ? raw.symbol : null);
  if (!symbol) return null;
  if (typeof raw.priceUsd !== "number" || !Number.isFinite(raw.priceUsd) || raw.priceUsd <= 0) {
    return null;
  }
  if (!isIsoDate(raw.asOf) || !isIsoDate(raw.fetchedAt)) return null;
  if (typeof raw.source !== "string" || !raw.source.startsWith("https://")) return null;
  return {
    symbol,
    id: SIGNAL_SYMBOLS[symbol],
    priceUsd: raw.priceUsd,
    asOf: raw.asOf,
    fetchedAt: raw.fetchedAt,
    source: raw.source,
    sourceName: typeof raw.sourceName === "string" ? raw.sourceName : SIGNAL_SOURCE_NAME,
  };
}

/** Pide el precio a la fuente. Lanza `SignalError`; nunca devuelve una cifra inventada. */
export async function fetchSignal(
  symbol: SignalSymbol,
  { fetchImpl = fetch, now = () => new Date() }: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<MarketSignal> {
  const source = signalSourceUrl(symbol);
  let response: Response;
  try {
    response = await fetchImpl(source, {
      headers: { accept: "application/json", "user-agent": "aitor-signal/1.0" },
      signal: AbortSignal.timeout(SIGNAL_SOURCE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new SignalError(
      `la fuente no respondió: ${error instanceof Error ? error.message : String(error)}`,
      "source",
    );
  }

  if (!response.ok) {
    throw new SignalError(`la fuente contestó HTTP ${response.status}`, "source");
  }

  const payload: unknown = await response.json().catch(() => null);
  const signal = parseSignal(symbol, payload, now());
  if (!signal) {
    throw new SignalError("la fuente contestó sin precio para ese símbolo", "shape");
  }
  return signal;
}

/** Precio en dólares con separador de miles, sin depender del idioma del host. */
export function formatUsd(price: number): string {
  return price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * El mensaje de Telegram. Lleva la URL de la fuente como enlace y las dos
 * horas: sin eso sería otra cifra que hay que creerse.
 */
export function formatSignalHtml(signal: MarketSignal, now = Date.now()): string {
  const age = humanAge(signalAgeSeconds(signal, now));
  const stale = signalAgeSeconds(signal, now) > SIGNAL_STALE_AFTER_SECONDS ? " · dato viejo" : "";
  return [
    `📈 <b>${signal.symbol}</b> · <b>$${formatUsd(signal.priceUsd)}</b>`,
    `Fuente: <a href="${signal.source.replace(/&/g, "&amp;")}">${signal.sourceName}</a>`,
    `Dato: <code>${signal.asOf}</code> (${age}${stale})`,
    `Leído: <code>${signal.fetchedAt}</code>`,
  ].join("\n");
}

/** Lo que se contesta cuando no hay señal. Sin cifras y con el motivo. */
export function formatSignalUnavailableHtml(symbol: string, reason: string): string {
  const validos = Object.keys(SIGNAL_SYMBOLS).join(", ");
  if (reason === "symbol") {
    return `No conozco ${symbol ? `<code>${escapeHtml(symbol)}</code>` : "ese símbolo"}. Puedo con: ${validos}.\nUso: <code>/senal BTC</code>`;
  }
  return [
    `⚠️ <b>Sin señal de ${escapeHtml(symbol)}</b>`,
    "",
    `No pude leer el precio: ${escapeHtml(reason)}.`,
    "No te doy una cifra sin fuente: vuelve a intentarlo en un minuto.",
  ].join("\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
