/**
 * Parche de la base del globo: lo que quita el planeta azul del arranque.
 *
 * Vive aquí, y no en un `sed` suelto, por tres motivos: se prueba sin Cesium,
 * el script que lo ejecuta falla en claro si el archivo cambió, y aplicarlo dos
 * veces no hace nada (idempotente).
 *
 * Los tres cambios, en orden:
 *
 * 1. `globe.baseColor` oscuro. Cesium usa `Color.BLUE` si nadie le dice otra
 *    cosa, y ése es el color que se veía mientras no había teselas.
 * 2. `enableLighting` a `false` en el arranque: la luz solar sobre un globo sin
 *    imagen lo convertía en una bola azul marino. La capa de día/noche sigue
 *    encendiéndolo cuando de verdad está activa.
 * 3. La imagen base deja de esperar a `fromUrl`: con `UrlTemplateImageryProvider`
 *    la capa existe en el primer fotograma.
 *
 * Sin `node:fs` ni rutas: recibe el texto y devuelve el texto. Quien lee y
 * escribe el archivo es `scripts/apply-globe-base-patch.ts`.
 */

export interface GlobePatchResult {
  /** `false` si el archivo ya no tiene las anclas esperadas: entonces `source` es la entrada, intacta. */
  ok: boolean;
  source: string;
  applied: string[];
  already: string[];
  problems: string[];
}

/** Fondo del visor; su sangría la hereda todo lo que se añade debajo. */
const BACKGROUND_LINE = /^([ \t]*)viewer\.scene\.backgroundColor = Color\.BLACK;[ \t]*$/m;
const BASE_COLOR_LINE =
  /^[ \t]*viewer\.scene\.globe\.baseColor = Color\.fromCssColorString\("#0b1220"\);[ \t]*$/m;
const LIGHTING_ON_LINE = /^([ \t]*)viewer\.scene\.globe\.enableLighting = true;[ \t]*$/m;
const LIGHTING_OFF_LINE = /^[ \t]*viewer\.scene\.globe\.enableLighting = false;[ \t]*$/m;

/**
 * El bloque asíncrono original. Admite cualquier sangría y las dos variantes
 * que existen (con y sin el `if (viewer.isDestroyed()) return;` en medio).
 */
const BASE_AWAIT_BLOCK =
  /^([ \t]*)const baseProvider = await ArcGisMapServerImageryProvider\.fromUrl\(\s*"https:\/\/services\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer"\s*\);\s*(?:if \(viewer\.isDestroyed\(\)\) return;\s*)?const baseLayer = viewer\.imageryLayers\.addImageryProvider\(baseProvider\);\s*viewer\.imageryLayers\.lowerToBottom\(baseLayer\);[ \t]*$/m;

const indent = (rows: string[], pad: string) =>
  rows.map((row) => (row ? `${pad}${row}` : row)).join("\n");

/**
 * Aplica el parche. Todo o nada: si falta una ancla no devuelve un archivo a
 * medias, devuelve la entrada y los problemas encontrados.
 */
export function applyGlobeBasePatch(input: string): GlobePatchResult {
  const applied: string[] = [];
  const already: string[] = [];
  const problems: string[] = [];
  let source = input;

  // 1. Relleno oscuro mientras no hay teselas.
  if (BASE_COLOR_LINE.test(source)) {
    already.push("baseColor oscuro");
  } else {
    const anchor = BACKGROUND_LINE.exec(source);
    if (!anchor) {
      problems.push("no encuentro la línea `viewer.scene.backgroundColor = Color.BLACK;`");
    } else {
      const insert = indent(
        [
          "",
          "// El relleno del globo mientras no hay teselas es el que se veía azul:",
          "// Cesium usa Color.BLUE si nadie le dice otra cosa.",
          'viewer.scene.globe.baseColor = Color.fromCssColorString("#0b1220");',
        ],
        anchor[1],
      );
      source = source.replace(BACKGROUND_LINE, () => `${anchor[0]}${insert}`);
      applied.push("baseColor oscuro");
    }
  }

  // 2. Sin luz solar sobre el relleno. La capa dayNight lo enciende después.
  if (LIGHTING_OFF_LINE.test(source)) {
    already.push("enableLighting en false");
  } else {
    const anchor = LIGHTING_ON_LINE.exec(source);
    if (!anchor) {
      problems.push("no encuentro `viewer.scene.globe.enableLighting = true;` en el arranque");
    } else {
      source = source.replace(
        LIGHTING_ON_LINE,
        () => `${anchor[1]}viewer.scene.globe.enableLighting = false;`,
      );
      applied.push("enableLighting en false");
    }
  }

  // 3. Imagen base sin espera: la capa entra en el primer fotograma.
  const hasSyncBase =
    source.includes("World_Imagery/MapServer/tile/") &&
    source.includes("new UrlTemplateImageryProvider({");
  if (hasSyncBase) {
    already.push("imagen base síncrona");
  } else {
    const anchor = BASE_AWAIT_BLOCK.exec(source);
    if (!anchor) {
      problems.push(
        "no encuentro el bloque `baseProvider = await ArcGisMapServerImageryProvider.fromUrl(...World_Imagery...)` con su `lowerToBottom`",
      );
    } else {
      const replacement = indent(
        [
          "// 2. Imagen base síncrona: el proveedor de plantilla de teselas no resuelve",
          "// nada por red antes de crear la capa, así que la Tierra ya sale con foto en",
          "// el primer fotograma. El `fromUrl` de ArcGIS era asíncrono y durante ese",
          "// hueco se veía el relleno plano del motor.",
          "const baseLayer = viewer.imageryLayers.addImageryProvider(",
          "  new UrlTemplateImageryProvider({",
          '    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",',
          "    maximumLevel: 19,",
          '    credit: "Esri, Maxar, Earthstar Geographics",',
          "  }),",
          ");",
          "viewer.imageryLayers.lowerToBottom(baseLayer);",
        ],
        anchor[1],
      );
      source = source.replace(BASE_AWAIT_BLOCK, () => replacement);
      applied.push("imagen base síncrona");
    }
  }

  if (problems.length) {
    return { ok: false, source: input, applied: [], already, problems };
  }
  return { ok: true, source, applied, already, problems };
}
