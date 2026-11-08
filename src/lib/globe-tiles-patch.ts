/**
 * Parche de las capas de teselas que llegaban casi vacías al globo.
 *
 * Tres capas pedían a NASA GIBS productos de barrido orbital, que dejan casi
 * toda la tesela transparente: `seaIce` deducía el hielo de la temperatura de
 * la piel del mar (sólo marcaba el borde), `waterVapor` era un barrido de AMSR2
 * y `stratosphere` el limbo de MLS a 46 hPa. Encima, `oceanCurrents` llevaba la
 * fecha clavada en 2024-07-17, de cuando la serie parecía detenida: OSCAR
 * publica compuestos de 5 días y sigue vivo, así que la fecha fija era lo que
 * congelaba la capa.
 *
 * Los identificadores nuevos están comprobados contra la metadata de GIBS
 * (`https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/<LAYER>.json`):
 * `VIIRS_NOAA21_Sea_Ice` (diario, sigue publicando), 
 * `MERRA2_Total_Precipitable_Water_Vapor_Monthly` y
 * `MERRA2_Air_Temperature_250hPa_Monthly` (mallas completas del reanálisis).
 *
 * `carbonDioxide` no cambia de producto porque GIBS no sirve ninguna malla
 * densa de CO₂: se queda OCO-2 y lo que cambia es lo que el panel dice de ella.
 *
 * Va como parche y no editando `globe-layers.ts` a mano porque son más de mil
 * líneas y aquí no hay máquina para compilar: cada ancla tiene que aparecer una
 * sola vez, o el parche lanza sin escribir nada.
 */

/** Marca de que las teselas densas ya están aplicadas. */
export const TILES_MARKER = "Teselas densas";

/** Una sustitución con su motivo, para el mensaje de error. */
export interface GlobeTilesSwap {
  readonly what: string;
  readonly find: string | RegExp;
  readonly to: string;
}

/**
 * Sustituciones, en orden. Las de `layer` van antes que las de su entorno para
 * que los comentarios y las fuentes se lean ya sobre el producto nuevo.
 */
export const GLOBE_TILES_SWAPS: readonly GlobeTilesSwap[] = [
  // Hielo marino: VIIRS mide el hielo; MUR lo deducía de la SST.
  {
    what: "el identificador del hielo marino",
    find: 'layer: "GHRSST_L4_MUR25_Sea_Ice_Concentration"',
    to: 'layer: "VIIRS_NOAA21_Sea_Ice"',
  },
  {
    what: "el retraso del hielo marino",
    find: "alpha: 0.85, dateOffsetHours: 60",
    to: "alpha: 0.85, dateOffsetHours: 36",
  },
  {
    what: "la fuente del hielo marino",
    find: '"NASA GIBS · GHRSST MUR (diario)"',
    to: '"NASA GIBS · VIIRS NOAA-21 (diario)"',
  },
  {
    what: "la descripción del hielo marino",
    find: '"Concentración de hielo en el Ártico y la Antártida"',
    to: '"Extensión de hielo marino de polo a polo, medida a 375 m"',
  },
  {
    what: "el comentario del hielo marino",
    find: "// La serie AMSR2 de GIBS termina en 2025-09: pedirle una fecha actual da",
    to: "// MUR deducía el hielo de la temperatura de la piel del mar y sólo marcaba",
  },
  {
    what: "el comentario del hielo marino (segunda línea)",
    find: "// 404. MUR publica la misma magnitud todos los días.",
    to: "// el borde; VIIRS lo mide directamente todos los días.",
  },

  // Vapor de agua: malla mensual del reanálisis en vez de un barrido de AMSR2.
  {
    what: "el identificador del vapor de agua",
    find: 'layer: "AMSRU2_Columnar_Water_Vapor_Day"',
    to: 'layer: "MERRA2_Total_Precipitable_Water_Vapor_Monthly"',
  },
  {
    what: "la fuente del vapor de agua",
    find: '"NASA GIBS · AMSR2 (JAXA)"',
    to: '"NASA GIBS · MERRA-2 (reanálisis)"',
  },
  {
    what: "la descripción del vapor de agua",
    find: '"Columna de vapor de agua precipitable sobre el océano"',
    to: '"Columna de vapor de agua precipitable en toda la malla, océano y continente: media mensual del reanálisis"',
  },

  // Estratosfera: la malla densa más cercana que sirve GIBS.
  {
    what: "el identificador de la temperatura en altura",
    find: 'layer: "MLS_Temperature_46hPa_Day"',
    to: 'layer: "MERRA2_Air_Temperature_250hPa_Monthly"',
  },
  {
    what: "la etiqueta de la temperatura en altura",
    find: 'label: "Estratosfera · temperatura"',
    to: 'label: "Temperatura a 250 hPa"',
  },
  {
    what: "la fuente de la temperatura en altura",
    find: '"NASA GIBS · Aura MLS (46 hPa)"',
    to: '"NASA GIBS · MERRA-2 (250 hPa)"',
  },
  {
    what: "la frescura y la descripción de la temperatura en altura",
    find: /([ \t]*)freshness: "1 día",(\s*)description: "Temperatura a 46 hPa[^"]*",/,
    to: '$1freshness: "Media mensual",$2description: "Temperatura a 250 hPa (~10,5 km), media mensual del reanálisis: cubre el globo entero en vez de un barrido de limbo",',
  },
  {
    what: "la fuente de la envoltura estratosférica",
    find: 'layer: "stratosphere", source: "NASA GIBS · Aura MLS a 46 hPa (~22 km)",',
    to: 'layer: "stratosphere", source: "NASA GIBS · MERRA-2 a 250 hPa (~10 km)",',
  },
  {
    what: "la nota de la envoltura estratosférica",
    find: 'note: "La capa sondea el tercio inferior de la envoltura: es donde está la capa de ozono y donde se ve el calentamiento súbito."',
    to: 'note: "La malla densa más cercana que sirve GIBS es la de 250 hPa (~10 km): el perfilador MLS a 46 hPa barre una franja fina y dejaba el globo casi vacío."',
  },

  // CO₂: sin sustituto denso, pero el panel tiene que decirlo.
  {
    what: "la fuente del CO₂",
    find: '"NASA GIBS · OCO-2"',
    to: '"NASA GIBS · OCO-2 (muestreo orbital)"',
  },
  {
    what: "la descripción del CO₂",
    find: '"Columna media de CO₂ — emisiones y sumideros, mes a mes"',
    to: '"Columna media de CO₂ del último día con pasada de OCO-2: es un barrido orbital, así que deja franjas sin dato entre órbitas"',
  },

  // Corrientes: fuera la fecha fija; el compuesto de 5 días se sirve sin TIME.
  {
    what: "la fecha fija de las corrientes oceánicas",
    find: 'date: "2024-07-17",',
    to: "timeless: true,",
  },
  {
    what: "la fuente de las corrientes oceánicas",
    find: '"NASA GIBS · OSCAR (última pasada, jul 2024)"',
    to: '"NASA GIBS · OSCAR (compuesto de 5 días)"',
  },
  {
    what: "la frescura de las corrientes oceánicas",
    find: 'freshness: "Serie detenida en 2024-07-17"',
    to: 'freshness: "Último compuesto disponible"',
  },
  {
    what: "la descripción de las corrientes oceánicas",
    find: '"Corriente superficial este-oeste (componente zonal) de la última pasada de OSCAR"',
    to: '"Corriente superficial este-oeste (componente zonal): compuesto de 5 días de la última pasada de OSCAR"',
  },
  {
    what: "el comentario de las corrientes oceánicas",
    find: "// OSCAR es el único vector de corrientes que GIBS sirve como tesela. La",
    to: "// OSCAR es el único vector de corrientes que GIBS sirve como tesela, y su",
  },
  {
    what: "el comentario de las corrientes oceánicas (segunda línea)",
    find: "// serie se interrumpió en julio de 2024: se fija la fecha para que la",
    to: "// producto es un compuesto de 5 días: pedirle un día suelto devuelve 404.",
  },
  {
    what: "el comentario de las corrientes oceánicas (tercera línea)",
    find: "// capa diga lo que es —la última pasada— en vez de pedir un día actual",
    to: "// sin segmento TIME GIBS sirve el último compuesto, así que la capa sigue",
  },
  {
    what: "el comentario de las corrientes oceánicas (cuarta línea)",
    find: "// que devuelve 404.",
    to: "// a la última pasada en vez de quedarse congelada en 2024.",
  },
];

