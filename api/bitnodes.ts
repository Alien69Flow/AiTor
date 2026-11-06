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
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const maxDuration = 25;

const SOURCE_URL = "https://api.blockchair.com/bitcoin/nodes?limit=20000";
const TIMEOUT_MS = 18_000;

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

function send(res: VercelResponse, body: BitcoinNodesPayload, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  // Los nodos cambian despacio; no hay razón para pedirlo por visitante.
  res.setHeader("cache-control", "public, max-age=600, s-maxage=1800");
  res.send(JSON.stringify(body));
}

export default async function bitnodes(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    return res.end();
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "user-agent": "aitor-intel/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return send(res, {
        total: 0,
        countries: [],
        unavailable: true,
        reason: `Blockchair respondió ${response.status}`,
        timestamp: new Date().toISOString(),
      });
    }

    const { total, countries } = countByCountry(await response.json());
    send(res, {
      total,
      countries,
      unavailable: countries.length === 0,
      reason: countries.length === 0 ? "la fuente no trajo países" : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream fetch failed";
    send(res, {
      total: 0,
      countries: [],
      unavailable: true,
      reason: `Blockchair inaccesible: ${message}`,
      timestamp: new Date().toISOString(),
    });
  }
}
