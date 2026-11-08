/**
 * Parche del cableado de transporte en el visor del globo.
 *
 * Dos cambios, los dos sobre `CesiumGlobe.tsx`, que es un fichero de tres mil
 * líneas que no conviene reescribir a mano:
 *
 * 1. Escala adaptativa. Los modelos entraban con `scale: 1`, es decir, a su
 *    tamaño real para siempre. Un avión de 45 m a 2 000 km mide menos de un
 *    píxel y a 200 km ya es una cerilla: la escala tenía que moverse con la
 *    cámara. `modelScale` ya sabe hacer la cuenta, y ahora `scale` es un
 *    `CallbackProperty` que Cesium evalúa en cada fotograma.
 *
 * 2. Vuelos y barcos fuera del agrupador. `clusterGeoMarkers` metía los
 *    contactos en celdas por zoom: con el globo lejos, cuarenta aviones se
 *    convertían en un «40 aeronaves» sin un solo indicativo. Con `0` (sin
 *    agrupar) cada vuelo y cada barco conserva su marca y su etiqueta a
 *    cualquier altura; el resto de capas siguen agrupándose igual.
 *
 * El parche no adivina: cada ancla tiene que aparecer exactamente una vez o
 * lanza. Además sabe limpiar los restos de una aplicación anterior
 * (`tidyPatchedTransport`): la primera pasada por CI se hizo con una versión
 * anterior y dejó el import en una sola línea y huecos en blanco dentro de los
 * bloques del modelo.
 *
 * La limpieza tiene que ser un punto fijo: aplicarla dos veces seguidas debe
 * devolver el mismo fichero. Si no, el workflow vuelve a ver diferencias en
 * cada pasada y empuja un commit eternamente. Por eso el alineado de los
 * comentarios del agrupador se hace por índices y comparando con el resultado,
 * no con un `replace` global que pueda desplazarse línea a línea.
 */
export interface TransportWiringResult {
  source: string;
  changed: boolean;
}

/** Marca de que las dos escalas ya están cableadas. */
export const SCALE_MARKER = "Escala adaptativa por altura de cámara";
/** Marca de que los vuelos ya no pasan por el agrupador. */
export const FLIGHT_NO_CLUSTER_MARKER = "Sin agrupador: cada vuelo";
/** Marca de que los barcos tampoco. */
export const SHIP_NO_CLUSTER_MARKER = "Sin agrupador: cada barco";

const FLIGHT_MODEL_ANCHOR = "const flightGroups = clusterGeoMarkers(";
const SHIP_MODEL_ANCHOR = "const shipGroups = clusterGeoMarkers(";

/** Índice del paréntesis que cierra el abierto en `openIndex`, o -1. */
function matchingParen(source: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Argumentos de primer nivel de una llamada, separados por comas. */
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.filter((part) => part.trim().length > 0);
}

/**
 * Cambia el último argumento de una llamada (`lodCell`) por el código dado.
 *
 * Se localiza por el nombre de la constante que recibe el resultado, no por la
 * coma suelta: en el fichero hay media docena de `clusterGeoMarkers` y sólo dos
 * son las de vuelos y barcos. La sangría del argumento se conserva, porque el
 * punto de inserción ya está sangrado.
 */
function replaceLastArgument(
  source: string,
  anchor: string,
  replacement: (indent: string) => string,
): string {
  const start = source.indexOf(anchor);
  if (start < 0) throw new Error(`ancla no encontrada: ${anchor}`);
  if (source.indexOf(anchor, start + anchor.length) >= 0) {
    throw new Error(`ancla repetida: ${anchor}`);
  }

  const open = start + anchor.length - 1;
  const close = matchingParen(source, open);
  if (close < 0) throw new Error(`llamada sin cerrar: ${anchor}`);

  const inner = source.slice(open + 1, close);
  const last = splitArguments(inner).at(-1)?.trim();
  if (last !== "lodCell") {
    throw new Error(`la llamada de ${anchor} no termina en lodCell (termina en «${last}»)`);
  }

  const cut = inner.lastIndexOf("lodCell");
  const before = inner.slice(0, cut);
  // Lo que hay entre el último salto y el argumento: la sangría a reutilizar.
  const indent = /[ \t]*$/.exec(before)?.[0] ?? "";

  return (
    source.slice(0, open + 1 + cut) +
    replacement(indent) +
    source.slice(open + 1 + cut + "lodCell".length)
  );
}

