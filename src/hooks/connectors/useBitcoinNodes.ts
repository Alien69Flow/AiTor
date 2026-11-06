import BBOXES from "@/integrations/worldmonitor/shared/country-bboxes.json";
import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

/**
 * Nodos Bitcoin alcanzables, agregados por país.
 *
 * Un punto por país con su recuento, no la posición de cada nodo: ni la fuente
 * publica coordenadas de nodo, ni tiene sentido dibujar dieciocho mil billboards
 * para decir «hay nodos en Alemania». El centro de la caja geográfica del país
 * ya se usa para los apagones de Internet, así que el globo no inventa
 * geometría nueva.
 */
export interface BitcoinNode {
  /** Código de país; también sirve de id del marcador. */
  id: string;
  lat: number;
  lon: number;
  country: string;
  /** Nodos alcanzables en ese país. */
  count: number;
}

interface BitcoinNodesPayload {
  total?: number;
  countries?: { code: string; count: number }[];
  unavailable?: boolean;
  reason?: string | null;
}

/** Centro de la caja `[minLat, minLon, maxLat, maxLon]` del país. */
export function countryCentroid(code: string): [number, number] | null {
  const box = (BBOXES as Record<string, number[]>)[code];
  if (!box || box.length !== 4) return null;
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

export function useBitcoinNodes(enabled: boolean, intervalMs = 900_000) {
  return usePolledConnector<BitcoinNode[]>(
    async (signal) => {
      const json = await safeFetchJson<BitcoinNodesPayload>("/api/bitnodes", {
        signal,
        timeoutMs: 20_000,
      });

      const nodes: BitcoinNode[] = [];
      for (const entry of json.countries ?? []) {
        const centre = countryCentroid(entry.code);
        if (!centre || !Number.isFinite(entry.count) || entry.count <= 0) continue;
        nodes.push({
          id: entry.code,
          lat: centre[0],
          lon: centre[1],
          country: entry.code,
          count: entry.count,
        });
      }

      if (!nodes.length) throw new Error(json.reason || "sin países con nodos");
      return nodes;
    },
    [],
    intervalMs,
    enabled,
  );
}
