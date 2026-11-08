/**
 * Modelos 3D de transporte del globo y qué modelo le toca a cada contacto.
 *
 * Hasta ahora vuelos y barcos se dibujaban con un icono SVG de 32 px: legible a
 * escala global, pero al acercarse no había ni fuselaje ni casco, sólo una
 * pegatina girada. Cesium sí soporta glTF (`model`), así que a partir de cierta
 * distancia se cambia el icono por geometría real; lejos se queda el icono, que
 * es más barato y se lee mejor.
 *
 * Los GLB viven en `public/models/` y los genera
 * `scripts/build-transport-models.mjs`: son modelos low-poly propios, sin
 * licencias de terceros ni descargas en el build. Están hechos con lofts de
 * secciones —fuselaje que se afina en el morro, ala con flecha y diedro, casco
 * con proa afilada—, no con cajas: a la distancia del globo se ve la silueta y
 * una caja no se lee como un avión. Ejes glTF 2.0 (+Y arriba, +Z al morro),
 * que es lo que Cesium espera desde la 1.47.
 */

export interface TransportModel {
  /** Ruta pública del GLB. */
  url: string;
  /** Eslora real del modelo en metros (para escalar y para la ficha). */
  lengthM: number;
  label: string;
}

export const TRANSPORT_MODELS = {
  airliner: { url: "/models/airliner.glb", lengthM: 45, label: "Avión de pasajeros" },
  helicopter: { url: "/models/helicopter.glb", lengthM: 15, label: "Helicóptero" },
  ship: { url: "/models/cargo-ship.glb", lengthM: 192, label: "Carguero" },
} as const satisfies Record<string, TransportModel>;

export type TransportModelKind = keyof typeof TRANSPORT_MODELS;

/**
 * Rumbo saneado, en grados desde el norte.
 *
 * AIS reserva el 511 para «rumbo no disponible» y algunas fuentes mandan ceros
 * de relleno o valores fuera de rango. Pasarlo tal cual dejaba el barco girado
 * 61° o el avión 34° sin motivo: cuando no hay rumbo se asume norte, que es lo
 * que hace un mapa náutico con un contacto sin gobierno.
 */
export function normalizedTrack(track?: number | null): number {
  return typeof track === "number" && Number.isFinite(track) && track >= 0 && track < 360
    ? track
    : 0;
}

/**
 * Rumbo en radianes para `Transforms.headingPitchRollQuaternion`.
 *
 * Ojo al convenio: en Cesium `heading = 0` mira al **este** (el +X local es el
 * este), mientras que ADS-B y AIS dan el rumbo en grados desde el **norte** y
 * en sentido horario. Pasar el rumbo tal cual dejaba aviones y barcos girados
 * 90°: volando «de lado». Aquí se resta el cuarto de vuelta y se normaliza.
 */
export function modelHeadingRadians(trackDegrees?: number | null): number {
  const normalized = ((normalizedTrack(trackDegrees) - 90) % 360 + 360) % 360;
  return (normalized * Math.PI) / 180;
}

/** Distancias (altura de cámara) a las que se cambia icono por modelo 3D. */
export const FLIGHT_MODEL_RANGE_M = 900_000;
export const SHIP_MODEL_RANGE_M = 700_000;

/**
 * Cuántos contactos llevan modelo 3D a la vez.
 *
 * Un modelo glTF cuesta bastante más que un billboard y la capa puede traer
 * cientos de aviones. Con el tope, el globo sigue fluido; el resto se queda con
 * el icono, que a esa distancia es lo mismo.
 */
export const FLIGHT_MODEL_LIMIT = 120;
export const SHIP_MODEL_LIMIT = 90;

/**
 * Tope de escala de los modelos.
 *
 * `minimumPixelSize` agranda el modelo hasta que mide unos píxeles en pantalla:
 * un avión de 44 m reales a 800 km es una centésima de píxel, así que sin ese
 * suelo no se vería nada justo en el rango en el que el icono ya se ha retirado.
 * El tope evita que a 900 km el avión se convierta en una pieza de decenas de
 * kilómetros con perspectiva imposible; dentro de los primeros kilómetros el
 * modelo se queda a escala real (1:1) y es donde importa.
 */
export const FLIGHT_MODEL_MAX_SCALE = 2_500;
export const SHIP_MODEL_MAX_SCALE = 600;

/**
 * Designadores ICAO de tipo de aeronave que son helicópteros.
 *
 * ADS-B no publica «esto es un helicóptero»: publica el tipo (`EC35`, `B407`…)
 * o nada. La lista cubre los modelos que de verdad aparecen en Europa y
 * América; lo que no esté aquí se dibuja como avión, que es la suposición
 * razonable porque es la mayoría del tráfico.
 */
const HELICOPTER_TYPES = new Set([
  "A109", "A119", "A139", "A169", "A189", "AS50", "AS55", "AS65", "AW09", "AW139",
  "B06", "B105", "B212", "B407", "B412", "B429", "B430", "B505",
  "CH47", "EC20", "EC25", "EC30", "EC35", "EC45", "EH10", "EXPL",
  "H125", "H130", "H135", "H145", "H160", "H500", "H60", "H64", "H47",
  "MD52", "MI8", "MI17", "MI24", "NH90", "R22", "R44", "R66", "S76", "S92",
  "UH1", "UH60",
]);

/** ¿El código de tipo corresponde a un helicóptero? */
export function isHelicopterType(aircraftType?: string | null): boolean {
  if (!aircraftType) return false;
  return HELICOPTER_TYPES.has(aircraftType.trim().toUpperCase());
}

/** Modelo que le toca a un vuelo, según el tipo de aeronave que declare. */
export function flightModelKind(flight: { aircraftType?: string | null }): TransportModelKind {
  return isHelicopterType(flight.aircraftType) ? "helicopter" : "airliner";
}

/**
 * Modelo de un buque. Hoy hay uno solo (carguero): la mayoría del tráfico AIS
 * son cargueros y petroleros, y distinguir un ferry de un portacontenedores a
 * 200 km no aporta nada. Se deja la función para que el día que haya modelos
 * por tipo no haya que tocar el renderizador.
 */
export function shipModelKind(_ship: { type?: string | null }): TransportModelKind {
  return "ship";
}
