import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface IonospherePoint {
  lat: number;
  lon: number;
  /** Contenido electrónico total, en TECU (1 TECU = 10^16 e⁻/m²). */
  tec: number;
}

export interface IonosphereMesh {
  /** Instante del mapa, tal como lo publica SWPC. */
  observationTime: string;
  points: IonospherePoint[];
  minTec: number;
  maxTec: number;
}

const BASE = "https://services.swpc.noaa.gov/products/glotec/geojson_2d_urt/";

/**
 * Nombre, cadencia y retardo reales de GLOTEC.
 *
 * Los ficheros se llaman con el minuto acabado en 5 (`…T151500Z`, `…T152500Z`),
 * no en 0: pedir el bloque «redondo» responde 404 siempre. Además SWPC va ~30
 * minutos por detrás —comprobado: los tres bloques más recientes no existen y el
 * cuarto sí—, así que se empieza tres bloques atrás y se retrocede. Un 404 pesa
 * unos cientos de bytes; descargar el índice completo (510 KB) para descubrir
 * cuál es el último costaría más que varios cientos de intentos fallidos.
 *
 * El fichero que sí existe ronda los 2,5 MB (5 184 puntos), de ahí que la capa
 * sólo se descargue cuando alguien la enciende.
 */
const CADENCE_MS = 10 * 60 * 1000;
/** Desfase del nombre de fichero: los mapas van a los minutos 5, 15, 25… */
const STAMP_OFFSET_MS = 5 * 60 * 1000;
const LAG_BLOCKS = 3;
const MAX_PROBES = 8;

const EMPTY: IonosphereMesh = { observationTime: "", points: [], minTec: 0, maxTec: 0 };

interface GlotecFeature {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: { tec?: number; quality_flag?: number };
}

interface GlotecCollection {
  features?: GlotecFeature[];
}

/**
 * Nombre del bloque de 10 minutos que corresponde a un instante. Expuesto para
 * poder probarlo: equivocarse aquí no rompe nada visible, simplemente hace que
 * la capa nunca encuentre su fichero (era el fallo original: se pedían los
 * minutos redondos y SWPC publica a los minutos 5, 15, 25…).
 */
export function stampFor(ms: number): string {
  const d = new Date(Math.floor((ms - STAMP_OFFSET_MS) / CADENCE_MS) * CADENCE_MS + STAMP_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

/**
 * Mapa global de TEC (ionosfera) del centro espacial de predicción de NOAA.
 *
 * El fichero son ~5 200 puntos con `tec`, `anomaly` y `hmF2`; se descartan los
 * marcados con `quality_flag` distinto de cero y se decima la malla, porque el
 * globo sólo puede pintar unos cientos de puntos por capa sin sacrificar el
 * resto de la escena.
 */
export function useIonosphere(enabled: boolean, maxPoints = 700, intervalMs = 600_000) {
  return usePolledConnector<IonosphereMesh>(
    async (signal) => {
      let lastError = "";
      for (let attempt = 0; attempt < MAX_PROBES; attempt++) {
        const ms = Date.now() - (LAG_BLOCKS + attempt) * CADENCE_MS;
        const url = `${BASE}glotec_icao_${stampFor(ms)}.geojson`;
        try {
          const json = await safeFetchJson<GlotecCollection>(url, { signal, timeoutMs: 15000 });
          const features = json.features ?? [];
          if (!features.length) throw new Error("mapa TEC vacío");

          const clean: IonospherePoint[] = [];
          for (const feature of features) {
            const coords = feature.geometry?.coordinates;
            const tec = feature.properties?.tec;
            if (!coords || !Number.isFinite(tec)) continue;
            if ((feature.properties?.quality_flag ?? 0) !== 0) continue;
            const [lon, lat] = coords;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            clean.push({ lat, lon, tec: tec as number });
          }
          if (!clean.length) throw new Error("mapa TEC sin puntos válidos");

          const stride = Math.max(1, Math.ceil(clean.length / maxPoints));
          const points = clean.filter((_, index) => index % stride === 0);
          const values = clean.map((p) => p.tec);

          return {
            observationTime: stampFor(ms),
            points,
            minTec: Math.min(...values),
            maxTec: Math.max(...values),
          };
        } catch (err) {
          lastError = err instanceof Error ? err.message : "error TEC";
          if (signal.aborted) throw err;
        }
      }
      throw new Error(lastError || "no hay mapa TEC disponible");
    },
    EMPTY,
    intervalMs,
    enabled,
  );
}
