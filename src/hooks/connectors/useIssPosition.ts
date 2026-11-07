import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface IssPosition {
  lat: number;
  lon: number;
  /** Altitud sobre el elipsoide, en km. */
  altKm: number;
  /** Velocidad orbital en km/h. */
  speedKmh: number;
  /** `daylight`, `eclipsed` o `unknown`, tal como lo publica la fuente. */
  visibility: string;
  /** Instante de la medida, en segundos UNIX. */
  measuredAt: number;
}

const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";

interface IssApiResponse {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  timestamp: number;
}

const EMPTY: IssPosition = {
  lat: NaN,
  lon: NaN,
  altKm: 0,
  speedKmh: 0,
  visibility: "unknown",
  measuredAt: 0,
};

/**
 * Posición de la Estación Espacial Internacional.
 *
 * WhereTheISS.at propaga los elementos orbitales oficiales (NORAD 25544) y
 * responde sin clave con `Access-Control-Allow-Origin: *`, así que el globo
 * puede pedirla directamente. Una vuelta dura ~92 min, por lo que un sondeo
 * cada 10 s sitúa la estación con un error de unos pocos kilómetros: suficiente
 * para verla pasar, y muy por debajo de lo que pide la capa.
 *
 * Devuelve `lat`/`lon` no finitos mientras no haya medida, para que el globo no
 * dibuje la estación en (0, 0) si la fuente falla.
 */
export function useIssPosition(enabled: boolean, intervalMs = 10_000) {
  return usePolledConnector<IssPosition>(
    async (signal) => {
      const json = await safeFetchJson<IssApiResponse>(ISS_URL, { signal, timeoutMs: 9000 });
      if (!Number.isFinite(json.latitude) || !Number.isFinite(json.longitude)) {
        throw new Error("respuesta sin posición");
      }
      return {
        lat: json.latitude,
        lon: json.longitude,
        altKm: Number.isFinite(json.altitude) ? json.altitude : 0,
        speedKmh: Number.isFinite(json.velocity) ? json.velocity : 0,
        visibility: json.visibility ?? "unknown",
        measuredAt: json.timestamp ?? Math.floor(Date.now() / 1000),
      };
    },
    EMPTY,
    intervalMs,
    enabled,
  );
}