/** Escala de un modelo de vuelo, evaluada por Cesium en cada fotograma. */
function flightScaleCode(indent: string): string {
  return [
    `${indent}// ${SCALE_MARKER}: Cesium evalúa este callback en cada fotograma`,
    `${indent}// con el visor vivo, así que el avión se reescala al acercarse en`,
    `${indent}// vez de quedarse con la escala del momento en que se creó.`,
    `${indent}scale: new CallbackProperty(`,
    `${indent}  () =>`,
    `${indent}    modelScale(`,
    `${indent}      flightModelKind(flight),`,
    `${indent}      viewer.camera.positionCartographic?.height ?? 0,`,
    `${indent}      viewer.scene.canvas.clientHeight,`,
    `${indent}    ),`,
    `${indent}  false,`,
    `${indent}),`,
  ].join("\n");
}

/** Lo mismo para el casco de un buque. */
function shipScaleCode(indent: string): string {
  return [
    `${indent}// ${SCALE_MARKER}: el casco cambia de tamaño con la altura de cámara`,
    `${indent}// para leerse a 1 500 km sin convertirse en una pieza de kilómetros.`,
    `${indent}scale: new CallbackProperty(`,
    `${indent}  () =>`,
    `${indent}    modelScale(`,
    `${indent}      shipModelKind(ship),`,
    `${indent}      viewer.camera.positionCartographic?.height ?? 0,`,
    `${indent}      viewer.scene.canvas.clientHeight,`,
    `${indent}    ),`,
    `${indent}  false,`,
    `${indent}),`,
  ].join("\n");
}

/** Sustituye `scale: 1` por el callback, sin tocar el resto del bloque. */
function replaceScale(
  source: string,
  rangeName: string,
  replacement: (indent: string) => string,
): string {
  const pattern = new RegExp(
    `([ \\t]*)scale: 1,(\\s*)(distanceDisplayCondition: new DistanceDisplayCondition\\(0, ${rangeName}\\),)`,
    "g",
  );
  const matches = source.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(`se esperaba un bloque de escala para ${rangeName}, hay ${matches.length}`);
  }

  return source.replace(
    pattern,
    (_match: string, indent: string, gap: string, tail: string) =>
      `${replacement(indent)}${gap}${tail}`,
  );
}

/** Añade `modelScale` al import del módulo de transporte si no está ya. */
function addImport(source: string): string {
  if (/^[ \t]*modelScale,[ \t]*$/m.test(source)) return source;
  const anchor = /\n([ \t]*)modelHeadingRadians,\n/.exec(source);
  if (!anchor) throw new Error("ancla no encontrada: modelHeadingRadians en el import");

  const matched = anchor[0];
  const after = anchor.index + matched.length;
  // Se conserva la línea encontrada y se añade la nueva detrás, con su sangría.
  return `${source.slice(0, anchor.index)}${matched}${anchor[1]}modelScale,\n${source.slice(after)}`;
}

/**
 * Alinea el comentario del agrupador con el `0` que lo sigue.
 *
 * Se hace por índices y no con un `replace` global: el bloque de comentarios se
 * localiza hacia atrás desde el marcador, se comprueba que la línea siguiente
 * al bloque es el `0`, y se reconstruye con la sangría de ese `0`. Si ya está
 * alineado devuelve el mismo texto, que es lo que hace la limpieza repetible.
 */
