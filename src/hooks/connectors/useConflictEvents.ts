import { safeFetchJson, usePolledConnector } from "@/lib/connectors";
import { conflictProxyUrl, mapGkgConflictGeoJson, type ConflictEvent } from "@/lib/conflict-events";

/**
 * Conflictos de las últimas 48 h, geolocalizados por GDELT.
 *
 * La petición va a `/api/gdelt`: el `format=geojson` que se pedía a DOC 2.0 no
 * existe —contestaba 200 en HTML— y la API GEO 2.0 que sí devolvía GeoJSON está
 * en 404. El proxy pide el GKG v1, que sigue vivo y sí trae coordenadas, y
 * cachea cinco minutos: más de lo que hace falta con un sondeo de diez.
 *
 * Diez minutos de intervalo, como el feed OSINT: es la granularidad real del
 * índice de noticias y evita castigar una API que limita a una petición cada
 * cinco segundos. Si GDELT no devuelve ningún suceso de violencia, el conector
 * falla en vez de inventar puntos, y la capa queda como estaba (sólo las zonas
 * curadas).
 */
export function useConflictEvents(enabled: boolean, intervalMs = 600_000) {
  return usePolledConnector<ConflictEvent[]>(
    async (signal) => {
      const json = await safeFetchJson<unknown>(conflictProxyUrl(), { signal, timeoutMs: 20_000 });
      const events = mapGkgConflictGeoJson(json);
      if (!events.length) throw new Error("GDELT no devolvió cobertura de conflicto");
      return events;
    },
    [],
    intervalMs,
    enabled,
  );
}
