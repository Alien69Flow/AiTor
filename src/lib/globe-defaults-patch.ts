/**
 * Parche de las capas que el globo enciende al abrirse.
 *
 * El catálogo (`src/lib/globe-layers.ts`) pasa de mil líneas: reescribirlo
 * entero para cambiar una lista es la forma más fácil de romper una capa que
 * hoy funciona. Aquí se sustituye **un solo bloque**,
 * `DEFAULT_ACTIVE_LAYERS`, con anclas literales, y la operación es todo o nada:
 * si el archivo no es el que se espera, no se toca y se devuelve el motivo.
 *
 * Qué enciende, y por qué:
 *
 *  - `atmosphericShells`: la escalera atmosférica dibujada —troposfera,
 *    estratosfera, termosfera— como cascarones translúcidos. Estaba en el
 *    catálogo y fuera de los valores por defecto, así que el panel la ofrecía
 *    y no se veía en ninguna parte.
 *  - `precipitationRate`: tasa de lluvia de GPM IMERG, medida por satélite. Se
 *    enciende **en lugar** del radar de RainViewer: pedir las dos apila dos
 *    campos azules sobre el mismo píxel y no se lee ninguna.
 *  - `temperature`: temperatura del aire de OpenWeather, familia `weather`, que
 *    no compite con las nubes (familia `clouds`) ni con la precipitación.
 *
 * Las cuatro están en familias distintas, así que respetan la regla del catálogo
 * —un campo por familia— y dejan el globo en tres capas de teselas de las ocho
 * que aguanta `MAX_RASTER_LAYERS`.
 */

/** Claves que este parche garantiza encendidas. */
export const PATCHED_DEFAULT_LAYERS = [
	"atmosphericShells",
	"clouds",
	"precipitationRate",
	"temperature",
] as const;

/** Capa que este parche apaga: el radar cede su sitio a IMERG. */
export const PATCHED_DISABLED_LAYER = "precipitation";

/** Declaración que abre el bloque, tal cual está en el catálogo. */
const ANCHOR_START = "export const DEFAULT_ACTIVE_LAYERS: EnvLayerKey[] = [";

/**
 * Bloque nuevo, con la convención del resto del catálogo: tabulación, una capa
 * por línea y el comentario explicando lo que no es obvio.
 */
const PATCHED_BLOCK = `export const DEFAULT_ACTIVE_LAYERS: EnvLayerKey[] = [
	// La atmósfera que se ve al abrir es la de Cesium (cielo y halo reales, con
	// dispersión del Sol) más sus envolturas dibujadas: troposfera, estratosfera
	// y termosfera como cascarones translúcidos. Con sólo el halo, la escalera
	// atmosférica no se podía ver desde fuera y el catálogo la anunciaba.
	"atmosphere",
	"atmosphericShells",
	// Meteo de entrada: nubes como contexto translúcido, tasa de lluvia del
	// satélite (GPM IMERG) y temperatura del aire. El radar de RainViewer queda
	// a un clic: encender IMERG y radar a la vez apila dos campos azules sobre
	// el mismo píxel.
	"clouds",
	"precipitationRate",
	"temperature",
	"wildfires",
	"earthquakes",
	"airTraffic",
	// Tráfico marítimo y conflictos: existían en el catálogo y había que
	// descubrirlos en el panel para que el planeta contara lo que pasa.
	"marineTraffic",
	"conflictZones",
	"marketData",
	"iss",
	"liveCameras",
	// Las dos esferas que el panel destaca, encendidas para que se vea de
	// entrada qué mide el globo más allá de la superficie.
	"vanAllen",
	"heliosphere",
];`;

export interface GlobeDefaultsPatchResult {
	ok: boolean;
	/** Fuente resultante. Si `ok` es `false`, es la de entrada sin tocar. */
	source: string;
	/** Se ha sustituido el bloque. */
	applied: boolean;
	/** Ya estaba aplicado: no hay nada que escribir. */
	already: boolean;
	problems: string[];
}

/** Claves declaradas en un fragmento de fuente, en orden de aparición. */
function declaredKeys(block: string): string[] {
	const keys: string[] = [];
	for (const match of block.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)) {
		keys.push(match[1]);
	}
	return keys;
}

/**
 * Aplica el parche. Idempotente: sobre una fuente ya parcheada devuelve
 * `already: true` y la misma cadena, byte por byte.
 */
export function applyGlobeDefaultsPatch(input: string): GlobeDefaultsPatchResult {
	const start = input.indexOf(ANCHOR_START);
	if (start === -1) {
		return {
			ok: false,
			source: input,
			applied: false,
			already: false,
			problems: [`No encuentro la declaración \`${ANCHOR_START}\` en el catálogo de capas.`],
		};
	}

	const closing = input.indexOf("];", start);
	if (closing === -1) {
		return {
			ok: false,
			source: input,
			applied: false,
			already: false,
			problems: ["La declaración de capas por defecto no se cierra con `];`."],
		};
	}

	const end = closing + 2;
	const current = input.slice(start, end);

	if (current === PATCHED_BLOCK) {
		return { ok: true, source: input, applied: false, already: true, problems: [] };
	}

	// Antes de sustituir se comprueba que lo que hay es una lista de capas y no
	// otra cosa: si alguien cambió el bloque por código con expresiones, cortar
	// aquí es mejor que dejar el archivo a medias.
	const problems: string[] = [];
	const currentKeys = declaredKeys(current);
	if (currentKeys.length < 5) {
		problems.push(
			`El bloque actual sólo declara ${currentKeys.length} capa(s); no parece la lista por defecto del catálogo.`,
		);
	}
	if (!current.trimEnd().endsWith("];")) {
		problems.push("El bloque actual no termina en `];`: el formato ha cambiado.");
	}

	// Comprobación sobre el resultado, no sobre la intención: si el bloque nuevo
	// dejara de declarar una clave pedida, el parche no se aplica.
	const patchedKeys = declaredKeys(PATCHED_BLOCK);
	for (const key of PATCHED_DEFAULT_LAYERS) {
		if (!patchedKeys.includes(key)) {
			problems.push(`El bloque nuevo no declara «${key}».`);
		}
	}
	if (patchedKeys.includes(PATCHED_DISABLED_LAYER)) {
		problems.push(`El bloque nuevo sigue declarando «${PATCHED_DISABLED_LAYER}».`);
	}
	if (new Set(patchedKeys).size !== patchedKeys.length) {
		problems.push("El bloque nuevo repite alguna capa.");
	}

	if (problems.length) {
		return { ok: false, source: input, applied: false, already: false, problems };
	}

	return {
		ok: true,
		source: input.slice(0, start) + PATCHED_BLOCK + input.slice(end),
		applied: true,
		already: false,
		problems: [],
	};
}