function alignClusterComment(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at < 0) return source;

  const commentStart = source.lastIndexOf("\n", at) + 1;
  if (!/^[ \t]*\/\//.test(source.slice(commentStart))) return source;

  // Hacia atrás, mientras las líneas anteriores sean comentarios.
  let blockStart = commentStart;
  while (blockStart > 0) {
    const previousEnd = blockStart - 1; // el salto que precede al bloque
    const previousStart = source.lastIndexOf("\n", previousEnd - 1) + 1;
    if (!/^[ \t]*\/\//.test(source.slice(previousStart, previousEnd))) break;
    blockStart = previousStart;
  }

  // Hacia delante, saltando los comentarios, hasta el `0`.
  let cursor = commentStart;
  for (;;) {
    const end = source.indexOf("\n", cursor);
    if (end < 0) return source;
    cursor = end + 1;

    const nextEnd = source.indexOf("\n", cursor);
    const line = source.slice(cursor, nextEnd < 0 ? source.length : nextEnd);
    if (/^[ \t]*\/\//.test(line)) continue;
    if (line.trim() !== "0," && line.trim() !== "0") return source;

    const indent = /^[ \t]*/.exec(line)?.[0] ?? "";
    const block = source.slice(blockStart, cursor);
    const aligned = `${block
      .split("\n")
      .filter((piece) => piece !== "")
      .map((piece) => `${indent}${piece.trim()}`)
      .join("\n")}\n`;

    if (aligned === block) return source;
    return source.slice(0, blockStart) + aligned + source.slice(cursor);
  }
}

/**
 * Limpia los restos de una aplicación anterior del parche.
 *
 * No es cosmética: el import quedó con dos identificadores en la misma línea y
 * los bloques del modelo con líneas en blanco llenas de espacios. Funciona,
 * pero cualquier `prettier --check` o revisión posterior lo marca como sucio,
 * y un fichero sucio invita a que el siguiente parche falle por ancla.
 *
 * Cada paso es un punto fijo: aplicarlo sobre su propio resultado no cambia
 * nada. Es la condición que necesita el workflow para no empujar un commit en
 * cada pasada.
 */
export function tidyPatchedTransport(source: string): string {
  let out = source;

  // 1. `modelHeadingRadians,  modelScale,` y su línea en blanco detrás.
  out = out.replace(
    /([ \t]*)modelHeadingRadians,([ \t]+)modelScale,\n[ \t]*\n/,
    "$1modelHeadingRadians,\n$1modelScale,\n",
  );

  // 2. Huecos entre el cierre del modelo y la condición de distancia: con
  //    espacios, con líneas vacías o con las dos cosas, que es como los dejó
  //    la primera pasada.
  out = out.replace(
    /\),\n(?:[ \t]*\n)+([ \t]*distanceDisplayCondition: new DistanceDisplayCondition\(0, (?:FLIGHT|SHIP)_MODEL_RANGE_M\),)/g,
    "),\n$1",
  );

  // 3. El comentario del agrupador y el `0` con la sangría del argumento.
  out = alignClusterComment(out, FLIGHT_NO_CLUSTER_MARKER);
  out = alignClusterComment(out, SHIP_NO_CLUSTER_MARKER);

  return out;
}

/** Aplica la limpieza hasta que ya no cambia nada (o hasta cuatro pasadas). */
function settle(source: string): string {
  let current = source;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = tidyPatchedTransport(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

/**
 * Aplica los dos cambios.
 *
 * Si el fichero ya está parcheado devuelve la versión limpia y, cuando no hay
 * nada que limpiar, `changed: false` con el texto intacto. Si sólo está a
 * medias, lanza: mezclar las dos versiones dejaría vuelos sin agrupar y barcos
 * agrupados sin que nadie se diera cuenta.
 */
export function patchTransportWiring(source: string): TransportWiringResult {
  const applied = source.includes(SCALE_MARKER);
  const clusters = [FLIGHT_NO_CLUSTER_MARKER, SHIP_NO_CLUSTER_MARKER].filter((marker) =>
    source.includes(marker),
  );

  if (applied || clusters.length > 0) {
    if (!applied || clusters.length !== 2) {
      throw new Error(
        "el parche está aplicado a medias: revisa CesiumGlobe.tsx antes de volver a ejecutarlo",
      );
    }
    const tidied = settle(source);
    return { source: tidied, changed: tidied !== source };
  }

  let patched = addImport(source);
  patched = replaceScale(patched, "FLIGHT_MODEL_RANGE_M", flightScaleCode);
  patched = replaceScale(patched, "SHIP_MODEL_RANGE_M", shipScaleCode);

  patched = replaceLastArgument(
    patched,
    FLIGHT_MODEL_ANCHOR,
    (indent) =>
      `${indent}// ${FLIGHT_NO_CLUSTER_MARKER} conserva su marca y su etiqueta a cualquier\n` +
      `${indent}// zoom: agruparlo dejaba el indicativo detrás de un «40 aeronaves».\n` +
      `${indent}0`,
  );
  patched = replaceLastArgument(
    patched,
    SHIP_MODEL_ANCHOR,
    (indent) =>
      `${indent}// ${SHIP_NO_CLUSTER_MARKER} conserva su nombre y su marca a cualquier\n` +
      `${indent}// zoom: en un puerto, agruparlos escondía qué barco era cada uno.\n` +
      `${indent}0`,
  );

  // Se deja ya en su forma limpia: así la segunda pasada no encuentra trabajo.
  const settled = settle(patched);
  return { source: settled, changed: settled !== source };
}
