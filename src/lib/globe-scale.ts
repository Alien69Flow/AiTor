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

/* ------------------------------------------------------------------------- *
 * Geometría real del planeta
 *
 * Hasta ahora la altura se traducía a etiquetas con umbrales elegidos a ojo
 * («15 000 km = disco terrestre»), y el ancho de vista se calculaba como si el
 * suelo fuera un plano infinito: a 20 000 km eso daba 23 760 km cuando la
 * superficie que se ve desde esa altura, medida por el horizonte, son 16 912.
 * La diferencia no es un detalle de formato: es un 40 % de error en el número
 * que el usuario usa para comparar dos vistas.
 *
 * Con una esfera de radio R y la cámara a la altura h:
 *  - el disco que ocupa la Tierra en pantalla tiene radio angular asin(R/(R+h));
 *  - la superficie visible llega hasta el horizonte, a un arco acos(R/(R+h))
 *    de distancia angular desde el nadir, el doble de lado a lado.
 * ------------------------------------------------------------------------- */

export const EARTH_RADIUS_M = 6_371_000;
/** Un grado de arco sobre la esfera, en metros (111,19 km). */
export const METRES_PER_DEGREE = (Math.PI * EARTH_RADIUS_M) / 180;

/** Radio angular del disco terrestre visto desde la cámara, en grados. */
export function earthDiscRadiusDeg(altitudeM: number): number {
  if (!Number.isFinite(altitudeM)) return 0;
  const ratio = EARTH_RADIUS_M / (EARTH_RADIUS_M + Math.max(0, altitudeM));
  return (Math.asin(Math.min(1, ratio)) * 180) / Math.PI;
}

/** Arco de superficie visible de lado a lado hasta el horizonte, en grados. */
export function horizonArcDeg(altitudeM: number): number {
  if (!Number.isFinite(altitudeM) || altitudeM <= 0) return 0;
  const ratio = EARTH_RADIUS_M / (EARTH_RADIUS_M + altitudeM);
  return (2 * Math.acos(Math.min(1, ratio)) * 180) / Math.PI;
}

/** Ese mismo arco en metros de superficie. */
export function horizonArcMetres(altitudeM: number): number {
  return horizonArcDeg(altitudeM) * METRES_PER_DEGREE;
}

/** Ángulo con la precisión que tiene sentido leer en una barra de escala. */
export function formatArc(degrees: number): string {
  if (!Number.isFinite(degrees) || degrees < 0) return "—";
  if (degrees === 0) return "0°";
  if (degrees < 1) return `${number(degrees * 100)}′`;
  if (degrees < 10) return `${number(degrees, 1)}°`;
  return `${number(degrees)}°`;
}

export interface ViewSpan {
  /** Metros de superficie que abarca la pantalla de lado a lado. */
  metres: number;
  /** Lo mismo en ángulo sobre la esfera. */
  degrees: number;
  /** `true` cuando el límite es el horizonte y no el campo de visión. */
  clippedByHorizon: boolean;
}

/**
 * Qué superficie abarca la vista de lado a lado.
 *
 * Es el mínimo entre lo que cubre el campo de visión sobre un suelo plano y el
 * arco que llega al horizonte: pasada cierta altura, alejar la cámara ya no
 * enseña más Tierra, sólo más cielo, y el número tiene que decirlo. Se usa la
 * medición real de píxeles cuando existe y la fórmula del campo de visión
 * cuando no.
 */
export function viewSpan(input: {
  altitudeM: number;
  metresPerPixel?: number;
  viewportWidthPx?: number;
  fovYRad?: number;
  aspect?: number;
}): ViewSpan {
  const { altitudeM, metresPerPixel, viewportWidthPx } = input;
  const fovYRad = Number.isFinite(input.fovYRad) && (input.fovYRad as number) > 0 ? (input.fovYRad as number) : Math.PI / 3;
  const aspect = Number.isFinite(input.aspect) && (input.aspect as number) > 0 ? (input.aspect as number) : 16 / 9;

  const horizon = horizonArcMetres(altitudeM);
  const measured =
    Number.isFinite(metresPerPixel) && Number.isFinite(viewportWidthPx) && (metresPerPixel as number) > 0
      ? (metresPerPixel as number) * (viewportWidthPx as number)
      : 0;
  const flat = measured > 0 ? measured : groundWidthFromFov(altitudeM, fovYRad, aspect);

  const metres = horizon > 0 ? Math.min(flat || horizon, horizon) : flat;
  return {
    metres,
    degrees: metres / METRES_PER_DEGREE,
    clippedByHorizon: horizon > 0 && (flat === 0 || flat > horizon),
  };
}

/**
 * Qué se está mirando a esta altura: la etiqueta que acompaña a la escala.
 *
 * «Globo entero» no es una altura fija: depende del campo de visión de la
 * cámara. El disco terrestre cabe en pantalla cuando su diámetro angular
 * (2·asin(R/(R+h))) no pasa del menor de los dos campos de visión; por eso se
 * calcula en vez de tabularse.
 */
export function describeView(altitudeM: number, view: { fovYRad?: number; aspect?: number } = {}): string {
  if (!Number.isFinite(altitudeM)) return "Sin datos";

  const fovYRad = Number.isFinite(view.fovYRad) && (view.fovYRad as number) > 0 ? (view.fovYRad as number) : Math.PI / 3;
  const aspect = Number.isFinite(view.aspect) && (view.aspect as number) > 0 ? (view.aspect as number) : 16 / 9;
  const fovXRad = 2 * Math.atan(Math.tan(fovYRad / 2) * aspect);
  const tightestRad = Math.min(fovYRad, fovXRad);
  const discDeg = 2 * earthDiscRadiusDeg(altitudeM);
  if ((discDeg * Math.PI) / 180 <= tightestRad) return "Globo entero";

  const spanKm = viewSpan({ altitudeM, fovYRad, aspect }).metres / 1_000;
  if (spanKm < 5) return "Distrito";
  if (spanKm < 60) return "Ciudad";
  if (spanKm < 600) return "Región";
  if (spanKm < 4_000) return "Continente";
  return "Hemisferio";
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
