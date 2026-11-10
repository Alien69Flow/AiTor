/**
 * Marcas del arcade extendido.
 *
 * Los juegos que no entran en la liga del servidor (escalera orbital, OVNI,
 * kart, cruce y combate) guardan su mejor marca en el navegador con la misma
 * regla que `mini-games.ts`: si no hay almacenamiento, la marca es un extra y
 * nunca un motivo para romper la partida.
 */

/** Clave de almacenamiento de un juego; una sola función para no duplicarla. */
export function arcadeBestKey(id: string): string {
	return `aitor.arcade.${id}`;
}

/** Mejor marca guardada, o 0 si no hay ninguna o el valor no sirve. */
export function readArcadeBest(id: string): number {
	if (typeof window === "undefined") return 0;
	try {
		const raw = Number(window.localStorage.getItem(arcadeBestKey(id)));
		return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
	} catch {
		return 0;
	}
}

/** Guarda la marca sólo si mejora la anterior y devuelve la que queda. */
export function saveArcadeBest(id: string, score: number): number {
	const rounded = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
	const best = Math.max(readArcadeBest(id), rounded);
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(arcadeBestKey(id), String(best));
		} catch {
			// Modo privado o cuota llena: la marca se pierde, no la pantalla.
		}
	}
	return best;
}
