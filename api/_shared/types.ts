/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * Tipos estructurales mínimos de request/response.
 *
 * No importamos `@vercel/node`: los handlers pasan `VercelRequest` y
 * `VercelResponse` sin fricción porque son estructuralmente compatibles, y así
 * este módulo se puede probar (y typechequear) sin instalar la dependencia.
 */
export type HeaderValue = string | string[] | undefined;

export interface ApiRequest {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
  /** Sólo en Node (Vercel). En Deno no existe: allí la IP sale de las cabeceras. */
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  statusCode: number;
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
  setHeader(name: string, value: string | number | string[]): unknown;
  end(chunk?: string): unknown;
}

/** Primer valor de una cabecera, o "" si no viene. No distingue mayúsculas. */
export function header(req: ApiRequest, name: string): string {
  const headers = req.headers ?? {};
  const wanted = name.toLowerCase();

  let value = headers[wanted];
  if (value === undefined) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === wanted) {
        value = headers[key];
        break;
      }
    }
  }

  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * REGLA ÚNICA DE IP — la misma en los dos runtimes.
 *
 * Este proyecto corre en dos sitios y cada uno resolvía la IP a su manera:
 * aquí, en `api/mcp.ts` y en `supabase/functions/_shared/guard.ts`. Ahora la
 * regla es esta, y el lado Deno la replica literalmente (no puede importar de
 * `api/`: los edge functions sólo empaquetan su propio directorio).
 *
 * Orden, y por qué:
 *
 *   1. `x-forwarded-for`, primer segmento NO vacío. Es la única cabecera que
 *      los dos bordes (Vercel y el runtime de Supabase) ponen siempre. Se toma
 *      el primero porque es el orden en que la cadena declara el cliente.
 *   2. `x-real-ip`. Respaldo de proxies que la ponen en vez de la cadena.
 *   3. `cf-connecting-ip`. Tercera opción, por compatibilidad con delante-de-
 *      Cloudflare. Va DESPUÉS, no antes: un cliente puede mandarla y rotar
 *      cubos de rate limit si se cree primero.
 *   4. El socket, sólo en Node. Sirve para desarrollo y para peticiones que no
 *      pasan por el borde; en Deno no existe y se salta.
 *   5. `"unknown"`. Nunca se devuelve cadena vacía: el rate limit necesita una
 *      clave estable y un `""` agruparía a todos los que no traen cabecera.
 *
 * LÍMITE, dicho claro: `x-forwarded-for` la puede inventar el cliente. Esto es
 * una clave de rate limit y de agrupación, no una identidad. Quien quiera
 * saltarse el límite puede rotarla; lo que no puede es ganar permisos, porque
 * la autorización va por el `Bearer` (mcp) o por la lista de orígenes (guard).
 */
export const IP_HEADERS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] as const;

/** Valor de IP cuando no hay ninguna cabecera ni socket. */
export const UNKNOWN_IP = "unknown";

/** Primer segmento no vacío de una cadena `x-forwarded-for`. */
export function firstForwardedIp(value: string): string {
  for (const segment of value.split(",")) {
    const trimmed = segment.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** IP del llamante según la regla única de arriba. */
export function clientIp(req: ApiRequest): string {
  for (const name of IP_HEADERS) {
    const raw = header(req, name);
    const candidate = name === "x-forwarded-for" ? firstForwardedIp(raw) : raw.trim();
    if (candidate) return candidate;
  }
  return req.socket?.remoteAddress?.trim() || UNKNOWN_IP;
}
