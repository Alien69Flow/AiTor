/**
 * Parche del cableado de transporte en el visor del globo.
 *
 * Dos cambios, los dos sobre `CesiumGlobe.tsx`, que es un fichero de tres mil
 * líneas que no conviene reescribir a mano:
 *
 * 1. Escala adaptativa. Los modelos entraban con `scale: 1`, es decir, a su
 *    tamaño real para siempre. Un avión de 45 m a 2 000 km mide menos de un
 *    píxel y a 200 km ya es una cerilla: la escala tenía que moverse con la
 *    cámara. `modelScale` ya sabe hacer la cuenta, pero hasta ahora sólo la
 *    usaba el tope de píxeles (`minimumPixelSize`). Ahora `scale` es un
 *    `CallbackProperty`, que Cesium evalúa en cada fotograma, así que el
 *    modelo se reescala solo al acercarse o alejarse.
 *
 * 2. Vuelos y barcos fuera del agrupador. `clusterGeoMarkers` metía los
 *    contactos en celdas por zoom: con el globo lejos, cuarenta aviones se
 *    convertían en un «40 aeronaves» sin un solo indicativo. Con `0` (sin
 *    agrupar) cada vuelo y cada barco conserva su marca y su etiqueta a
 *    cualquier altura; el resto de capas (cámaras, incendios, NASA, GDELT)
 *    siguen agrupándose igual.
 *
 * El parche no adivina: cada ancla tiene que aparecer exactamente una vez o
 * lanza. Es preferible que el flujo de CI falle a que deje el visor a medias.
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
 * Cambia el último argumento de una llamada por `replacement`.
 *
 * Se localiza por el nombre de la constante que recibe el resultado, no por la
 * coma suelta: en el fichero hay media docena de `clusterGeoMarkers` y sólo dos
 * son las de vuelos y barcos.
 */
function replaceLastArgument(source: string, anchor: string, replacement: string): string {
	const start = source.indexOf(anchor);
	if (start < 0) throw new Error(`ancla no encontrada: ${anchor}`);
	if (source.indexOf(anchor, start + anchor.length) >= 0) {
		throw new Error(`ancla repetida: ${anchor}`);
	}

	const open = start + anchor.length - 1;
	const close = matchingParen(source, open);
	if (close < 0) throw new Error(`llamada sin cerrar: ${anchor}`);

	const inner = source.slice(open + 1, close);
	const args = splitArguments(inner);
	const last = args[args.length - 1]?.trim();
	if (last !== "lodCell") {
		throw new Error(`la llamada de ${anchor} no termina en lodCell (termina en «${last}»)`);
	}

	const cut = inner.lastIndexOf("lodCell");
	return source.slice(0, open + 1 + cut) + replacement + source.slice(open + 1 + cut + "lodCell".length);
}

/** Escala de un modelo de vuelo, evaluada por Cesium en cada fotograma. */
function flightScaleCode(indent: string): string {
	return [
		`${indent}// ${SCALE_MARKER}: Cesium evalúa este callback en cada fotograma con`,
		`${indent}// el visor vivo, así que el avión se reescala al acercarse en vez de`,
		`${indent}// quedarse con la escala del momento en que se creó la entidad.`,
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
		`${indent}  `,
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

	return source.replace(pattern, (...args) => {
		const groups = args as unknown as [string, string, string, string];
		const [whole, indent, gap, tail] = groups;
		return `${replacement(indent)}${gap}${tail}` && whole ? `${replacement(indent)}${gap}${tail}` : whole;
	});
}

/** Añade `modelScale` al import del módulo de transporte si no está ya. */
function addImport(source: string): string {
	if (/^\s*modelScale,\s*$/m.test(source)) return source;
	const anchor = /\n([ \t]*)modelHeadingRadians,\s*\n/.exec(source);
	if (!anchor) throw new Error("ancla no encontrada: modelHeadingRadians en el import");

	const insertAt = anchor.index + anchor[0].length - 1;
	return `${source.slice(0, insertAt)}${anchor[1]}modelScale,\n${source.slice(insertAt)}`;
}

/**
 * Aplica los dos cambios.
 *
 * Si el fichero ya está parcheado devuelve `changed: false` sin tocarlo, para
 * que el flujo de CI pueda ejecutarse dos veces sin duplicar el cableado. Si
 * sólo está a medias, lanza: mezclar las dos versiones dejaría vuelos sin
 * agrupar y barcos agrupados sin que nadie se diera cuenta.
 */
export function patchTransportWiring(source: string): TransportWiringResult {
	const applied = source.includes(SCALE_MARKER);
	const clusters = [FLIGHT_NO_CLUSTER_MARKER, SHIP_NO_CLUSTER_MARKER].filter((marker) =>
		source.includes(marker),
	);

	if (applied || clusters.length > 0) {
		if (!applied || clusters.length !== 2) {
			throw new Error("el parche está aplicado a medias: revisa CesiumGlobe.tsx antes de volver a ejecutarlo");
		}
		return { source, changed: false };
	}

	let patched = addImport(source);
	patched = replaceScale(patched, "FLIGHT_MODEL_RANGE_M", (indent) => `${flightScaleCode(indent)}\n  `);
	patched = replaceScale(patched, "SHIP_MODEL_RANGE_M", (indent) => `${shipScaleCode(indent)}\n  `);

	patched = replaceLastArgument(
		patched,
		FLIGHT_MODEL_ANCHOR,
		`// ${FLIGHT_NO_CLUSTER_MARKER} conserva su marca y su etiqueta a cualquier\n        // zoom; agruparlo dejaba el indicativo detrás de un «40 aeronaves».\n        0`,
	);
	patched = replaceLastArgument(
		patched,
		SHIP_MODEL_ANCHOR,
		`// ${SHIP_NO_CLUSTER_MARKER} conserva su nombre y su marca a cualquier zoom:\n        // en un puerto, agruparlos escondía qué barco era cada uno.\n        0`,
	);

	return { source: patched, changed: patched !== source };
}
