/**
 * Precio verificable, sin modelo de por medio.
 *
 * La fase 9 pide una señal con **fuente, hora y precio** comprobables. Un LLM no
 * puede dar eso: inventa el precio y la hora. Así que el precio sale de una API
 * pública (CoinGecko), y la respuesta lleva la URL exacta que se consultó y las
 * dos horas: la del dato (`asOf`, la que publica la fuente) y la de la lectura
 * (`fetchedAt`, la de este proceso). Cualquiera puede abrir la URL y comparar.
 *
 * Sin clave: el endpoint público de CoinGecko no la necesita para precios
 * simples, y añadir una clave sería otra variable que puede faltar.
 */

/** Símbolos que entiende el comando del bot, con su id en CoinGecko. */
export const QUOTE_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  TON: "the-open-network",
  USDC: "usd-coin",
  USDT: "tether",
};

export interface Quote {
  /** Símbolo pedido, en mayúsculas. */
  symbol: string;
  /** Id con el que se consultó la fuente. */
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

/** Error con el código HTTP que le corresponde, para no filtrar detalles. */
export class QuoteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

const API = "https://api.coingecko.com/api/v3/simple/price";
const TIMEOUT_MS = 10_000;

export function quoteUrl(id: string): string {
  return `${API}?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_last_updated_at=true`;
}

/**
 * Devuelve el precio con su fuente y sus dos horas.
 *
 * Lanza `QuoteError` con 400 si el símbolo no está en el mapa y con 502 si la
 * fuente no responde o no trae el precio: quien llama decide qué contar, pero
 * nunca se inventa un número para tener algo que enseñar.
 */
export async function fetchQuote(rawSymbol: string): Promise<Quote> {
  const symbol = rawSymbol.trim().toUpperCase();
  const id = QUOTE_IDS[symbol];
  if (!id) {
    throw new QuoteError(
      `Símbolo no soportado: ${symbol || "(vacío)"}. Válidos: ${Object.keys(QUOTE_IDS).join(", ")}.`,
      400,
    );
  }

  const source = quoteUrl(id);
  const fetchedAt = new Date().toISOString();

  let response: Response;
  try {
    response = await fetch(source, {
      headers: { accept: "application/json", "user-agent": "aitor-backend/1.0 (quote)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new QuoteError(
      `La fuente no respondió: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }

  if (!response.ok) {
    throw new QuoteError(`La fuente contestó HTTP ${response.status}`, 502);
  }

  const payload = (await response.json().catch(() => null)) as
    | Record<string, { usd?: number; last_updated_at?: number }>
    | null;
  const entry = payload?.[id];
  if (!entry || typeof entry.usd !== "number") {
    throw new QuoteError("La fuente contestó sin precio para ese símbolo", 502);
  }

  // `last_updated_at` es la hora del dato según CoinGecko; si no viene, se usa
  // la de la lectura y se dice tal cual (`fetchedAt` sigue siendo la lectura).
  const asOf = entry.last_updated_at
    ? new Date(entry.last_updated_at * 1000).toISOString()
    : fetchedAt;

  return {
    symbol,
    id,
    priceUsd: entry.usd,
    asOf,
    fetchedAt,
    source,
    sourceName: "CoinGecko",
  };
}
