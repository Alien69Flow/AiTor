/**
 * Cuánto detalle pedir según lo cerca que esté la cámara.
 *
 * Vive fuera del componente porque es la parte que se puede comprobar sin GPU:
 * con el globo entero en pantalla no tiene sentido pedir teselas de 0,9 px
 * (sólo se satura la red), y a 300 km de altura sí, porque es lo que separa una
 * foto estirada de un mapa nítido.
 *
 * Los tres umbrales, en metros de altura de cámara:
 *
 *  - `CLOSE_DETAIL_M` (1.200 km): por debajo se aprieta el error de pantalla a
 *    0,9 y se empieza a ver el nivel real de la imagen de Esri.
 *  - `MEDIUM_DETAIL_M` (6.000 km): continente. 1,2 px, suficiente para que las
 *    costas no se vean escalonadas sin pedir cientos de teselas.
 *  - `PLACES_MAX_M` (2.500 km): fronteras y topónimos. Más lejos son ruido y,
 *    además, cada tesela de la capa de referencia cubre medio planeta.
 */

export const CLOSE_DETAIL_M = 1_200_000;
export const MEDIUM_DETAIL_M = 6_000_000;
export const PLACES_MAX_M = 2_500_000;

export interface GlobeDetail {
	/** Error de pantalla máximo que se le pasa a Cesium (px). */
	maximumScreenSpaceError: number;
	/** Fronteras y nombres de sitios. */
	showPlaces: boolean;
}

export function resolveGlobeDetail(altitudeM: number): GlobeDetail {
	const altitude = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : Infinity;
	return {
		maximumScreenSpaceError:
			altitude < CLOSE_DETAIL_M ? 0.9 : altitude < MEDIUM_DETAIL_M ? 1.2 : 1.6,
		showPlaces: altitude < PLACES_MAX_M,
	};
}
