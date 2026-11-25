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
}
export interface ApiResponse {
  statusCode: number;
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
  setHeader(name: string, value: string | number | string[]): unknown;
  end(chunk?: string): unknown;
}

/** Primer valor de una cabecera, o "" si no viene. */
export function header(req: ApiRequest, name: string): string {
  const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

/**
 * IP del llamante, con el mismo orden que `supabase/functions/_shared/guard.ts`.
 *
 *  1. `cf-connecting-ip`: Cloudflare la escribe con el cliente real y pisa la
 *     que mande el visitante, así que es la única que sigue siendo del cliente
 *     cuando hay un CDN delante.
 *  2. `x-real-ip`: la escribe Vercel con el par TCP. Sin CDN es el cliente; con
 *     Cloudflare delante sería la IP del borde, idéntica para todos los
 *     usuarios de ese PoP — por eso no va primero.
 *  3. `x-forwarded-for`: primer salto, y sólo como último recurso. Es la parte
 *     que puede aportar el visitante, así que no se usa si hay algo mejor.
 *
 * Sin ninguna cabecera (dev en local) devuelve "unknown": un único cubo, que en
 * local es exactamente lo que se quiere.
 *
 * Caveat: si el despliegue de Vercel es alcanzable saltándose Cloudflare, un
 * visitante puede inventarse `cf-connecting-ip` y estrenar cubo. Eso se cierra
 * cerrando el origen, no eligiendo otra cabecera.
 */
export function clientIp(req: ApiRequest): string {
  const cf = header(req, "cf-connecting-ip").trim();
  if (cf) return cf;

  const real = header(req, "x-real-ip").trim();
  if (real) return real;

  const first = header(req, "x-forwarded-for").split(",")[0]?.trim();
  return first || "unknown";
}
