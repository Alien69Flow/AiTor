/**
 * Relieve real del globo con teselas de elevación abiertas.
 *
 * El globo se dibujaba sobre un elipsoide liso (`EllipsoidTerrainProvider`), así
 * que al acercarte a los Alpes o al Himalaya no había ni montañas ni valles. La
 * alternativa de Cesium (Cesium World Terrain) exige un token de Ion que este
 * proyecto no tiene y no quiere embeber en el bundle.
 *
 * Aquí se usan las teselas **Terrarium** del proyecto elevación abierta de AWS
 * (`elevation-tiles-prod`, S3 público con CORS `*`, sin clave ni cuenta): un PNG
 * de 256×256 por tesela que codifica la altura en los canales RGB. Cesium lo
 * consume por `CustomHeightmapTerrainProvider`, que pide una rejilla de alturas
 * en metros por tesela.
 *
 * Decodificación (documentada por el proyecto):
 *
 *   altura_metros = (R · 256 + G + B / 256) − 32768
 *
 * Con eso el nivel del mar cae en 0 y los océanos pueden traer batimetría
 * negativa, que se respeta.
 */
import { CustomHeightmapTerrainProvider, WebMercatorTilingScheme } from "cesium";

/** Resolución de la rejilla que se le entrega a Cesium por tesela. */
export const TERRAIN_GRID = 65;

/**
 * Último nivel con datos propios de la fuente (z15 ≈ 19 m por muestra con la
 * rejilla de 65). Por debajo se reutiliza su antecesor remuestreado.
 */
export const TERRAIN_MAX_LEVEL = 15;

export function terrariumTileUrl(x: number, y: number, level: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${level}/${x}/${y}.png`;
}

/**
 * Convierte los píxeles RGBA de una tesela Terrarium en alturas en metros.
 * Puro y sin navegador: se prueba con píxeles escritos a mano.
 */
export function decodeTerrarium(pixels: Uint8ClampedArray | Uint8Array, samples: number): Float32Array {
  const heights = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    heights[i] = r * 256 + g + b / 256 - 32768;
  }
  return heights;
}

/** Rejilla plana, para las teselas que no existen (océano sin batimetría, 404). */
function flat(samples: number): Float32Array {
  return new Float32Array(samples);
}

/**
 * Tesela de la que se leen los datos para otra que no existe en la fuente.
 *
 * Por debajo de `TERRAIN_MAX_LEVEL` se sube `steps` niveles y se recorta la
 * sub-región: la misma imagen sirve para el antecesor y para sus descendientes.
 * Puro y exportado para poder probar el redondeo de coordenadas, que es donde
 * un `>>` mal puesto produce relieve de otra parte del mundo.
 */
export function resolveTerrainTile(
  x: number,
  y: number,
  level: number,
  sourceLevel: number = Math.min(level, TERRAIN_MAX_LEVEL),
): { sourceLevel: number; sourceX: number; sourceY: number; span: number; offsetX: number; offsetY: number } {
  const steps = Math.max(0, level - Math.min(sourceLevel, level));
  const resolved = Math.min(sourceLevel, level);
  const sourceX = x >> steps;
  const sourceY = y >> steps;
  const span = 2 ** steps;
  return {
    sourceLevel: resolved,
    sourceX,
    sourceY,
    span,
    offsetX: x - (sourceX << steps),
    offsetY: y - (sourceY << steps),
  };
}

const cache = new Map<string, Promise<ImageBitmap>>();

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;

/** Un solo lienzo reutilizado: crear uno por tesela costaba memoria y tiempo. */
function scratchContext(): CanvasRenderingContext2D | null {
  if (context) return context;
  canvas = document.createElement("canvas");
  canvas.width = TERRAIN_GRID;
  canvas.height = TERRAIN_GRID;
  context = canvas.getContext("2d", { willReadFrequently: true });
  return context;
}

async function loadTile(level: number, x: number, y: number): Promise<ImageBitmap> {
  const key = `${level}/${x}/${y}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const response = await fetch(terrariumTileUrl(x, y, level), { mode: "cors" });
    if (!response.ok) throw new Error(`terrarium ${level}/${x}/${y}: ${response.status}`);
    return createImageBitmap(await response.blob());
  })();

  // Una caché sin límite se come la memoria en una sesión larga.
  if (cache.size > 600) cache.clear();
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}

/**
 * Pide la altura de una tesela y la devuelve como rejilla de `TERRAIN_GRID²`.
 *
 * Por debajo del último nivel disponible no se pide una tesela que no existe: se
 * coge la del antecesor más profundo y se recorta su sub-región. Así el zoom
 * cercano sigue teniendo relieve continuo (remuestreado) en vez de agujeros o
 * una pared plana.
 */
async function heightsFor(x: number, y: number, level: number): Promise<Float32Array> {
  const samples = TERRAIN_GRID * TERRAIN_GRID;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return flat(samples);
  }

  const target = scratchContext();
  if (!target) return flat(samples);

  // La fuente no publica todas las teselas de los niveles profundos (sobre el
  // océano abierto, por ejemplo). Antes de rendirse se baja al antecesor, que
  // cubre la misma región: el relieve sale algo más suave, nunca un agujero.
  for (let sourceLevel = Math.min(level, TERRAIN_MAX_LEVEL); sourceLevel >= 0; sourceLevel--) {
    const { sourceX, sourceY, span, offsetX, offsetY } = resolveTerrainTile(x, y, level, sourceLevel);
    try {
      const bitmap = await loadTile(sourceLevel, sourceX, sourceY);

      // `drawImage` remuestrea la sub-región a la rejilla que espera Cesium. La
      // fila 0 de la imagen es el norte, que es justo el orden del heightmap.
      const sourceSize = 256 / span;
      target.drawImage(
        bitmap,
        offsetX * sourceSize,
        offsetY * sourceSize,
        sourceSize,
        sourceSize,
        0,
        0,
        TERRAIN_GRID,
        TERRAIN_GRID,
      );
      return decodeTerrarium(target.getImageData(0, 0, TERRAIN_GRID, TERRAIN_GRID).data, samples);
    } catch {
      // Siguiente antecesor.
    }
  }

  // Sin datos en ningún nivel: plano, nunca una excepción que rompa el globo.
  return flat(samples);
}

/**
 * Proveedor de terreno listo para `Viewer`. Devuelve `null` si algo impide
 * construirlo, para que el llamante se quede con el elipsoide en vez de romper.
 */
export function createTerrariumTerrainProvider(): CustomHeightmapTerrainProvider | null {
  try {
    return new CustomHeightmapTerrainProvider({
      width: TERRAIN_GRID,
      height: TERRAIN_GRID,
      tilingScheme: new WebMercatorTilingScheme(),
      credit: "Elevación: AWS Terrain Tiles (Mapzen Terrarium) · datos SRTM/NED",
      callback: (x: number, y: number, level: number) => heightsFor(x, y, level),
    });
  } catch (error) {
    console.warn("[terrain] no se pudo crear el proveedor de relieve:", error);
    return null;
  }
}
