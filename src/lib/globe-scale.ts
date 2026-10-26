/**
 * Escala del globo: de metros a kilómetros con números que se pueden leer.
 *
 * La barra de escala se calcula con la distancia real sobre el elipsoide en el
 * centro de la pantalla (`metros por píxel`), no con una regla fija: al acercar
 * la cámara la barra cambia de magnitud (1 000 km → 500 km → 100 km → 10 km → 1 km),
 * que es lo que permite comparar dos vistas y saber cuánto se ha ampliado.
 *
 * Este módulo es puro para poder probarlo sin Cesium.
 */

import { COSMIC_TRIGGER_ALTITUDE_M } from "./cosmic-scale";

/** Altura mínima de cámara: por debajo no hay terreno ni imagen que mirar. */
export const ZOOM_MIN_ALTITUDE_M = 250;
/** Altura máxima: a partir de aquí la vista pasa al zoom cósmico. */
export const ZOOM_MAX_ALTITUDE_M = Math.round(COSMIC_TRIGGER_ALTITUDE_M * 1.05);

const ES = "es-ES";

function number(value: number, digits = 0): string {
  return value.toLocaleString(ES, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Distancia legible. Los umbrales son de metros a km (10^6 m = 1 000 km) y de
 * ahí a millones de km (10^9 m = 1 000 000 km): etiquetar 20 000 km como
 * «20 millones de km» era un factor mil de error.
 */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return "—";
  if (metres < 1) return `${number(metres * 100)} cm`;
  if (metres < 10) return `${number(metres, 1)} m`;
  if (metres < 1_000) return `${number(metres)} m`;
  if (metres < 10_000) {
    const km = metres / 1_000;
    // «1,0 km» en una barra de escala canta; los enteros van sin decimales.
    return `${number(km, Number.isInteger(km) ? 0 : 1)} km`;
  }
  if (metres < 1_000_000_000) return `${number(metres / 1_000)} km`;
  if (metres < 1_000_000_000_000) return `${number(metres / 1_000_000_000, 2)} millones de km`;
  return `${number(metres / 1_000_000_000_000, 2)} mil millones de km`;
}

/** Altura de cámara: misma escala, pero el suelo es «0 m», no «0 cm». */
export function formatAltitude(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return "0 m";
  if (metres < 1) return `${number(metres * 100)} cm`;
  return formatDistance(metres);
}

export interface ScaleBar {
  /** Longitud de la barra en píxeles de CSS. */
  pixels: number;
  /** Distancia real que representa. */
  metres: number;
  label: string;
}

const BAR_STEPS = [1, 2, 5];

/**
 * Barra de escala clásica: la mayor distancia «redonda» (1, 2 o 5 × 10^n) que
 * cabe en `maxPixels`. Devuelve `null` si la escala no es utilizable.
 */
export function scaleBar(metresPerPixel: number, maxPixels: number): ScaleBar | null {
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) return null;
  if (!Number.isFinite(maxPixels) || maxPixels <= 8) return null;

  const maxMetres = metresPerPixel * maxPixels;
  const exponent = Math.floor(Math.log10(maxMetres));
  let chosen = 0;
  for (let e = exponent; e >= exponent - 2 && !chosen; e -= 1) {
    for (const step of [...BAR_STEPS].reverse()) {
      const candidate = step * 10 ** e;
      if (candidate <= maxMetres) {
        chosen = candidate;
        break;
      }
    }
  }
  if (!chosen) return null;

  const pixels = Math.round(chosen / metresPerPixel);
  if (pixels < 12) return null;
  return { pixels: Math.min(pixels, Math.round(maxPixels)), metres: chosen, label: formatDistance(chosen) };
}

/** Ancho aproximado de la vista cuando no hay globo bajo el cursor. */
export function groundWidthFromFov(altitudeM: number, fovYRad: number, aspect: number): number {
  if (!Number.isFinite(altitudeM) || altitudeM <= 0) return 0;
  const fovX = 2 * Math.atan(Math.tan(fovYRad / 2) * (Number.isFinite(aspect) && aspect > 0 ? aspect : 1));
  return 2 * altitudeM * Math.tan(fovX / 2);
}

/** Qué se está mirando a esta altura: la etiqueta que acompaña a la escala. */
export function describeView(altitudeM: number): string {
  if (!Number.isFinite(altitudeM)) return "Sin datos";
  if (altitudeM < 2_000) return "Distrito";
  if (altitudeM < 25_000) return "Ciudad";
  if (altitudeM < 250_000) return "Región";
  if (altitudeM < 3_000_000) return "Continente";
  if (altitudeM < 15_000_000) return "Hemisferio";
  return "Disco terrestre";
}

/** Cada pulsación de los botones deja la cámara al 60 % de la altura (o la
 *  multiplica por 1/0,6 al alejar): pasos regulares en todo el rango. */
export const ZOOM_STEP_RATIO = 0.6;

export type ZoomDirection = "in" | "out";

/**
 * Altura de cámara que deja un paso de zoom, acotada al rango real del globo
 * (250 m … 63 000 km). Devuelve `null` en los topes, para poder desactivar el
 * botón en vez de fingir que hace algo.
 */
export function nextZoomAltitude(currentM: number, direction: ZoomDirection): number | null {
  if (!Number.isFinite(currentM) || currentM <= 0) return null;
  const target = direction === "in" ? currentM * ZOOM_STEP_RATIO : currentM / ZOOM_STEP_RATIO;
  const clamped = Math.min(Math.max(target, ZOOM_MIN_ALTITUDE_M), ZOOM_MAX_ALTITUDE_M);
  return Math.abs(clamped - currentM) < 1 ? null : clamped;
}

/** Rango completo del zoom en una línea: «250 m – 63.000 km». */
export function zoomRangeLabel(): string {
  return `${formatAltitude(ZOOM_MIN_ALTITUDE_M)} – ${formatAltitude(ZOOM_MAX_ALTITUDE_M)}`;
}

/** Porcentaje de acercamiento disponible, para la pista de zoom. */
export function zoomProgress(altitudeM: number): number {
  const clamped = Math.min(Math.max(altitudeM, ZOOM_MIN_ALTITUDE_M), ZOOM_MAX_ALTITUDE_M);
  const span = Math.log10(ZOOM_MAX_ALTITUDE_M) - Math.log10(ZOOM_MIN_ALTITUDE_M);
  return 1 - (Math.log10(clamped) - Math.log10(ZOOM_MIN_ALTITUDE_M)) / span;
}