/** El catálogo tal y como lo abre `LAYER_CATALOG`. */
const CATALOG_ANCHOR = "const LAYER_CATALOG: globeLayerDef[] = [";

/** Cabecera que deja la marca de aplicado dentro del propio catálogo. */
const MARKER_BLOCK = [
  CATALOG_ANCHOR,
  `  // ${TILES_MARKER}: hielo, vapor, estratosfera y corrientes piden productos`,
  "  // de malla completa (VIIRS, MERRA-2, OSCAR) en vez de barridos orbitales.",
].join("\n");

export interface GlobeTilesResult {
  source: string;
  changed: boolean;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Cuántas veces aparece el ancla en el texto, con o sin expresión regular. */
function countMatches(source: string, find: string | RegExp): number {
  const pattern =
    typeof find === "string"
      ? new RegExp(escapeRegExp(find), "g")
      : new RegExp(find.source, find.flags.includes("g") ? find.flags : `${find.flags}g`);
  return source.match(pattern)?.length ?? 0;
}

/**
 * Aplica todas las sustituciones o ninguna: si un ancla falta o está repetida
 * lanza antes de devolver el texto, así que el catálogo nunca queda a medias.
 */
export function patchGlobeTiles(source: string): GlobeTilesResult {
  if (source.includes(TILES_MARKER)) return { source, changed: false };

  if (countMatches(source, CATALOG_ANCHOR) !== 1) {
    throw new Error(
      "no se encontró el catálogo de capas: revisa globe-layers.ts antes de aplicar el parche",
    );
  }

  let out = source;
  for (const swap of GLOBE_TILES_SWAPS) {
    const hits = countMatches(out, swap.find);
    if (hits !== 1) {
      throw new Error(`${swap.what}: se esperaba 1 coincidencia y hay ${hits}`);
    }
    out =
      typeof swap.find === "string"
        ? out.replace(swap.find, () => swap.to)
        : out.replace(swap.find, swap.to);
  }

  out = out.replace(CATALOG_ANCHOR, () => MARKER_BLOCK);

  return { source: out, changed: out !== source };
}
