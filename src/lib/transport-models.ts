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
 *
 * Este módulo no importa Cesium ni toca el DOM: son cuentas puras, y por eso
 * las pruebas las comprueban sin montar el visor.
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

/** ¿El nombre corresponde a un modelo que de verdad existe en `public/models`? */
export function isTransportModelKind(value: string): value is TransportModelKind {
  return Object.prototype.hasOwnProperty.call(TRANSPORT_MODELS, value);
}

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

/**
 * Distancias (altura de cámara) a las que se cambia icono por modelo 3D.
 *
 * Estaban en 900 km (vuelos) y 700 km (barcos): justo por debajo de la vista
 * de continente, así que al alejar un poco el globo todo volvía a ser una
 * pegatina. Ahora el modelo entra antes y se encoge solo (ver `modelScale`),
 * que es lo que hacía falta para que un avión se leyera como avión mientras se
 * sigue viendo el mapa.
 */
export const FLIGHT_MODEL_RANGE_M = 2_600_000;
export const SHIP_MODEL_RANGE_M = 1_800_000;

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
 * un avión de 45 m reales a 800 km es una centésima de píxel, así que sin ese
 * suelo no se vería nada justo en el rango en el que el icono ya se ha retirado.
 * El tope evita que a 2 600 km el avión se convierta en una pieza de decenas de
 * kilómetros con perspectiva imposible. Con el reparto por altura de
 * `modelScale` estos topes quedan como red de seguridad, no como el valor de
 * trabajo: a su distancia máxima cada modelo se queda por debajo.
 */
export const FLIGHT_MODEL_MAX_SCALE = 2_500;
export const SHIP_MODEL_MAX_SCALE = 600;

/** Tamaño en pantalla que se busca para cada modelo, en píxeles. */
export const FLIGHT_MODEL_TARGET_PX = 26;
export const SHIP_MODEL_TARGET_PX = 40;

/**
 * Campo de visión vertical de Cesium por defecto, en radianes (60°).
 *
 * Con él, y la altura de cámara, se sabe cuántos metros cubre un píxel: es la
 * cuenta que convierte «quiero que mida 26 px» en una escala concreta.
 */
export const CESIUM_DEFAULT_FOV_Y = Math.PI / 3;

interface ModelView {
  targetPx: number;
  maxScale: number;
}

/**
 * Cómo se ve cada modelo. Es un `Record` sobre los tipos existentes a
 * propósito: el día que se añada un GLB nuevo, TypeScript obliga a decidir su
 * tamaño en pantalla en vez de dejarlo con un valor por defecto silencioso.
 */
const MODEL_VIEW: Record<TransportModelKind, ModelView> = {
  airliner: { targetPx: FLIGHT_MODEL_TARGET_PX, maxScale: FLIGHT_MODEL_MAX_SCALE },
  helicopter: { targetPx: FLIGHT_MODEL_TARGET_PX, maxScale: FLIGHT_MODEL_MAX_SCALE },
  ship: { targetPx: SHIP_MODEL_TARGET_PX, maxScale: SHIP_MODEL_MAX_SCALE },
};

export interface ModelScaleInput {
  /** Altura de la cámara sobre el suelo, en metros. */
  cameraHeightM: number;
  /** Alto del canvas en píxeles (no del CSS lógico: píxeles de dibujo). */
  viewportHeightPx: number;
  /** Eslora o envergadura real del modelo, en metros. */
  lengthM: number;
  targetPx?: number;
  fovY?: number;
  maxScale?: number;
}

/**
 * Escala para que un modelo de `lengthM` metros ocupe `targetPx` píxeles a la
 * altura de cámara dada.
 *
 * Antes había una escala fija por tipo (2 500 para vuelos, 600 para barcos) que
 * se aplicaba igual a 5 km que a 900 km: de cerca el avión era un mamotreto de
 * kilómetros y de lejos se perdía. La escala correcta depende de la altura,
 * porque lo que se quiere fijar es el tamaño **en pantalla**:
 *
 *   metrosPorPíxel = 2 · altura · tan(fov/2) / altoDelCanvas
 *   escala         = objetivo_px · metrosPorPíxel / eslora
 *
 * Se acota a [1, maxScale]. El suelo en 1 es importante: por debajo de 1 el
 * modelo encogería por debajo de su tamaño real y un petrolero de 250 m se
 * vería más pequeño que el muelle que tiene al lado.
 *
 * Cualquier entrada inválida (NaN, cero, negativa) devuelve 1: es preferible un
 * modelo a escala real que un `NaN` que Cesium traduce en geometría invisible.
 */
