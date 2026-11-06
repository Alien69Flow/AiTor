/**
 * Qué teselas sobreviven cuando se encienden muchas de golpe.
 *
 * Cada capa ráster es una `ImageryLayer` con su propia caché de texturas; por
 * encima de `MAX_RASTER_LAYERS` el globo pierde el contexto WebGL. Encender
 * «Todas» pide veinte y hay que decidir cuáles se quedan.
 *
 * La regla ingenua —quedarse con las últimas pulsadas— servía para clics uno a
 * uno, pero al encender en bloque dejaba dentro las capas del final del catálogo
 * y apagaba justo las de arriba (nubes, temperatura, precipitación), que son las
 * que el usuario espera ver. Aquí se aplica, en este orden:
 *
 *  1. lo que ya estaba encendido no se toca: pulsar «Todas» no puede quitar
 *     capas al usuario;
 *  2. el resto del cupo se rellena en orden de catálogo, que va de lo básico a
 *     lo exótico;
 *  3. lo que no cabe se declara encendido-pero-descartado, para poder avisarlo.
 */
export interface RasterBulkPlan<Key extends string> {
  /** Teselas que quedan dibujándose, en orden de antigüedad. */
  keep: Key[];
  /** Teselas pedidas que no caben en el cupo. */
  evicted: Key[];
}

export function planRasterBulk<Key extends string>({
  max,
  catalogOrder,
  active,
  requested,
}: {
  /** Cupo simultáneo de capas de teselas. */
  max: number;
  /** Orden del catálogo: de lo básico a lo accesorio. */
  catalogOrder: readonly Key[];
  /** Teselas encendidas antes de la acción, en el orden en que se encendieron. */
  active: readonly Key[];
  /** Teselas que la acción pide encender. */
  requested: readonly Key[];
}): RasterBulkPlan<Key> {
  const pedidas = new Set(requested);
  const enCatalogo = new Set(catalogOrder);

  // Lo ya encendido manda, incluso si la acción también lo pide: encender no
  // puede empezar apagando. `active` puede traer duplicados (registro de orden
  // más las que vinieron por defecto), así que se deduplica al recorrerlo.
  const yaEncendidas: Key[] = [];
  for (const key of active) {
    if (enCatalogo.has(key) && !yaEncendidas.includes(key)) yaEncendidas.push(key);
  }
  const nuevas = catalogOrder.filter((key) => pedidas.has(key) && !yaEncendidas.includes(key));

  const orden = [...yaEncendidas, ...nuevas];
  const cabe = Math.max(0, max);

  return {
    keep: orden.slice(0, cabe),
    evicted: orden.slice(cabe),
  };
}
