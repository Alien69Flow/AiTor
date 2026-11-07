/**
 * Nivel de tesela que pide la cámara y nivel máximo que ofrece la fuente.
 *
 * Cuando se acerca la cámara más allá del último nivel que publica una capa
 * (GIBS sirve `GoogleMapsCompatible_LevelN`, OpenWeather hasta z10), Cesium no
 * se queda en negro: reutiliza la tesela del último nivel y la **estira**. Lo
 * que se ve sigue siendo real, pero interpolado, y no hay forma de saberlo
 * mirando el globo. Este módulo calcula esa comparación para que el panel de
 * capas pueda decirlo con un número.
 *
 * Puro a propósito: se prueba sin Cesium ni navegador.
 */

/** Metros por píxel del nivel 0 en el ecuador (circunferencia / 256 px). */
const MPP_AT_ZOOM_0 = 156_543.033_928_004_18;

/** Las teselas de OpenWeather se piden con `maximumLevel: 10`. */
export const OWM_MAX_LEVEL = 10;

/** Resolución mínima con sentido: evita logaritmos de cero al hacer zoom extremo. */
const MIN_MPP = 1e-4;

/**
 * Nivel de zoom (estilo Web Mercator, 0 = mundo en 256 px) equivalente a una
 * resolución de `metresPerPixel` en una latitud dada. `null` si el dato no sirve.
 *
 * La latitud importa: a 60° la misma resolución corresponde a más nivel, porque
 * la proyección Mercator estira las teselas hacia los polos. Ignorarla hacía
 * que en el norte se avisara un nivel más tarde de lo real.
 */
export function tileZoomLevel(metresPerPixel: number, latitudeDeg = 0): number | null {
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) return null;
  const lat = Math.min(Math.abs(latitudeDeg), 85) * (Math.PI / 180);
  const mpp = Math.max(metresPerPixel, MIN_MPP);
  const level = Math.log2((MPP_AT_ZOOM_0 * Math.cos(lat)) / mpp);
  return Number.isFinite(level) ? level : null;
}

/** Configuración mínima de una capa que basta para saber su tope. */
export interface TileLayerLimitSource {
  gibs?: { level: number } | null;
  owm?: string | null;
}

/**
 * Último nivel que publica la capa. `null` si la capa no es de teselas (puntos,
 * esferas, servicios que no son ráster), en cuyo caso no hay nada que avisar.
 */
export function layerMaxTileLevel(def: TileLayerLimitSource): number | null {
  if (def.gibs) return def.gibs.level;
  if (def.owm) return OWM_MAX_LEVEL;
  return null;
}

export interface TileOverscan {
  /** Nivel que está pidiendo la cámara. */
  requested: number;
  /** Último nivel real de la fuente. */
  max: number;
  /** Cuántos niveles de ampliación: 1 = el doble de tamaño por píxel. */
  levels: number;
}

/**
 * ¿Está la vista por encima del último nivel de esta capa?
 *
 * Devuelve `null` cuando no hay ampliación (o la capa no es de teselas), que es
 * el caso normal: la mayoría de las veces lo que se pinta es el dato tal cual.
 */
export function tileOverscan(
  def: TileLayerLimitSource,
  metresPerPixel: number,
  latitudeDeg = 0,
): TileOverscan | null {
  const max = layerMaxTileLevel(def);
  if (max === null) return null;
  const zoom = tileZoomLevel(metresPerPixel, latitudeDeg);
  if (zoom === null) return null;
  // Se redondea hacia arriba: si la cámara está entre dos niveles, Cesium ya
  // pide el siguiente en cuanto la tesela se queda corta.
  const requested = Math.ceil(zoom - 1e-6);
  if (requested <= max) return null;
  return { requested, max, levels: requested - max };
}

/** Texto corto para la insignia del panel: `z8 > z6`. */
export function overscanLabel(overscan: TileOverscan): string {
  return `z${overscan.requested} > z${overscan.max}`;
}
