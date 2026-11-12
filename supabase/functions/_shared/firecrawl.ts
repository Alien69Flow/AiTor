/**
 * Cliente HTTP de Firecrawl, en la versión 2 de su API.
 *
 * La v1 se apaga el **10 de diciembre de 2026 a las 15:00 UTC**: desde
 * entonces `/v1/scrape`, `/v1/search`, `/v1/crawl`, `/v1/map` y
 * `/v1/batch/scrape` responden 410. La v2 conserva las rutas (la única que
 * cambia es `/v1/crawl/ongoing` → `/v2/crawl/active`) y cambia una cosa que sí
 * rompe clientes en silencio: los resultados de búsqueda **ya no son un array
 * en `data`**, pasan a `data.web` (y `data.news` / `data.images` si se piden
 * esas fuentes). Además el límite por defecto pasa de 5 a 10.
 *
 * Por eso este módulo no devuelve el JSON crudo y ya: normaliza con
 * `webResults`, que entiende las dos formas.
 *
 * No usa `Deno` a propósito —la clave entra como argumento— para que el mismo
 * fichero se pueda probar desde Vitest sin el runtime de Edge Functions.
 */

export const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

/** Fuentes de una búsqueda v2. Sin pedirlas, la respuesta trae sólo `web`. */
export type FirecrawlSource = "web" | "news" | "images";

export interface FirecrawlSearchBody {
  query: string;
  limit?: number;
  /** Filtro temporal: `qdr:h`, `qdr:d`, `qdr:w`, `qdr:m`, `qdr:y` o `cdr:…`. */
  tbs?: string;
  country?: string;
  /** Con varias fuentes, `limit` se aplica **por fuente**, no en total. */
  sources?: FirecrawlSource[];
  /** `{ formats: ["markdown"] }` para traer el contenido de cada resultado. */
  scrapeOptions?: Record<string, unknown>;
}

/** Un resultado de /search. En v2 la forma es estable; se lee con cuidado. */
export interface FirecrawlResult {
  url?: string;
  title?: string;
  description?: string;
  snippet?: string;
  markdown?: string;
  [key: string]: unknown;
}

export interface FirecrawlReply {
  ok: boolean;
  status: number;
  /** Cuerpo tal cual lo devolvió Firecrawl. */
  payload: unknown;
  /** Resultados web normalizados. */
  results: FirecrawlResult[];
  error?: string;
}

/**
 * Resultados web de una respuesta de /search, en v1 o en v2.
 *
 * v2: `{ success, data: { web: [...] } }`. v1: `{ success, data: [...] }`.
 * Se aceptan las dos porque una función redesplegada un día antes que otra
 * mezclaría formatos, y en ese caso es mejor enseñar resultados que vaciar el
 * feed.
 */
export function webResults(payload: unknown): FirecrawlResult[] {
  const body = payload as { data?: unknown; web?: unknown } | null;
  const data = body?.data;
  const candidates = [(data as { web?: unknown } | null)?.web, data, body?.web];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as unknown as FirecrawlResult[];
  }
  return [];
}

/** POST /search contra la v2, con los resultados ya normalizados. */
export async function firecrawlSearch(
  apiKey: string,
  body: FirecrawlSearchBody,
): Promise<FirecrawlReply> {
  const response = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload: unknown = await response.json().catch(() => null);
  const error =
    payload && typeof (payload as { error?: unknown }).error === "string"
      ? String((payload as { error: string }).error)
      : undefined;

  return {
    ok: response.ok,
    status: response.status,
    payload,
    results: response.ok ? webResults(payload) : [],
    error,
  };
}
