/**
 * `GET /api/bitnodes` — nodos Bitcoin alcanzables agrupados por país.
 *
 * Historia del fallo: la capa pedía `bitnodes.io/api/v1/snapshots/latest/`
 * desde el navegador y fallaba por dos motivos a la vez. El primero, visible en
 * consola, es que esa API no manda `Access-Control-Allow-Origin`. El segundo es
 * peor: el snapshot ya **no publica geolocalización** —cada fila trae cinco
 * campos, `[ver, ua, ts, services, height]`, sin ciudad ni lat/lon—, así que
 * ninguna versión del cliente podía colocar un nodo en el mapa aunque el CORS
 * se arreglara.
 *
 * Por eso aquí no se reenvía el snapshot. Se pide a Blockchair, que sí publica
 * el país de cada nodo, y se agrega el recuento por país. El cliente convierte
 * cada código en un punto con el centro de su caja geográfica, que ya tiene para
 * las capas de apagones. Blockchair sirve una muestra de la red (unos cientos
 * de nodos, decenas de países): basta para decir dónde hay nodos y cuántos, y
 * la tarjeta del globo no lo presenta como censo completo.
 *
 * Se dice en el globo lo que es: un punto por país con su recuento, no la
 * posición exacta de cada nodo. Inventar una coordenada por nodo sería mentir
 * con más píxeles.
 *
 * Desde la Fase 1 el resultado se cachea 15 min: Blockchair limita por IP y el
 * recuento no cambia de un minuto a otro.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_shared/cors.js";
import { sendError, sendJson } from "./_shared/http.js";
import { checkRateLimit } from "./_shared/rate-limit.js";
import { cachedFetchJson } from "./_shared/redis.js";

export const maxDuration = 25;

const SOURCE_URL = "https://api.blockchair.com/bitcoin/nodes?limit=20000";
const TIMEOUT_MS = 18_000;
const CACHE_TTL_SECONDS = 900;
/** Un fallo se recuerda un minuto: suficiente para dejar de martillear. */
const NEGATIVE_TTL_SECONDS = 60;

export interface BitcoinCountryCount {
  /** Código ISO-3166 alfa-2. */
  code: string;
  count: number;
}

export interface BitcoinNodesPayload {
  total: number;
  countries: BitcoinCountryCount[];
  unavailable: boolean;
  reason: string | null;
  timestamp: string;
}

/**
 * Recuento por país a partir de `data.nodes`, que viene como
 * `dirección -> { version, country, height, flags }`.
 *
 * Puro y exportado para poder probarlo: los nodos sin país se cuentan en el
 * total pero no generan marcador, y un país sin coordenadas conocidas se
 * descarta en el cliente, no aquí.
 */
export function countByCountry(snapshot: unknown): {
  total: number;
  countries: BitcoinCountryCount[];
} {
  const nodes = (snapshot as { data?: { nodes?: Record<string, { country?: unknown }> } } | null)?.data
    ?.nodes;
  if (!nodes || typeof nodes !== "object") return { total: 0, countries: [] };

  const counts = new Map<string, number>();
  let total = 0;
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== "object") continue;
    total += 1;
    const raw = node.country;
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const countries = [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  return { total, countries };
}

/**
 * Descarga y agrega. Lanza si la fuente falla o no trae países, para que
 * `cachedFetchJson` active la caché negativa en vez de guardar un vacío 15 min.
 */
async function fetchNodes(): Promise<BitcoinNodesPayload> {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "aitor-intel/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Blockchair respondió ${response.status}`);

  const { total, countries } = countByCountry(await response.json());
  if (countries.length === 0) throw new Error("Blockchair no trajo países");

  return {
    total,
    countries,
    unavailable: false,
    reason: null,
    timestamp: new Date().toISOString(),
  };
}

export default async function bitnodes(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res, { publicRead: true })) return;

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendError(
      res,
      405,
      { error: "sólo GET", code: "method_not_allowed" },
      { Allow: "GET, HEAD, OPTIONS" },
    );
  }

  if (!(await checkRateLimit(req, res, { name: "bitnodes", limit: 60, windowSec: 60 }))) return;

  try {
    const payload = await cachedFetchJson<BitcoinNodesPayload>(
      "bitcoin:bitnodes:v1",
      CACHE_TTL_SECONDS,
      fetchNodes,
      { negativeTtlSeconds: NEGATIVE_TTL_SECONDS },
    );

    if (payload == null) {
      // Se mantiene el contrato de la ruta: 200 con `unavailable: true` y lista
      // vacía, nunca datos inventados. El cliente ya lo pinta así.
      return sendJson(
        req,
        res,
        200,
        {
          total: 0,
          countries: [],
          unavailable: true,
          reason: "Blockchair no respondió (reintentando en un minuto)",
          timestamp: new Date().toISOString(),
        },
        { cache: "realtime" },
      );
    }

    sendJson(req, res, 200, payload, { cache: "slow" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream fetch failed";
    console.error("[bitnodes] fallo:", message);
    sendError(res, 502, { error: `Blockchair inaccesible: ${message}`, code: "bitnodes_error" });
  }
}
