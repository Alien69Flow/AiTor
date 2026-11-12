/**
 * `GET /api/gdelt` — proxy del feed geolocalizado de conflictos de GDELT.
 *
 * Por qué existe. La capa «Conflict Zones» pedía GDELT desde el navegador y no
 * pintaba nada. Al mirarlo de cerca el diagnóstico fácil («es CORS») era falso a
 * medias, y el problema real era peor:
 *
 *  1. `DOC 2.0` —la API de documentos— **no acepta `format=geojson`**: devuelve
 *     un 200 con la página HTML «Invalid format.». Por eso `fetch().json()`
 *     fallaba siempre: el cuerpo nunca fue JSON. Además sus artículos no traen
 *     coordenadas, así que ni arreglando el formato habría chinchetas.
 *  2. `GEO 2.0`, la API que sí devolvía GeoJSON geolocalizado, **está caída**:
 *     `/api/v2/geo/geo` responde 404 desde el propio servidor de GDELT.
 *
 * El único endpoint vivo que devuelve geolocalización es el antiguo
 * `GKG GeoJSON (v1)`, que cruza los temas del Global Knowledge Graph con las
 * coordenadas de cada lugar mencionado. Eso es lo que se sirve aquí: cobertura
 * real de conflicto armado (tema `ARMEDCONFLICT`), con coordenadas, lugar,
 * medio, enlace y fecha. Llega actualizado cada 15 minutos.
 *
 * Lo que esta fuente **no** da es el titular, así que el proxy no inventa uno:
 * devuelve los campos que existen (lugar, coordenadas, medio, enlace, fecha y
 * tono) y la clasificación se hace en el cliente.
 *
 * No es un proxy abierto: destino fijo, `theme` limitado a un token de tema de
 * GDELT, ventana de 1 a 24 h y 500 filas como tope. Y como el servidor de GDELT
 * limita a una petición cada 5 s, la respuesta se cachea cinco minutos: la capa
 * sondea cada diez y varias pestañas comparten la misma descarga.
 *
 * Autocontenido, como `api/github.ts`: el runtime de Vercel ya falló resolviendo
 * imports hermanos, así que sólo se importan tipos.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const maxDuration = 25;

export const GDELT_GKG = "https://api.gdeltproject.org/api/v1/gkg_geojson";
const TIMEOUT_MS = 20_000;
/** GKG devuelve hasta 45 000 filas; la capa dibuja 120 como mucho. */
const MAX_ROWS = 500;
const MAX_HOURS = 24;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_ENTRIES = 8;

export interface GkgQuery {
  theme: string;
  hours: number;
  maxrows: number;
}

type ParseResult = { ok: true; value: GkgQuery } | { ok: false; reason: string };

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Valida los parámetros. `theme` es un token del vocabulario de GDELT
 * (`ARMEDCONFLICT`, `PROTEST`, `TERROR`…): mayúsculas, números y guion bajo.
 * Cualquier otra cosa se corta antes de salir a la red.
 */
export function parseGdeltParams(raw: Record<string, unknown>): ParseResult {
  const theme = asText(raw.theme) || "ARMEDCONFLICT";
  if (!/^[A-Z][A-Z0-9_]{2,40}$/.test(theme)) {
    return { ok: false, reason: "`theme` debe ser un tema de GDELT en mayúsculas (ARMEDCONFLICT)" };
  }

  const hoursRaw = asText(raw.hours) || "12";
  if (!/^\d{1,2}$/.test(hoursRaw)) return { ok: false, reason: "`hours` debe ser un entero" };
  const hours = Number(hoursRaw);
  if (hours < 1 || hours > MAX_HOURS) {
    return { ok: false, reason: `\`hours\` debe estar entre 1 y ${MAX_HOURS}` };
  }

  const rowsRaw = asText(raw.maxrows) || "250";
  if (!/^\d{1,3}$/.test(rowsRaw)) return { ok: false, reason: "`maxrows` debe ser un entero" };
  const maxrows = Math.min(Number(rowsRaw), MAX_ROWS);
  if (maxrows < 1) return { ok: false, reason: "`maxrows` debe ser al menos 1" };

  return { ok: true, value: { theme, hours, maxrows } };
}

/** URL del GKG para una consulta ya validada. `TIMESPAN` va en minutos. */
export function gdeltUpstreamUrl(value: GkgQuery): string {
  const params = new URLSearchParams({
    QUERY: value.theme,
    TIMESPAN: String(value.hours * 60),
    MAXROWS: String(value.maxrows),
    // Sólo los campos que la ficha del globo usa: el feed completo pesa megas.
    // Ojo con el nombre: se pide `tone` y GKG lo devuelve como `urltone`
    // (comprobado contra el servidor; `tone` y `tonedecl` como campo de salida
    // no existen y se ignoran en silencio).
    OUTPUTFIELDS: "url,name,urlpubtimedate,domain,tone",
  });
  return `${GDELT_GKG}?${params.toString()}`;
}

interface CacheEntry {
  at: number;
  body: string;
}

/** Caché por isolate del cuerpo ya validado como JSON. */
const cache = new Map<string, CacheEntry>();

function readCache(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function writeCache(key: string, body: string): void {
  cache.set(key, { at: Date.now(), body });
  while (cache.size > CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

const fail = (res: VercelResponse, status: number, reason: string) => {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "no-store");
  res.send(JSON.stringify({ error: reason, timestamp: new Date().toISOString() }));
};

export default async function gdelt(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    return res.end();
  }
  if (req.method !== "GET") {
    res.setHeader("allow", "GET, OPTIONS");
    return fail(res, 405, "sólo GET");
  }

  const parsed = parseGdeltParams((req.query ?? {}) as Record<string, unknown>);
  if (parsed.ok === false) return fail(res, 400, parsed.reason);

  const upstream = gdeltUpstreamUrl(parsed.value);
  const cached = readCache(upstream);
  if (cached) {
    res.status(200);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("x-aitor-cache", "hit");
    res.setHeader("cache-control", "public, max-age=120, s-maxage=300");
    return res.send(cached);
  }

  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/geo+json, application/json", "user-agent": "aitor-intel/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 429) {
      res.setHeader("retry-after", "20");
      return fail(res, 429, "GDELT está limitando peticiones (una cada 5 s); reintenta en unos segundos");
    }
    if (!response.ok) return fail(res, 502, `GDELT respondió ${response.status}`);

    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      // GKG contesta en HTML cuando la consulta no le encaja.
      return fail(res, 502, "GDELT no devolvió JSON (¿tema inexistente?)");
    }

    const serialised = JSON.stringify(body);
    writeCache(upstream, serialised);
    res.status(200);
    // Se reetiqueta como JSON: GKG sirve `application/vnd.geo+json`, que algunos
    // intermediarios no reconocen, y el cliente sólo necesita un cuerpo JSON.
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("cache-control", "public, max-age=120, s-maxage=300");
    res.send(serialised);
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    fail(res, 502, `GDELT inaccesible: ${message}`);
  }
}
