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
 *   1. `x-vercel-forwarded-for`, entera. La escribe el borde de Vercel y la
 *      sobrescribe, así que el cliente no puede colar la suya.
 *   2. `x-real-ip`, entera. Respaldo de proxies que la ponen en vez de una
 *      cadena.
 *   3. `x-forwarded-for`, ÚLTIMO segmento no vacío. Lo que añade el borde va
 *      al final de la cadena y lo que antepone el cliente, al principio: el
 *      primer segmento es justo el que puede escribir quien llama.
 *   4. El socket, sólo en Node. Sirve para desarrollo y para peticiones que no
 *      pasan por el borde; en Deno no existe y se salta.
 *   5. `"unknown"`. Nunca se devuelve cadena vacía: el rate limit necesita una
 *      clave estable y un `""` agruparía a todos los que no traen cabecera.
 *
 * `cf-connecting-ip` ya no se consulta: no está documentada para ninguno de
 * los dos bordes, así que la manda el cliente y rotarla estrenaba un cubo de
 * rate limit por petición.
 *
 * LÍMITE, dicho claro: `x-forwarded-for` la puede inventar el cliente. Esto es
 * una clave de rate limit y de agrupación, no una identidad. Quien quiera
 * saltarse el límite puede rotarla; lo que no puede es ganar permisos, porque
 * la autorización va por el `Bearer` (mcp) o por la lista de orígenes (guard).
 */
export const IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] as const;

/** Valor de IP cuando no hay ninguna cabecera ni socket. */
export const UNKNOWN_IP = "unknown";

/** Último segmento no vacío de una cadena `x-forwarded-for`. */
export function lastForwardedIp(value: string): string {
  const segments = value.split(",");
  for (let index = segments.length - 1; index >= 0; index--) {
    const trimmed = (segments[index] ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** IP del llamante según la regla única de arriba. */
export function clientIp(req: ApiRequest): string {
  for (const name of IP_HEADERS) {
    const raw = header(req, name);
    const candidate = name === "x-forwarded-for" ? lastForwardedIp(raw) : raw.trim();
    if (candidate) return candidate;
  }
  return req.socket?.remoteAddress?.trim() || UNKNOWN_IP;
}
