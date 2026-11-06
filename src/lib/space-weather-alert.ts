/**
 * Texto y gravedad de la alerta de clima espacial de la barra LIVE ALERTS.
 *
 * NOAA publica tres escalas independientes y cada una significa una cosa:
 *
 *   R — Radio blackout (apagones de radio HF)
 *   S — Solar radiation storm (radiación solar)
 *   G — Geomagnetic storm (tormenta geomagnética)
 *
 * La barra repetía «SOLAR RADIATION DETECTED» para cualquiera de las tres, así
 * que una tormenta geomagnética G2 aparecía como radiación solar y, de paso,
 * imprimía «Radio: none | Storm: none» al lado: un titular alarmante con dos
 * «none» debajo. Aquí la alerta dice sólo lo que está pasando, con su escala, y
 * la gravedad sale de la escala más alta (G3/R3/S3 o superior es CRITICAL).
 *
 * Puro a propósito: se prueba sin red ni React.
 */

/** Lo mínimo que necesita la barra; encaja con `SpaceWeather`. */
export interface SpaceWeatherScales {
  kpIndex: number;
  /** Escala S, como `"S1"` o `"none"`. */
  stormLevel: string;
  /** Escala R, como `"R2"` o `"none"`. */
  radioBlackout: string;
  /** Escala G, como `"G2"` o `"none"`. */
  geomagneticStorm: string;
}

export type AlertSeverity = "CRITICAL" | "HIGH" | "LOW";

export interface SpaceWeatherAlert {
  text: string;
  severity: AlertSeverity;
}

const NAMES: Record<"R" | "S" | "G", string> = {
  R: "RADIO BLACKOUT",
  S: "SOLAR RADIATION STORM",
  G: "GEOMAGNETIC STORM",
};

/**
 * Nivel numérico de una escala. Acepta `"G2"`, `"2"` y `"none"`/vacío/null,
 * porque NOAA devuelve `Scale: null` cuando esa escala no aplica.
 */
export function scaleLevel(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== "string") return 0;
  const match = /(\d+)/.exec(value.trim());
  if (!match) return 0;
  return Number(match[1]);
}

/**
 * Devuelve `null` si no hay ninguna escala activa: sin tormenta no hay alerta,
 * y la barra no debe inventarse una.
 */
/**
 * Equivalencia Kp → escala G: Kp 5 = G1, 6 = G2 … 9 = G5.
 *
 * Hace falta porque la escala G resumen de NOAA va con retraso: hay momentos
 * con `G0` publicado y un Kp 6 real, y con sólo la escala la barra se quedaba
 * muda justo cuando había tormenta.
 */
export function kpToGeomagneticLevel(kp: number): number {
  if (!Number.isFinite(kp) || kp < 5) return 0;
  return Math.min(5, Math.floor(kp) - 4);
}

export function spaceWeatherAlert(weather: SpaceWeatherScales): SpaceWeatherAlert | null {
  const kp = Number.isFinite(weather.kpIndex) ? weather.kpIndex : 0;
  const levels = {
    R: scaleLevel(weather.radioBlackout),
    S: scaleLevel(weather.stormLevel),
    G: Math.max(scaleLevel(weather.geomagneticStorm), kpToGeomagneticLevel(kp)),
  } as const;

  // De mayor a menor impacto percibido: primero lo geomagnético, luego radiación
  // y radio, que es el orden en que interesa leerlo.
  const active = (["G", "S", "R"] as const)
    .filter((key) => levels[key] >= 1)
    .map((key) => `${NAMES[key]} ${key}${levels[key]}`);

  if (active.length === 0) return null;

  // Kp sólo se añade cuando aporta (5 = tormenta). Redondear a un decimal evita
  // el «Kp 6.000000000001» de las medias.
  const withKp = kp >= 5 ? `${active.join(" · ")} — Kp ${kp.toFixed(1)}` : active.join(" · ");

  const worst = Math.max(levels.R, levels.S, levels.G);
  return { text: withKp, severity: worst >= 3 ? "CRITICAL" : "HIGH" };
}
