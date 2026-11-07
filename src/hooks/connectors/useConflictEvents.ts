import { safeFetchJson, usePolledConnector } from "@/lib/connectors";
import { conflictDocUrl, mapConflictGeoJson, type ConflictEvent } from "@/lib/conflict-events";

/**
 * Conflictos de las últimas 48 h, geolocalizados por GDELT.
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
      const json = await safeFetchJson<unknown>(conflictDocUrl(), { signal, timeoutMs: 12_000 });
      const events = mapConflictGeoJson(json);
      if (!events.length) throw new Error("GDELT no devolvió sucesos de conflicto");
      return events;
    },
    [],
    intervalMs,
    enabled,
  );
}
