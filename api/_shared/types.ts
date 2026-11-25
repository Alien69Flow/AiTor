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

/** Último salto no vacío: el más cercano a nosotros, no el que pudo poner el cliente. */
function lastHop(value: string): string {
  return (
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ?? ""
  );
}

/**
 * IP del llamante, y sólo de cabeceras que escribe la plataforma.
 *
 * Vercel sobrescribe `x-forwarded-for` y no reenvía la IP que mande el cliente
 * (salvo Enterprise con proxy de confianza), así que esas tres son de fiar:
 *
 *  1. `x-vercel-forwarded-for`: la propia de Vercel, y la única que sobrevive a
 *     un proxy delante si algún día se pone uno.
 *  2. `x-real-ip`: la misma IP, por si la primera no llega.
 *  3. `x-forwarded-for`: último salto, como último recurso.
 *
 * `cf-connecting-ip` **no se lee**, a propósito. Producción no está detrás de
 * Cloudflare (el dominio es CNAME a `vercel-dns` y el apex resuelve a
 * 76.76.21.21), y los previews `*.vercel.app` van a Vercel directo, así que esa
 * cabecera sólo puede venir del visitante: leerla permitía inventarse un cubo
 * de rate limit nuevo con cada petición, que es peor que compartir uno. Si
 * algún día Cloudflare sí va delante, el paso previo es cerrar el origen —que
 * no se pueda alcanzar saltándose el CDN— y entonces volver a leerla a
 * propósito, no por lo que diga el DNS.
 *
 * Sin ninguna cabecera (dev en local) devuelve "unknown": un único cubo, que en
 * local es exactamente lo que se quiere.
 */
export function clientIp(req: ApiRequest): string {
  const vercel = lastHop(header(req, "x-vercel-forwarded-for"));
  if (vercel) return vercel;

  const real = lastHop(header(req, "x-real-ip"));
  if (real) return real;

  return lastHop(header(req, "x-forwarded-for")) || "unknown";
}
