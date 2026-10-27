import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

/**
 * Cinturones de Van Allen, medidos por la flota GOES de NOAA.
 *
 * El satélite GOES está en la órbita geoestacionaria (6,6 radios terrestres),
 * es decir **dentro** del cinturón exterior, y publica cada cinco minutos el
 * flujo integral de electrones de energía >2 MeV. Ese número es la intensidad
 * del cinturón exterior: por debajo de 10³ electrones·cm⁻²·s⁻¹·sr⁻¹ está
 * tranquilo, por encima hay riesgo de carga electrostática en satélites.
 *
 * El cinturón interior (protones) queda declarado en el catálogo con su
 * geometría, pero sin intensidad: ninguna fuente abierta de este proyecto lo
 * mide con esta cadencia, y colorearlo con el dato de electrones sería mezclar
 * dos cinturones distintos.
 */

export type BeltLevel = "quiet" | "elevated" | "high" | "extreme";

export interface VanAllenBelts {
  /** Instante de la medida, tal como lo publica SWPC. */
  measuredAt: string;
  /** Satélite GOES que la ha hecho. */
  satellite: number;
  /** Flujo integral de electrones >2 MeV, e⁻·cm⁻²·s⁻¹·sr⁻¹ (promedio de la flota). */
  electronFlux: number;
  /** Umbrales NOAA aplicados a ese flujo. */
  level: BeltLevel;
  /** Satélites que han aportado medida en ese instante. */
  satellites: number;
}

const ELECTRONS_URL = "https://services.swpc.noaa.gov/json/goes/primary/integral-electrons-1-day.json";
const ENERGY = ">=2 MeV";

interface GoesElectronRow {
  time_tag: string;
  satellite: number;
  flux: number;
  energy: string;
}

const EMPTY: VanAllenBelts = {
  measuredAt: "",
  satellite: 0,
  electronFlux: 0,
  level: "quiet",
  satellites: 0,
};

/**
 * Umbrales de NOAA para electrones >2 MeV. Se exponen para poder probarlos:
 * son la diferencia entre «la capa pinta algo» y «la capa dice si hay riesgo».
 */
export function beltLevel(flux: number): BeltLevel {
  if (!Number.isFinite(flux) || flux < 1_000) return "quiet";
  if (flux < 10_000) return "elevated";
  if (flux < 100_000) return "high";
  return "extreme";
}

/**
 * Última medida disponible: el fichero es una lista de filas por satélite y por
 * energía, así que se busca el instante más reciente y se promedian los
 * satélites que hayan medido en él (hoy son dos, y pueden discrepar).
 */
export function latestElectronFlux(rows: GoesElectronRow[]): VanAllenBelts | null {
  const valid = rows.filter(
    (row) =>
      row.energy === ENERGY &&
      Number.isFinite(row.flux) &&
      typeof row.time_tag === "string" &&
      Number.isFinite(row.satellite),
  );
  if (!valid.length) return null;

  const latest = valid.reduce((max, row) => (row.time_tag > max ? row.time_tag : max), valid[0].time_tag);
  const atLatest = valid.filter((row) => row.time_tag === latest);
  const flux = atLatest.reduce((sum, row) => sum + row.flux, 0) / atLatest.length;

  return {
    measuredAt: latest,
    satellite: Math.max(...atLatest.map((row) => row.satellite)),
    electronFlux: flux,
    level: beltLevel(flux),
    satellites: atLatest.length,
  };
}

export function useVanAllenBelts(enabled: boolean, intervalMs = 300_000) {
  return usePolledConnector<VanAllenBelts>(
    async (signal) => {
      const rows = await safeFetchJson<GoesElectronRow[]>(ELECTRONS_URL, { signal, timeoutMs: 12000 });
      const latest = latestElectronFlux(Array.isArray(rows) ? rows : []);
      if (!latest) throw new Error("GOES no publica electrones >2 MeV");
      return latest;
    },
    EMPTY,
    intervalMs,
    enabled,
  );
}
