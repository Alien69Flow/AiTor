import type { EnvLayerKey } from "./globe-layers";

/**
 * Cuándo el globo enciende la aurora por su cuenta.
 *
 * NOAA declara tormenta geomagnética a partir de Kp 5 (G1). Por debajo de eso
 * el óvalo auroral existe, pero es actividad normal: encenderlo solo dejaría el
 * globo con dos capas más puestas sin que haya pasado nada. El umbral es el
 * mismo que usa la escala G y por eso vale para los dos sitios que lo miran
 * —la barra de alertas y el globo— sin que acaben discrepando.
 *
 * La liberación va con histéresis: si se apagara en cuanto el Kp baja de 5, una
 * serie que oscila entre 4,7 y 5,3 encendería y apagaría la capa cada diez
 * minutos. Se suelta cuando el Kp cae por debajo de 4.
 */
export const AURORA_STORM_KP = 5;
export const AURORA_CALM_KP = 4;

/**
 * Las dos capas que dibujan la aurora: `magnetosphere` pinta la malla de
 * OVATION (el óvalo real, en ambos polos) y `solarActivity` añade los anillos
 * pulsantes y la lectura del Kp. Encender solo una deja media aurora.
 */
export const AURORA_LAYERS: readonly EnvLayerKey[] = ["magnetosphere", "solarActivity"];

/** ¿Hay tormenta geomagnética según el Kp? */
export function isGeomagneticStorm(kpIndex: number): boolean {
  return Number.isFinite(kpIndex) && kpIndex >= AURORA_STORM_KP;
}

/**
 * ¿Se puede soltar ya la aurora automática?
 *
 * Un Kp que no llega (NaN, `undefined` convertido a 0) cuenta como calma: es
 * preferible apagar de más que dejar la capa encendida porque el conector cayó.
 */
export function hasStormPassed(kpIndex: number): boolean {
  return !Number.isFinite(kpIndex) || kpIndex < AURORA_CALM_KP;
}

/**
 * Escala G de la tormenta a partir del Kp (5 → G1 … 9 → G5).
 * `null` cuando todavía no es tormenta.
 */
export function kpToStormScale(kpIndex: number): "G1" | "G2" | "G3" | "G4" | "G5" | null {
  if (!isGeomagneticStorm(kpIndex)) return null;
  const step = Math.min(5, Math.max(1, Math.floor(kpIndex) - 4));
  return `G${step}` as "G1" | "G2" | "G3" | "G4" | "G5";
}

/**
 * Qué capas hay que apagar cuando termina la tormenta: sólo las que encendió
 * el aviso, nunca las que el usuario ya tenía puestas por su cuenta.
 */
export function auroraLayersToRelease(previous: Iterable<EnvLayerKey>): EnvLayerKey[] {
  const already = new Set(previous);
  return AURORA_LAYERS.filter((key) => !already.has(key));
}
