/**
 * Agrupación por zoom de los marcadores fijos del globo.
 *
 * Las cinco capas estratégicas suman 251 entradas (29 estrechos, 88 sitios
 * nucleares, 80 bases, 28 cables y 26 oleoductos). A 20 000 km de altura el
 * globo entero cabe en la pantalla y todos los puntos están a la vista, así que
 * 197 etiquetas se pisaban unas a otras y el mapa se leía como una mancha de
 * texto: la etiqueta decía menos que el punto.
 *
 * La regla es la que usa cualquier mapa: a cada altura, el globo se divide en
 * celdas del tamaño aproximado de la pantalla dividida en doce columnas, y cada
 * celda con más de un sitio se dibuja como un solo marcador con su cuenta. Al
 * acercar, la celda se encoge y el grupo se abre solo hasta que cada sitio
 * recupera su nombre.
 *
 * A escala de planeta el reparto cambia: con la Tierra entera en pantalla doce
 * columnas dejan celdas de 16°, que a 1 500 px son ~158 px y siguen dejando
 * decenas de burbujas sobre Europa y el este de Asia. Ahí se usan ocho
 * columnas, que dan celdas de 20° (~197 px): el mismo planeta, menos ruido, y
 * el grupo conserva su cuenta para no perder información.
 *
 * Se calcula en un módulo aparte y sin Cesium para poder probarlo: la cámara,
 * los nombres y el dibujo no intervienen en la decisión.
 */
/** Un punto del catálogo estático, con lo mínimo para agruparse. */
export interface MapLabelPoint {
  id: string;
  lat: number;
  lon: number;
  /** Emoji de la capa (`☢️`, `🛡️`, `⚓`…). */
  icon: string;
  name: string;
}

/** Un punto suelto, o una celda con varios. */
export type MapLabelGroup<T extends MapLabelPoint> =
  | { kind: "point"; point: T }
  | { kind: "cluster"; id: string; lat: number; lon: number; members: T[] };

const EARTH_RADIUS_M = 6_371_000;

/**
 * Por debajo de esta altura no se agrupa nada. Cesium descarta lo que queda
 * fuera de la vista, y a escala de ciudad o de región sólo hay un puñado de
 * sitios en pantalla: agrupar ahí escondería nombres sin resolver nada.
 */
export const CLUSTER_MIN_ALTITUDE_M = 120_000;

/** Columnas de celdas que caben a lo ancho de la vista, más o menos. */
const COLUMNS = 12;

/**
 * Columnas a escala de planeta. Menos columnas, celdas más grandes: es el
 * escalón donde la Tierra entera ocupa la pantalla y el ruido importa más que
 * el detalle, porque a esa distancia un sitio suelto no se distingue igual.
 */
const PLANET_COLUMNS = 8;

/**
 * Altura a partir de la cual se considera vista de planeta. Por debajo, la
 * celda de doce columnas ya cae en el mismo escalón, así que el cambio no
 * altera el zoom de trabajo (regiones, países, ciudades).
 */
const PLANET_ALTITUDE_M = 8_000_000;

/**
 * Tamaños de celda en grados. Son escalones fijos y no un valor continuo a
 * propósito: la cámara avisa a cada suspiro y reconstruir las entidades del
 * globo en cada movimiento sería un tirón constante. Con escalones, el globo se
 * repinta cuando el zoom cruza un umbral.
 *
 * El último escalón es 20° y no más: la vista nunca abarca más de 180° de
 * hemisferio, así que con ocho columnas a escala de planeta ninguna celda
 * razonable pasa de ahí, y una celda mayor se comería un continente entero en
 * un solo punto.
 */
export const CLUSTER_CELL_LADDER = [0, 0.5, 1, 2, 4, 8, 16, 20] as const;

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Ancho visible del globo a una altura dada, en grados, sobre una esfera.
 *
 * `acos(R / (R + h))` es el ángulo entre el nadir y el horizonte: el doble es lo
 * que abarca la vista de lado a lado.
 */
export function visibleWidthDegrees(altitudeMetres: number): number {
  const altitude = Number.isFinite(altitudeMetres) ? Math.max(0, altitudeMetres) : 0;
  if (altitude <= 0) return 0;
  const half = Math.acos(Math.min(1, EARTH_RADIUS_M / (EARTH_RADIUS_M + altitude)));
  return 2 * toDegrees(half);
}

/**
 * Lado de celda, en grados, para la altura de la cámara. `0` significa «sin
 * agrupar».
 */
export function clusterCellDegrees(altitudeMetres: number): number {
  const altitude = Number.isFinite(altitudeMetres) ? Math.max(0, altitudeMetres) : 0;
  if (altitude <= CLUSTER_MIN_ALTITUDE_M) return 0;

  const columns = altitude >= PLANET_ALTITUDE_M ? PLANET_COLUMNS : COLUMNS;
  const target = visibleWidthDegrees(altitude) / columns;
  return (
    CLUSTER_CELL_LADDER.find((step) => step > 0 && step >= target) ??
    CLUSTER_CELL_LADDER[CLUSTER_CELL_LADDER.length - 1]
  );
}

const cellKey = (lat: number, lon: number, cell: number) =>
  `${Math.floor(lat / cell)}:${Math.floor(lon / cell)}`;

/**
 * Agrupa los puntos en celdas de `cellDegrees`. Con `0` devuelve cada punto
 * suelto, que es lo que quiere el zoom cercano.
 *
 * El centro del grupo es la media de sus miembros: dentro de una celda de unos
 * pocos grados, la media cae donde el ojo espera el punto. Un sitio no puede
 * aparecer dos veces: cada punto cae en una sola celda.
 */
export function clusterMapLabels<T extends MapLabelPoint>(points: T[], cellDegrees: number): MapLabelGroup<T>[] {
  if (!points.length) return [];
  if (!(cellDegrees > 0)) return points.map((point) => ({ kind: "point", point }));

  const cells = new Map<string, T[]>();
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const key = cellKey(point.lat, point.lon, cellDegrees);
    const bucket = cells.get(key);
    if (bucket) bucket.push(point);
    else cells.set(key, [point]);
  }

  // Orden estable por celda: dos repintados con el mismo zoom no bailan.
  return [...cells.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map<MapLabelGroup<T>>(([key, members]) => {
      if (members.length === 1) return { kind: "point", point: members[0] };
      const lat = members.reduce((total, member) => total + member.lat, 0) / members.length;
      const lon = members.reduce((total, member) => total + member.lon, 0) / members.length;
      return { kind: "cluster", id: `cluster-${key}`, lat, lon, members };
    });
}
