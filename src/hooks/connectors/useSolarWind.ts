import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

/**
 * Heliosfera: la burbuja que infla el viento solar y que envuelve todo el
 * Sistema Solar. Lo que se puede medir en vivo es lo que la infla —el viento
 * solar en el punto L1, a 1,5 millones de km de la Tierra—, y eso es lo que
 * trae este conector, de tres ficheros pequeños de NOAA SWPC:
 *
 *  - velocidad del viento solar (km/s)
 *  - campo magnético interplanetario total y su componente Bz, la que decide si
 *    el viento entra o rebota en la magnetosfera
 *  - flujo solar de 10,7 cm, el motor térmico que empuja ese viento
 *
 * La frontera de la burbuja (heliopausa) está a ~120 UA y no se sondea en
 * vivo: sólo la han cruzado las Voyager. Se declara como constante documentada,
 * no como medida, y la capa lo escribe así.
 */

export interface SolarWind {
  /** Instante de la medida, tal como lo publica SWPC. */
  measuredAt: string;
  /** Velocidad del viento solar, en km/s. */
  speedKms: number;
  /** Campo magnético interplanetario total, en nT. */
  bt: number;
  /** Componente Bz en GSM, en nT: negativa = acoplamiento con la magnetosfera. */
  bzGsm: number;
  /** Flujo solar de 10,7 cm, en sfu. */
  f107: number;
}

/**
 * Distancia a la heliopausa. Frontera del dominio del viento solar, cruzada por
 * Voyager 1 en 2012 (121,6 UA) y Voyager 2 en 2018 (119 UA). Se usa como dato
 * histórico, no como telemetría.
 */
export const HELIOPAUSE_AU = 120;

/** A partir de aquí el viento solar es rápido y la magnetosfera trabaja más. */
export const FAST_WIND_KMS = 500;

const SPEED_URL = "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";
const MAG_URL = "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json";
const F107_URL = "https://services.swpc.noaa.gov/products/summary/10cm-flux.json";

interface SpeedRow {
  proton_speed: number;
  time_tag: string;
}

interface MagRow {
  bt: number;
  bz_gsm: number;
  time_tag: string;
}

interface F107Row {
  flux: number;
  time_tag: string;
}

const EMPTY: SolarWind = { measuredAt: "", speedKms: 0, bt: 0, bzGsm: 0, f107: 0 };

/** Los tres resúmenes son de un solo elemento: se lee la última fila. */
function lastRow<T>(rows: unknown): T | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  const last = rows[rows.length - 1];
  return last && typeof last === "object" ? (last as T) : null;
}

export function useSolarWind(enabled: boolean, intervalMs = 300_000) {
  return usePolledConnector<SolarWind>(
    async (signal) => {
      const [speedRows, magRows, f107Rows] = await Promise.all([
        safeFetchJson<SpeedRow[]>(SPEED_URL, { signal, timeoutMs: 9000 }),
        safeFetchJson<MagRow[]>(MAG_URL, { signal, timeoutMs: 9000 }),
        safeFetchJson<F107Row[]>(F107_URL, { signal, timeoutMs: 9000 }),
      ]);

      const speed = lastRow<SpeedRow>(speedRows);
      const mag = lastRow<MagRow>(magRows);
      const f107 = lastRow<F107Row>(f107Rows);

      // Sin velocidad no hay heliosfera que dibujar: es la medida que la define.
      if (!speed || !Number.isFinite(speed.proton_speed)) {
        throw new Error("SWPC no publica velocidad del viento solar");
      }

      return {
        measuredAt: speed.time_tag ?? "",
        speedKms: speed.proton_speed,
        bt: Number.isFinite(mag?.bt) ? (mag!.bt as number) : 0,
        bzGsm: Number.isFinite(mag?.bz_gsm) ? (mag!.bz_gsm as number) : 0,
        f107: Number.isFinite(f107?.flux) ? (f107!.flux as number) : 0,
      };
    },
    EMPTY,
    intervalMs,
    enabled,
  );
}
