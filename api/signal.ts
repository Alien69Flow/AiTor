import { applyCors } from "./_shared/cors.js";
import { sendError, sendJson, type ApiRequest, type ApiResponse } from "./_shared/http.js";
import {
  fetchSignal,
  parseMarketSignal,
  parseSignalSymbol,
  SignalError,
  SIGNAL_STALE_AFTER_SECONDS,
  SIGNAL_SYMBOLS,
  SIGNAL_TTL_SECONDS,
  signalAgeSeconds,
  type MarketSignal,
} from "./_shared/market-signal.js";
import { getJson, isRedisConfigured, scopedKey, setJson } from "./_shared/redis.js";

/**
 * `GET /api/signal?symbol=BTC` — la señal que pide la fase 9.
 *
 * Devuelve precio, fuente y dos horas (`asOf` de la fuente, `fetchedAt` de la
 * lectura) para que se pueda verificar abriendo la URL. La caché es de 60 s en
 * Redis: el precio no cambia tanto y CoinGecko tiene cuota. Sin Redis funciona
 * igual, sólo que cada petición va a la fuente.
 *
 * Estado vacío honesto: si la fuente no responde, 502 con `code` y sin cifra.
 * Un precio inventado sería peor que un fallo.
 */

export const maxDuration = 20;

interface SignalPayload {
  ok: true;
  servedFrom: "api/signal";
  cache: "hit" | "miss" | "off";
  ageSeconds: number;
  stale: boolean;
  signal: MarketSignal;
}

function cacheKey(symbol: string): string {
  return scopedKey(`aitor:signal:${symbol}`);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (applyCors(req, res, { publicRead: true })) return;

  const host = String(req.headers?.host || "localhost");
  const url = new URL(req.url || "/api/signal", `https://${host}`);
  const raw = url.searchParams.get("symbol") ?? "BTC";
  const symbol = parseSignalSymbol(raw);

  if (!symbol) {
    sendError(res, 400, {
      error: `símbolo no soportado: ${raw}`,
      code: "bad_symbol",
      valid: Object.keys(SIGNAL_SYMBOLS),
    });
    return;
  }

  const withAge = (signal: MarketSignal, cache: SignalPayload["cache"]): SignalPayload => {
    const ageSeconds = signalAgeSeconds(signal);
    return {
      ok: true,
      servedFrom: "api/signal",
      cache,
      ageSeconds,
      stale: ageSeconds > SIGNAL_STALE_AFTER_SECONDS,
      signal,
    };
  };

  const cacheOn = isRedisConfigured();
  if (cacheOn) {
    const cached = parseMarketSignal(await getJson<unknown>(cacheKey(symbol)).catch(() => null));
    // Sólo se sirve de caché lo que se puede verificar: una entrada sin precio
    // o sin fuente no es una señal.
    if (cached) {
      sendJson(req, res, 200, withAge(cached, "hit"), { cache: "realtime" });
      return;
    }
  }

  try {
    const signal = await fetchSignal(symbol);
    if (cacheOn) await setJson(cacheKey(symbol), signal, SIGNAL_TTL_SECONDS).catch(() => {});
    sendJson(req, res, 200, withAge(signal, cacheOn ? "miss" : "off"), { cache: "realtime" });
  } catch (error) {
    const code = error instanceof SignalError ? error.code : "source";
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[signal] ${symbol}: ${reason}`);
    sendError(
      res,
      502,
      {
        ok: false,
        servedFrom: "api/signal",
        symbol,
        error: "la fuente de precio no respondió",
        reason,
        code,
      },
      { "Retry-After": "60" },
    );
  }
}
