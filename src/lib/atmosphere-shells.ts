/**
 * Las envolturas de la atmósfera, como cascarones alrededor del globo.
 *
 * El problema de dibujarlas a escala real es que no existen: entre la
 * troposfera (12 km) y la termosfera (600 km) hay, sobre un radio de 6.371 km,
 * una franja de menos del 10 %. A la distancia a la que se mira el planeta
 * entero —20.000 km— la atmósfera son dos píxeles. Por eso el globo dibuja
 * alturas **exageradas** y lo dice: los metros reales mandan en la ficha y en
 * las pruebas, y el radio visual sólo sirve para que la escalera se vea.
 *
 * Solo aparecen desde fuera (`SHELLS_VISIBLE_ABOVE_M`): de cerca se comen la
 * imagen satélite sin aportar nada.
 *
 * Aquí vive la **geometría** (radios, colores, qué capa es cuál). La intensidad
 * —relleno, anillo del limbo— está en `globe-visuals.ts`, con variantes, para
 * poder cambiarla sin tocar el componente.
 */

export interface AtmosphereShell {
	/** Identificador estable; también es el sufijo de la entidad de Cesium. */
	id: string;
	label: string;
	/** Techo real de la capa, en km (modelo estándar US 1976). */
	topKm: number;
	/** Radio visual sobre el nivel del mar, en km. Exagerado a propósito. */
	visualTopKm: number;
	/** Color del cascarón (CSS hex). */
	color: string;
}

/** Radio medio terrestre, en metros (el del elipsoide WGS84). */
export const EARTH_RADIUS_M = 6378137;

/**
 * Altura de cámara a partir de la cual se dibujan. Por debajo, el operador está
 * mirando una región y las envolturas solo enturbiarían la imagen.
 */
export const SHELLS_VISIBLE_ABOVE_M = 8_000_000;

/**
 * De dentro afuera. Los radios visuales crecen de forma monótona y guardan el
 * orden físico: si alguien cambia un número y rompe la escalera, la prueba lo
 * caza antes de que el globo dibuje una capa dentro de otra.
 */
export const ATMOSPHERE_SHELLS: AtmosphereShell[] = [
	{ id: "troposphere", label: "Troposfera", topKm: 12, visualTopKm: 120, color: "#38bdf8" },
	{ id: "stratosphere", label: "Estratosfera", topKm: 50, visualTopKm: 260, color: "#818cf8" },
	{ id: "mesosphere", label: "Mesosfera", topKm: 85, visualTopKm: 430, color: "#a78bfa" },
	{ id: "thermosphere", label: "Termosfera", topKm: 600, visualTopKm: 900, color: "#22d3ee" },
];

/** Radio visual de un cascarón, en metros (lo que espera Cesium). */
export function shellRadiusM(shell: AtmosphereShell): number {
	return EARTH_RADIUS_M + shell.visualTopKm * 1000;
}

/** Cuántas veces se exagera la altura real al dibujarla. */
export function shellExaggeration(shell: AtmosphereShell): number {
	return shell.visualTopKm / shell.topKm;
}
