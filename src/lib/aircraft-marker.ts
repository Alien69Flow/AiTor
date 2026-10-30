import { aircraftSilhouette } from "./aircraft-silhouette";

/**
 * Icono de aeronave del globo.
 *
 * Vive fuera del componente por dos motivos: se puede probar sin contexto WebGL
 * y se puede mirar en un banco de pruebas sin cargar Cesium entero.
 *
 * Legibilidad sobre un mapa satelital, que es donde fallaba: el avión era una
 * silueta verde con borde oscuro de 1 px, así que sobre tierra verde
 * desaparecía y sobre nubes claras se perdía el contorno. Cada figura se dibuja
 * con un halo claro debajo —separa del océano y de la vegetación— y un contorno
 * oscuro encima —separa de la nieve y de las nubes—: el mismo icono funciona
 * sobre cualquier fondo sin cambiar de color.
 */

/** Geometría simple y gruesa a propósito: a 30 px, un ala con quiebres es una mancha. */
const SILHOUETTES: Record<string, string> = {
  plane:
    `<path d="M20 2.5 23 12.5 37.5 21.5 37.5 25 23 21.5 22.6 31 28.5 35 28.5 37.5 20 35.2 11.5 37.5 11.5 35 17.4 31 17 21.5 2.5 25 2.5 21.5 17 12.5Z"/>`,
  helicopter:
    `<path d="M17.6 11.5h4.8v6.5l7.2 2.4v3.2l-7.2-1.1v4.6l3 2.6v2.2L20 30.4l-5.4 1.1v-2.2l3-2.6v-4.6l-7.2 1.1v-3.2l7.2-2.4Z"/>` +
    `<path d="M4 8.5h32v2.4H4z"/><path d="M18.9 3.2h2.2v3.6h-2.2z"/><path d="M16 33.4h8v2.2h-8z"/>`,
  balloon:
    `<path d="M20 3.5c5.4 0 9.6 4.3 9.6 9.7 0 6-6.3 11.8-8.4 13.6l-2.4 0c-2.1-1.8-8.4-7.6-8.4-13.6C10.4 7.8 14.6 3.5 20 3.5Z"/>` +
    `<path d="M17.2 27.2h5.6l1.6 5.2h-8.8z"/><path d="M16.4 33.4h7.2v3.2h-7.2z"/>`,
  drone:
    `<path d="M16.6 16.6 23.4 23.4 21.8 25 15 18.2Z"/><path d="M23.4 16.6 16.6 23.4 15 21.8 21.8 15Z"/>` +
    `<circle cx="11" cy="11" r="5"/><circle cx="29" cy="11" r="5"/><circle cx="11" cy="29" r="5"/><circle cx="29" cy="29" r="5"/><circle cx="20" cy="20" r="5.2"/>`,
};

/** Colores de los dos trazos, para que la prueba pueda comprobarlos. */
export const MARKER_HALO = "#F8FAFC";
export const MARKER_EDGE = "#0B1220";

/** SVG del marcador, como `data:` URI listo para un billboard de Cesium. */
export function aircraftMarkerIcon(
  category: string | null | undefined,
  color: string,
): string {
  const shape = aircraftSilhouette(category);
  const body = SILHOUETTES[shape] ?? SILHOUETTES.plane;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    `<g fill="none" stroke="${MARKER_HALO}" stroke-opacity=".95" stroke-width="4.5" stroke-linejoin="round">${body}</g>` +
    `<g fill="${color}" stroke="${MARKER_EDGE}" stroke-width="1.6" stroke-linejoin="round">${body}</g>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** El SVG legible, para pruebas y para el banco de pruebas visual. */
export function aircraftMarkerSvg(
  category: string | null | undefined,
  color: string,
): string {
  return decodeURIComponent(aircraftMarkerIcon(category, color).split(",")[1] ?? "");
}
