/**
 * Agrupación por zoom de los marcadores vivos del globo.
 *
 * `label-clusters` ya agrupa el catálogo estático (estrechos, bases, reactores,
 * cables). El resto de marcadores —vuelos, barcos, incendios, sismos, cámaras—
 * se pintaban uno a uno y sin límite: con la cámara a 20 000 km hay cientos de
 * iconos superpuestos y la Tierra se lee como una alfombra de puntos.
 *
 * Este módulo hace lo mismo que el de etiquetas, pero para datos que llegan por
 * conector y cambian cada pocos minutos: divide la vista en celdas del tamaño de
 * un trozo de pantalla y devuelve un grupo por celda. El dibujo decide después
 * si un grupo de uno se pinta como siempre y uno de varios se pinta con la
 * cuenta.
 *
 * Sin Cesium ni React: se puede comprobar con datos inventados.
 */

import { clusterCellDegrees } from "./label-clusters";

/** Lo mínimo para poder agrupar un marcador. */
export interface GeoMarker {
  id: string;
  lat: number;
  lon: number;
}

/** Un marcador suelto, o una celda con varios. */
export type GeoMarkerGroup<T extends GeoMarker> =
  | { kind: "single"; item: T }
  | { kind: "cluster"; id: string; lat: number; lon: number; items: T[] };

const cellKey = (lat: number, lon: number, cell: number) =>
  `${Math.floor(lat / cell)}:${Math.floor(lon / cell)}`;

/**
 * Agrupa por celdas de `cellDegrees`. Con `0` (zoom cercano) devuelve cada
 * marcador suelto: agrupar de cerca esconde nombres sin resolver nada.
 *
 * Los puntos sin coordenadas finitas se descartan aquí y no en la capa: si un
 * conector manda un `null`, el globo no debe dibujar un marcador en (0, 0).
 */
export function clusterGeoMarkers<T extends GeoMarker>(
  items: readonly T[],
  cellDegrees: number,
): GeoMarkerGroup<T>[] {
  const valid = items.filter(
    (item) => Number.isFinite(item.lat) && Number.isFinite(item.lon),
  );
  if (!valid.length) return [];
  if (!(cellDegrees > 0)) return valid.map((item) => ({ kind: "single" as const, item }));

  const cells = new Map<string, T[]>();
  for (const item of valid) {
    const key = cellKey(item.lat, item.lon, cellDegrees);
    const bucket = cells.get(key);
    if (bucket) bucket.push(item);
    else cells.set(key, [item]);
  }

  // Orden estable por celda: dos repintados con el mismo zoom no bailan.
  return [...cells.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map<GeoMarkerGroup<T>>(([key, members]) => {
      if (members.length === 1) return { kind: "single", item: members[0] };
      const lat = members.reduce((total, member) => total + member.lat, 0) / members.length;
      const lon = members.reduce((total, member) => total + member.lon, 0) / members.length;
      return { kind: "cluster", id: `g-${key}`, lat, lon, items: members };
    });
}
