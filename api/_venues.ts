/**
 * Selector de venues de predicción que los navegadores no pueden consultar
 * directamente (Kalshi responde 403 con cabecera `Origin`; Limitless no envía
 * `Access-Control-Allow-Origin`).
 *
 * Es un módulo puro sin imports: lo consumen a la vez la función serverless
 * `api/predictions.ts` (producción, Vercel) y el middleware de desarrollo de
 * `vite.config.ts`, para que `GET /api/predictions?venue=…` se comporte igual
 * en local y en producción. El venue va en whitelist cerrada (nunca se pasa
 * una URL arbitraria del cliente: esto no es un proxy abierto).
 */

export const VENUE_IDS = ["kalshi", "limitless"] as const;
export type VenueId = (typeof VENUE_IDS)[number];

export function isVenueId(value: string | null | undefined): value is VenueId {
  return typeof value === "string" && (VENUE_IDS as readonly string[]).includes(value);
}

/** URL de cada venue con sus parámetros por defecto. Límite acotado por seguridad. */
export function venueUrl(venue: VenueId, limit: number): string {
  const clamped = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 25));
  if (venue === "kalshi") {
    // Eventos abiertos con sus mercados anidados (keyless, solo lectura).
    return `https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=${clamped}`;
  }
  // Limitless: mercados activos (keyless; el propio docs muestra fetch de navegador,
  // pero sin ACAO el navegador lo bloquea, hence the proxy).
  return `https://api.limitless.exchange/markets/active?limit=${Math.min(25, clamped)}`;
}

export const VENUE_TIMEOUT_MS = 12_000;

/** TTL de caché compartido (Vercel lo usa como s-maxage; el dev lo ignora). */
export const VENUE_CACHE_SECONDS = 60;

export interface VenueFetchDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Descarga el payload crudo de un venue. Devuelve `{ ok, status, body }` con
 * `body` ya parseado como JSON cuando la respuesta es correcta.
 */
export async function fetchVenue(
  venue: VenueId,
  limit: number,
  deps: VenueFetchDeps = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const { fetchImpl = fetch, timeoutMs = VENUE_TIMEOUT_MS } = deps;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(venueUrl(venue, limit), {
      signal: ctrl.signal,
      // Kalshi acepta claves públicas; se manda un UA identificable por prudencia.
      headers: { accept: "application/json", "user-agent": "AiTor-MarketTerminal/1.0" },
    });
    if (!res.ok) return { ok: false, status: res.status, body: null };
    const body = (await res.json()) as unknown;
    return { ok: true, status: 200, body };
  } finally {
    clearTimeout(timer);
  }
}
