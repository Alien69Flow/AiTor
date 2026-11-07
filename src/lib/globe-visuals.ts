/**
 * Los números que deciden cómo se ve el globo, en un solo sitio.
 *
 * Antes vivían repartidos: los alfas de las envolturas en `atmosphere-shells.ts`
 * y el filtro del radar dentro del efecto de `CesiumGlobe.tsx`. Para probar otra
 * intensidad había que editar el componente y volver a compilar, que es
 * exactamente lo que impide afinar mirando.
 *
 * Aquí hay **variantes con nombre**. Se elige una con `DEFAULT_*`, o sin tocar
 * código con `VITE_GLOBE_SHELLS` / `VITE_GLOBE_RADAR` en el despliegue.
 *
 * Dos avisos que vienen de medir, no de mirar:
 *
 *  - Los rellenos de los cascarones **se componen**, no se eligen: cuatro caras
 *    casi coincidentes dejan una veladura de `1 − Π(1−α)` sobre el planeta
 *    entero. Por eso cada variante declara su veladura y hay prueba que la
 *    mantiene por debajo del techo.
 *  - El radar de RainViewer llega con el croma bajo. Subir el **brillo** quema
 *    los ecos a blanco (con 1,1 el 34 % de los píxeles de eco saturaban, frente
 *    al 18 % de la tesela cruda); lo que separa intensidades es la **saturación**
 *    con el brillo en ~1.
 */

/** Cascarones que se dibujan: el orden es de dentro afuera. */
export const SHELL_COUNT = 4;

export interface ShellPreset {
	id: string;
	label: string;
	/** Relleno de cada cascarón, de dentro afuera. */
	fills: number[];
	/** Opacidad del anillo del limbo; es de donde se lee la escalera. */
	outlineAlpha: number;
	note: string;
}

export interface RadarPreset {
	id: string;
	label: string;
	/** Opacidad de la capa sobre el satélite. */
	alpha: number;
	/** Cesium: `ImageryLayer.saturation`. */
	saturation: number;
	/** Cesium: `ImageryLayer.brightness`. Por encima de 1 quema los ecos. */
	brightness: number;
	note: string;
}

/**
 * Tres intensidades de envoltura. La veladura resultante va en el comentario:
 * es lo que de verdad se ve sobre el satélite, no el alfa de cada capa.
 */
export const SHELL_PRESETS: ShellPreset[] = [
	{
		id: "tenue",
		label: "Tenue",
		fills: [0.016, 0.014, 0.013, 0.011],
		outlineAlpha: 0.22,
		note: "Casi sólo anillos: veladura del 5,3 %. Máximo contraste del satélite.",
	},
	{
		id: "equilibrado",
		label: "Equilibrado",
		fills: [0.024, 0.022, 0.02, 0.018],
		outlineAlpha: 0.35,
		note: "Veladura del 8,1 %: anillos legibles sin lechar el planeta.",
	},
	{
		id: "marcado",
		label: "Marcado",
		fills: [0.034, 0.031, 0.028, 0.025],
		outlineAlpha: 0.42,
		note: "Veladura del 11,3 %: capas muy presentes, el satélite pierde contraste.",
	},
];

/**
 * Tres lecturas del radar, medidas sobre una tesela real (2.497 px de eco):
 * `equilibrado` deja el recorte a blanco en el 18,8 % (el de la fuente) y los
 * píxeles lavados en 9,9 %; `contraste` no recorta nada y mantiene el croma;
 * `suave` se acerca a la tesela cruda y tapa menos el mapa.
 */
export const RADAR_PRESETS: RadarPreset[] = [
	{
		id: "suave",
		label: "Suave",
		alpha: 0.8,
		saturation: 1.15,
		brightness: 1.02,
		note: "Se parece a la tesela original: menos saturación y algo menos de opacidad.",
	},
	{
		id: "equilibrado",
		label: "Equilibrado",
		alpha: 0.85,
		saturation: 1.3,
		brightness: 0.98,
		note: "Recorte a blanco igual al de la fuente y píxeles lavados a la mitad.",
	},
	{
		id: "contraste",
		label: "Contraste",
		alpha: 0.88,
		saturation: 1.45,
		brightness: 0.95,
		note: "Sin píxeles quemados: cada intensidad conserva su color.",
	},
];

/** Techo de veladura: por encima, el planeta entero se ve lechoso. */
export const SHELL_VEIL_LIMIT = 0.12;

function envValue(key: string): string | undefined {
	try {
		const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[key];
		return typeof value === "string" && value.trim() ? value.trim() : undefined;
	} catch {
		return undefined;
	}
}

function pick<T extends { id: string }>(items: T[], wanted: string | undefined, fallback: string): T {
	return items.find((item) => item.id === wanted) ?? items.find((item) => item.id === fallback) ?? items[0];
}

/** Variante pedida en la URL: `?shells=tenue&radar=contraste`. */
function queryValue(key: string): string | undefined {
	try {
		if (typeof window === "undefined") return undefined;
		return new URLSearchParams(window.location.search).get(key) ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * Variante en uso, por orden de prioridad:
 *
 *  1. la URL (`?shells=tenue&radar=contraste`) — para comparar en el momento,
 *     sin desplegar nada;
 *  2. la variable de entorno del despliegue (`VITE_GLOBE_SHELLS`,
 *     `VITE_GLOBE_RADAR`);
 *  3. `equilibrado`.
 *
 * Ninguna de las tres obliga a tocar este componente ni `CesiumGlobe`.
 */
export const DEFAULT_SHELL_PRESET = pick(
	SHELL_PRESETS,
	queryValue("shells") ?? envValue("VITE_GLOBE_SHELLS"),
	"equilibrado",
);
export const DEFAULT_RADAR_PRESET = pick(
	RADAR_PRESETS,
	queryValue("radar") ?? envValue("VITE_GLOBE_RADAR"),
	"equilibrado",
);

/** Variante de envolturas por id; si no existe, la de por defecto. */
export function readShellPreset(id?: string): ShellPreset {
	return SHELL_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_SHELL_PRESET;
}

/** Variante de radar por id; si no existe, la de por defecto. */
export function readRadarPreset(id?: string): RadarPreset {
	return RADAR_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_RADAR_PRESET;
}

/** Alfa del cascarón `index` (0 = el de dentro). */
export function shellFill(preset: ShellPreset, index: number): number {
	return preset.fills[index] ?? preset.fills[preset.fills.length - 1] ?? 0;
}

/** Fracción del planeta que queda velada al apilar los rellenos. */
export function shellVeil(preset: ShellPreset): number {
	return 1 - preset.fills.reduce((clear, alpha) => clear * (1 - alpha), 1);
}

/** El mismo filtro en CSS, para poder medir una tesela sin abrir el globo. */
export function radarFilterCss(preset: RadarPreset): string {
	return `saturate(${preset.saturation}) brightness(${preset.brightness})`;
}