export function modelScaleForCamera(input: ModelScaleInput): number {
  const {
    cameraHeightM,
    viewportHeightPx,
    lengthM,
    targetPx = FLIGHT_MODEL_TARGET_PX,
    fovY = CESIUM_DEFAULT_FOV_Y,
    maxScale = FLIGHT_MODEL_MAX_SCALE,
  } = input;

  const valid =
    Number.isFinite(cameraHeightM) && cameraHeightM > 0 &&
    Number.isFinite(viewportHeightPx) && viewportHeightPx > 0 &&
    Number.isFinite(lengthM) && lengthM > 0 &&
    Number.isFinite(targetPx) && targetPx > 0 &&
    Number.isFinite(fovY) && fovY > 0 && fovY < Math.PI &&
    Number.isFinite(maxScale) && maxScale >= 1;
  if (!valid) return 1;

  const metersPerPixel = (2 * cameraHeightM * Math.tan(fovY / 2)) / viewportHeightPx;
  const wanted = (targetPx * metersPerPixel) / lengthM;
  if (!Number.isFinite(wanted)) return 1;
  return Math.min(maxScale, Math.max(1, wanted));
}

/** Lo mismo, pero eligiendo el modelo por su tipo y sin repetir constantes. */
export function modelScale(
  kind: TransportModelKind,
  cameraHeightM: number,
  viewportHeightPx: number,
): number {
  const view = MODEL_VIEW[kind];
  return modelScaleForCamera({
    cameraHeightM,
    viewportHeightPx,
    lengthM: TRANSPORT_MODELS[kind].lengthM,
    targetPx: view.targetPx,
    maxScale: view.maxScale,
  });
}

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

/** Familia de un buque, deducida del tipo AIS. */
export type ShipClass = "tanker" | "container" | "ferry" | "cargo" | "other";

/**
 * Palabras que aparecen en los campos de tipo de AIS y de los agregadores.
 * Se comparan sobre el texto en minúsculas y sin acentos de puntuacion.
 */
const SHIP_CLASS_WORDS: [ShipClass, string[]][] = [
  ["container", ["container", "boxship", "box ship", "portacontenedor"]],
  ["tanker", ["tanker", "petrol", "crude", "lng", "lpg", "chemical", "oil products", "product carrier"]],
  ["ferry", ["ferry", "ro-ro", "roro", "ro ro", "ro pax", "ropax", "passenger", "cruise", "fast ferry"]],
  ["cargo", ["cargo", "bulk", "freight", "general", "car carrier", "livestock"]],
];

/**
 * Clase de buque a partir del tipo que publica el feed.
 *
 * AIS manda un número del 0 al 99 en `shipType` y cada agregador lo traduce a
 * su manera: unos pasan el número («80»), otros el nombre del grupo
 * («Tanker») y otros una descripción larga («Oil Products Tanker»). Todo eso
 * acaba en el mismo `type` de la capa, así que aquí se acepta cualquiera de
 * las tres formas.
 *
 * Rangos AIS relevantes: 60–69 pasaje, 70–79 carga, 80–89 petroleros. Un
 * petrolero dibujado como carguero es un error de lectura del mapa, no un
 * detalle: son 250 m de eslora y cubierta llena de tuberías.
 */
export function shipClassOf(type?: string | number | null): ShipClass {
  if (type === null || type === undefined) return "other";
  const raw = String(type).trim();
  if (!raw) return "other";

  // Código AIS numérico (con el 0 delante que algunos feeds conservan).
  const code = Number(raw);
  if (Number.isFinite(code) && /^\d{1,2}$/.test(raw)) {
    if (code >= 80 && code <= 89) return "tanker";
    if (code >= 70 && code <= 79) return "cargo";
    if (code >= 60 && code <= 69) return "ferry";
    return "other";
  }

  const words = raw.toLowerCase();
  for (const [shipClass, needles] of SHIP_CLASS_WORDS) {
    if (needles.some((needle) => words.includes(needle))) return shipClass;
  }
  return "other";
}

/**
 * Qué kind de modelo corresponde a cada clase de buque.
 *
 * Son nombres candidatos: `shipModelKind` sólo los devuelve si el GLB está
 * declarado en `TRANSPORT_MODELS`, de modo que un petrolero nunca intenta
 * cargar `/models/tanker.glb` antes de que el generador lo haya creado. Hoy
 * sólo existe el carguero, así que todo cae en `ship`; cuando los tres GLB
 * estén generados basta con añadirlos a `TRANSPORT_MODELS` y esta tabla los
 * empieza a usar sola, sin tocar el renderizador.
 */
const SHIP_CLASS_MODEL: Record<ShipClass, string> = {
  tanker: "tanker",
  container: "container",
  ferry: "ferry",
  cargo: "ship",
  other: "ship",
};

/** Modelo de un buque según su tipo; cae en el carguero si aún no hay GLB propio. */
export function shipModelKind(ship: { type?: string | number | null } | null | undefined): TransportModelKind {
  const candidate = SHIP_CLASS_MODEL[shipClassOf(ship?.type)];
  return isTransportModelKind(candidate) ? candidate : "ship";
}
