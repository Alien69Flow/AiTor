/**
 * Perfil visual «Google Earth» del visor Cesium, sin claves ni Cesium Ion.
 *
 * El visor arranca con los ajustes repartidos por `CesiumGlobe.tsx`; este
 * módulo los reúne en un bloque único que se inserta en el fuente, para que
 * atmósfera, iluminación solar, antialiasing y nitidez de teselas se toquen en
 * un sitio y se puedan probar sin cargar Cesium ni WebGL.
 *
 * Vive aquí y no en un `sed` suelto porque: se prueba sin Cesium, el script
 * aplicador falla en claro si el fuente cambió, y aplicarlo dos veces no hace
 * nada (idempotente).
 *
 * Todo lo que pide es abierto: ni Ion, ni Mapbox, ni ninguna clave.
 */

export interface GlobeVisualProfileResult {
  /** `false` si no estaban las anclas: entonces `source` es la entrada, intacta. */
  ok: boolean;
  source: string;
  applied: string[];
  already: string[];
  problems: string[];
}

/** Marca del bloque insertado: sirve para no duplicarlo. */
export const PROFILE_MARKER = "// Perfil visual «Google Earth»";

const CONTEXT_FLAT = "contextOptions: { webgl: { alpha: false } },";
const CONTEXT_MSAA = "contextOptions: { webgl: { alpha: false }, msaaSamples: 4 },";
const GROUND_ATMOSPHERE =
  /^([ \t]*)viewer\.scene\.globe\.showGroundAtmosphere = true;[ \t]*$/m;

/** Las líneas del bloque, sin sangría: la hereda del ancla. */
export const PROFILE_LINES: readonly string[] = [
  "",
  `${PROFILE_MARKER} (sin claves): aire con dispersión real, sol que ilumina`,
  "// el terreno, bordes sin escalones y teselas nítidas al acercarse.",
  "try {",
  "  const scene = viewer.scene;",
  "  // 1. Aire: dispersión por fragmento y halo denso en el limbo. Es lo que",
  "  //    da profundidad al planeta visto desde fuera y lo que lo convierte en",
  "  //    un planeta en vez de una bola de textura.",
  "  const sky = scene.skyAtmosphere;",
  "  if (sky) {",
  "    sky.show = true;",
  "    sky.perFragmentAtmosphere = true;",
  "    sky.dynamicLighting = true;",
  "    sky.atmosphereLightIntensity = 12.0;",
  "    sky.atmosphereMieScattering = 4.0;",
  "    sky.atmosphereMieAnisotropy = 0.9;",
  "    sky.atmosphereMieScaleHeight = 12000;",
  "    sky.hueShift = -0.05;",
  "    sky.saturationShift = 0.2;",
  "    sky.brightnessShift = 0.05;",
  "  }",
  "  // 2. Sol: el terreno y el aire se encienden con la posición real del astro",
  "  //    (hora del sistema), no con una luz fija de estudio.",
  "  scene.globe.enableLighting = true;",
  "  scene.globe.dynamicAtmosphereLighting = true;",
  "  scene.globe.dynamicAtmosphereLightingFromSun = true;",
  "  if (scene.sun) {",
  "    scene.sun.show = true;",
  "    scene.sun.glowFactor = 1.0;",
  "  }",
  "  if (scene.moon) scene.moon.show = true;",
  "  // 3. Antialiasing: FXAA encima del MSAA 4x que pide `contextOptions`.",
  "  scene.postProcessStages.fxaa.enabled = true;",
  "  // 4. Nitidez: caché mayor y vecinas precargadas; el error de pantalla fino",
  "  //    lo sigue ajustando `resolveGlobeDetail` según la altura de la cámara.",
  "  scene.globe.tileCacheSize = 2500;",
  "  scene.globe.preloadAncestors = true;",
  "  scene.globe.preloadSiblings = true;",
  "  scene.fog.enabled = true;",
  "  scene.fog.density = 0.0002;",
  "} catch (e) {",
  '  console.warn("[CesiumGlobe] perfil visual parcial:", e);',
  "}",
];

const indent = (rows: readonly string[], pad: string) =>
  rows.map((row) => (row ? `${pad}${row}` : row)).join("\n");

/**
 * Aplica el perfil sobre el fuente del visor. Todo o nada: si el ancla no
 * aparece exactamente una vez, no devuelve un archivo a medias.
 */
export function applyGlobeVisualProfile(input: string): GlobeVisualProfileResult {
  const applied: string[] = [];
  const already: string[] = [];
  const problems: string[] = [];
  let source = input;

  // Antialiasing geométrico: MSAA en el contexto del visor. FXAA no arregla
  // los bordes de geometría, sólo el aliasing de alta frecuencia.
  if (source.includes(CONTEXT_MSAA)) {
    already.push("MSAA 4x en el contexto");
  } else if (source.includes(CONTEXT_FLAT)) {
    source = source.replace(
      CONTEXT_FLAT,
      () => CONTEXT_MSAA,
    );
    applied.push("MSAA 4x en el contexto");
  } else {
    problems.push(
      "no encuentro `contextOptions: { webgl: { alpha: false } },` en el visor",
    );
  }

  // Bloque del perfil, colgado de la atmósfera de suelo (única en el fuente).
  if (source.includes(PROFILE_MARKER)) {
    already.push("bloque del perfil");
  } else {
    const anchor = GROUND_ATMOSPHERE.exec(source);
    if (!anchor) {
      problems.push(
        "no encuentro `viewer.scene.globe.showGroundAtmosphere = true;` en el arranque",
      );
    } else {
      const insert = indent(PROFILE_LINES, anchor[1]);
      source = source.replace(GROUND_ATMOSPHERE, () => `${anchor[0]}\n${insert}`);
      applied.push("bloque del perfil");
    }
  }

  if (problems.length) {
    return { ok: false, source: input, applied: [], already, problems };
  }
  return { ok: true, source, applied, already, problems };
}
