/**
 * Dónde está cada cámara del Alien, para poder pintarla en el globo.
 *
 * `LIVE_SIGNALS` guarda la sede como texto libre («Oulu, Finlandia»), no como
 * coordenadas: es lo que se lee en la ficha y lo que publica el canal. Esta
 * tabla traduce ese texto a un punto para el globo, sin tocar las 323 fichas.
 *
 * Dos reglas, para no fingir precisión que no existe:
 *
 *  - Cuando la sede es un sitio concreto (un volcán, un observatorio, una
 *    rampa) el punto es el del sitio, no el del país.
 *  - Cuando sólo se conoce la región («Sudáfrica», «Alaska, EE. UU.») el punto
 *    es representativo y va marcado `approximate`, que el globo escribe tal
 *    cual en la ficha de la cámara.
 *
 * Las sedes que no son un lugar del planeta (órbita, Marte, «Global», canales
 * que agrupan varias cámaras) se quedan en `UNPLACEABLE_LOCATIONS` y no se
 * pintan: un marcador en el punto (0, 0) del Atlántico sería peor que nada.
 */

import { LIVE_CATEGORIES, LIVE_SIGNALS, type LiveCategoryId, type LiveSignal } from "./live-signals";

export interface CameraPlace {
  lat: number;
  lon: number;
  /** El punto es representativo de una región, no la sede exacta. */
  approximate?: boolean;
}

/** Cámara lista para pintar en el globo. */
export interface PlacedCamera {
  id: string;
  label: string;
  source: string;
  official: boolean;
  category: LiveCategoryId;
  categoryLabel: string;
  lat: number;
  lon: number;
  approximate: boolean;
}

/** Sedes que no corresponden a un punto de la Tierra. */
export const UNPLACEABLE_LOCATIONS: readonly string[] = [
  "Acuario",
  "Interior",
  "Norte",
  "África",
  "Emisión 24/7",
  "Emisiones de misión",
  "Espacio profundo",
  "Estados Unidos",
  "Etna · Kīlauea · Stromboli",
  "Florida · California",
  "Global",
  "Marte",
  "Red sísmica global",
  "Varias cámaras del mundo",
  "Órbita baja terrestre",
  "Órbita geoestacionaria",
  "Órbita solar",
  "Órbita terrestre",
];

/** Sede → punto. Ver la cabecera para el criterio de precisión. */
export const CAMERA_PLACES: Record<string, CameraPlace> = {
  // --- Volcanes ------------------------------------------------------------
  "Ariccia, Italia": { lat: 41.72, lon: 12.67 },
  "Batangas, Filipinas": { lat: 13.76, lon: 121.06 },
  "Amazonía, Ecuador": { lat: -0.08, lon: -77.66 },
  "Halemaʻumaʻu, Hawái": { lat: 19.406, lon: -155.283 },
  "Huelva, Andalucía": { lat: 37.19, lon: -6.94 },
  "Java Oriental, Indonesia": { lat: -7.94, lon: 112.95 },
  "Java Occidental, Indonesia": { lat: -6.79, lon: 107.6 },
  "Java, Indonesia": { lat: -7.5, lon: 110.5, approximate: true },
  "Kagoshima, Japón": { lat: 31.6, lon: 130.56 },
  "Kumamoto, Japón": { lat: 32.79, lon: 130.74 },
  "Morona Santiago, Ecuador": { lat: -2.0, lon: -78.34 },
  "Nápoles, Italia": { lat: 40.85, lon: 14.27 },
  "Negros, Filipinas": { lat: 10.41, lon: 123.13 },
  "Península de Reykjanes, Islandia": { lat: 63.88, lon: -22.45 },
  "Pozzuoli, Italia": { lat: 40.83, lon: 14.12 },
  "Prato, Italia": { lat: 43.88, lon: 11.1 },
  "Puebla, México": { lat: 19.02, lon: -98.62 },
  "Quetzaltenango, Guatemala": { lat: 14.83, lon: -91.52 },
  "Reykjanes, Islandia": { lat: 63.88, lon: -22.5 },
  "Sicilia, Italia": { lat: 37.75, lon: 14.99 },
  "Tenerife, España": { lat: 28.29, lon: -16.62 },
  "Tarangire, Tanzania": { lat: -3.83, lon: 36.0 },
  "Yasugi, Shimane (Japón)": { lat: 35.41, lon: 133.25 },
  "Posada de Valdeón, León": { lat: 43.15, lon: -4.92 },

  // --- Fauna y flora -------------------------------------------------------
  "Bahía de Betty, Sudáfrica": { lat: -34.35, lon: 18.89 },
  "Bahía de Monterey, California": { lat: 36.8, lon: -121.9 },
  "Baltimore, Maryland": { lat: 39.29, lon: -76.61 },
  "Budle Bay, Reino Unido": { lat: 55.63, lon: -1.75 },
  "Cañón de Hellgate, Montana": { lat: 46.85, lon: -113.7 },
  "Colorado Springs, Colorado": { lat: 38.83, lon: -104.82 },
  "Cresswell, Reino Unido": { lat: 55.23, lon: -1.55 },
  "Desierto alto, California": { lat: 35.0, lon: -117.0, approximate: true },
  "Dürnten, Suiza": { lat: 47.28, lon: 8.84 },
  "Gatlinburg, Tennessee": { lat: 35.71, lon: -83.51 },
  "Gautegiz Arteaga, Bizkaia": { lat: 43.36, lon: -2.65 },
  "Isla Catalina, California": { lat: 33.39, lon: -118.42 },
  "Las Vegas, Nevada": { lat: 36.17, lon: -115.14 },
  "Masai Mara, Kenya": { lat: -1.4, lon: 35.0 },
  "Mauna Kea, Hawái": { lat: 19.82, lon: -155.47 },
  "Parque Nacional Katmai, Alaska": { lat: 58.27, lon: -155.0 },
  "Río Brooks, Alaska": { lat: 58.55, lon: -155.8 },
  "Sabana, Sudáfrica": { lat: -24.5, lon: 27.5, approximate: true },
  "Silver Springs, Florida": { lat: 29.22, lon: -82.05 },
  "Somerset, Reino Unido": { lat: 51.1, lon: -2.9 },
  "Otago, Nueva Zelanda": { lat: -45.4, lon: 170.2 },

  // --- Auroras, meteoros y observatorios -----------------------------------
  "Aizu-Wakamatsu, Fukushima": { lat: 37.49, lon: 139.93 },
  "Alemania": { lat: 51.2, lon: 10.4, approximate: true },
  "Budapest, Hungría": { lat: 47.5, lon: 19.04 },
  "Finlandia": { lat: 64.5, lon: 26.5, approximate: true },
  "Groenlandia": { lat: 72.0, lon: -40.0, approximate: true },
  "Islandia": { lat: 64.9, lon: -19.0, approximate: true },
  "Laponia sueca": { lat: 67.5, lon: 18.0, approximate: true },
  "Laponia, Finlandia": { lat: 67.95, lon: 26.15 },
  "Posio, Finlandia": { lat: 66.07, lon: 28.17 },
  "Reikiavik, Islandia": { lat: 64.15, lon: -21.94 },
  "Reikjanes, Islandia": { lat: 63.88, lon: -22.45 },
  "Rovaniemi, Finlandia": { lat: 66.5, lon: 25.73 },
  "Dayton, Ohio": { lat: 39.76, lon: -84.19 },
  "Nepal": { lat: 27.99, lon: 86.93 },
  "Eslovaquia": { lat: 48.7, lon: 19.5, approximate: true },
  "Míchigan, EE. UU.": { lat: 44.0, lon: -85.0, approximate: true },
  "Nagaokakyo, Kioto": { lat: 34.93, lon: 135.7 },
  "Noruega": { lat: 61.5, lon: 9.0, approximate: true },
  "Oulu, Finlandia": { lat: 65.01, lon: 25.47 },
  "Pasadena, California": { lat: 34.15, lon: -118.14 },
  "República Checa": { lat: 49.8, lon: 15.5, approximate: true },
  "Reino Unido": { lat: 54.0, lon: -2.5, approximate: true },
  "Tokio, Japón": { lat: 35.68, lon: 139.69 },
  "Tracy, California": { lat: 37.74, lon: -121.43 },
  "Vandenberg, California": { lat: 34.63, lon: -120.58 },
  "Yeda, Arabia Saudí": { lat: 21.49, lon: 39.19 },

  // --- Lanzamientos --------------------------------------------------------
  "Boca Chica, Texas": { lat: 25.997, lon: -97.155 },
  "Cabo Cañaveral, Florida": { lat: 28.47, lon: -80.57 },
  "Costa Espacial, Florida": { lat: 28.4, lon: -80.6 },
  "Del Rio, Texas": { lat: 29.37, lon: -100.9 },
  "Kennedy Space Center, Florida": { lat: 28.57, lon: -80.65 },
  "McGregor, Texas": { lat: 31.44, lon: -97.4 },
  "Tanegashima, Japón": { lat: 30.4, lon: 130.97 },

  // --- Sismos --------------------------------------------------------------
  "Chile": { lat: -30.0, lon: -71.0, approximate: true },
  "Ciudad de México": { lat: 19.43, lon: -99.13 },
  "Costa Rica": { lat: 9.75, lon: -83.75, approximate: true },
  "Filipinas": { lat: 12.9, lon: 122.0, approximate: true },
  "Guatemala": { lat: 14.8, lon: -90.5, approximate: true },
  "Hawái": { lat: 19.6, lon: -155.5, approximate: true },
  "Indonesia": { lat: -2.5, lon: 118.0, approximate: true },
  "Italia": { lat: 42.5, lon: 12.5, approximate: true },
  "Japón": { lat: 36.2, lon: 138.25, approximate: true },
  "Nueva Zelanda": { lat: -41.0, lon: 174.0, approximate: true },
  "Santiago, Chile": { lat: -33.45, lon: -70.67 },
  "Sichuan, China": { lat: 30.6, lon: 104.06 },
  "Taiwán": { lat: 23.7, lon: 120.96, approximate: true },

  // --- Tráfico aéreo -------------------------------------------------------
  "Atlanta, EE. UU. (KATL)": { lat: 33.64, lon: -84.43 },
  "Boston, Massachusetts": { lat: 42.36, lon: -71.06 },
  "Dallas–Fort Worth, EE. UU. (KDFW)": { lat: 32.9, lon: -97.03 },
  "Kaohsiung, Taiwán": { lat: 22.62, lon: 120.3 },
  "Los Ángeles, EE. UU.": { lat: 34.05, lon: -118.24 },
  "Seattle, Washington": { lat: 47.61, lon: -122.33 },
  "Shoreham, Reino Unido": { lat: 50.83, lon: -0.27 },
  "Sint Maarten": { lat: 18.04, lon: -63.06 },
  "Dallas": { lat: 32.9, lon: -97.03 },
  "Hong Kong": { lat: 22.31, lon: 113.91 },
  "Islas Canarias": { lat: 28.95, lon: -13.6 },
  "Las Vegas": { lat: 36.08, lon: -115.15 },
  "Los Ángeles": { lat: 33.94, lon: -118.4 },
  "Madeira": { lat: 32.69, lon: -16.77 },
  "Miami": { lat: 25.79, lon: -80.29 },
  "Milwaukee": { lat: 42.95, lon: -87.9 },
  "Nueva Orleans": { lat: 29.99, lon: -90.26 },
  "Reno": { lat: 39.5, lon: -119.77 },
  "San Francisco": { lat: 37.62, lon: -122.38 },
  "Seattle": { lat: 47.45, lon: -122.31 },
  // La ficha dice «Australia» pero la cámara es la pista 23 de Adelaida.
  "Australia": { lat: -34.94, lon: 138.53, approximate: true },
  // Igual: la ficha dice «Canadá» y la cámara está en Montreal.
  "Canadá": { lat: 45.47, lon: -73.74, approximate: true },
  "Minnesota": { lat: 44.88, lon: -93.22 },

  // --- Cobertura regional --------------------------------------------------
  "Alaska": { lat: 63.0, lon: -150.0, approximate: true },
  "Alaska, EE. UU.": { lat: 63.0, lon: -150.0, approximate: true },
  "Arizona": { lat: 34.0, lon: -111.7, approximate: true },
  "Botsuana": { lat: -22.3, lon: 24.7, approximate: true },
  "California": { lat: 36.5, lon: -120.5, approximate: true },
  "California, EE. UU.": { lat: 37.0, lon: -120.0, approximate: true },
  "Carolina del Norte, EE. UU.": { lat: 35.5, lon: -79.0, approximate: true },
  "Columbia Británica": { lat: 53.5, lon: -125.0, approximate: true },
  "Ecuador": { lat: -1.8, lon: -78.2, approximate: true },
  "Florida": { lat: 27.8, lon: -81.7, approximate: true },
  "Florida, EE. UU.": { lat: 27.8, lon: -81.7, approximate: true },
  "Georgia, EE. UU.": { lat: 32.8, lon: -83.5, approximate: true },
  "Illinois, EE. UU.": { lat: 40.0, lon: -89.2, approximate: true },
  "Iowa": { lat: 43.3, lon: -91.79, approximate: true },
  "Kenia": { lat: 0.5, lon: 37.5, approximate: true },
  "Kenya": { lat: 0.5, lon: 37.5, approximate: true },
  "KwaZulu-Natal, Sudáfrica": { lat: -28.5, lon: 30.5, approximate: true },
  "Maine, EE. UU.": { lat: 45.0, lon: -69.0, approximate: true },
  "México": { lat: 23.6, lon: -102.5, approximate: true },
  "Namibia": { lat: -22.5, lon: 17.0, approximate: true },
  "Nevada, EE. UU.": { lat: 39.0, lon: -117.0, approximate: true },
  "Nueva York": { lat: 40.71, lon: -74.0, approximate: true },
  "Nueva York, EE. UU.": { lat: 40.71, lon: -74.0, approximate: true },
  "Ohio": { lat: 40.4, lon: -82.8, approximate: true },
  "Ohio, EE. UU.": { lat: 40.4, lon: -82.8, approximate: true },
  "Portugal": { lat: 39.5, lon: -8.0, approximate: true },
  "Ruanda": { lat: -1.94, lon: 29.87, approximate: true },
  "Sudáfrica": { lat: -29.0, lon: 24.0, approximate: true },
  "Texas": { lat: 31.0, lon: -99.0, approximate: true },
  "Texas, EE. UU.": { lat: 31.0, lon: -99.0, approximate: true },
  "Victoria, Australia": { lat: -36.5, lon: 144.0, approximate: true },
  "Zimbabue": { lat: -19.0, lon: 29.8, approximate: true },
};

const UNPLACEABLE = new Set(UNPLACEABLE_LOCATIONS);

/**
 * Punto del globo para una sede del Alien. `null` cuando la sede no es un punto
 * de la Tierra (órbita, «Global», canales multi-sede): esas cámaras no se
 * pintan en lugar de aparecer en un punto inventado.
 */
export function placeForLocation(location: string): CameraPlace | null {
  return CAMERA_PLACES[location] ?? null;
}

/** Sedes que sabemos que no se pueden situar (para el inventario y las pruebas). */
export function isUnplaceable(location: string): boolean {
  return UNPLACEABLE.has(location);
}

/** Punto de una cámara concreta, `null` si su sede no es situable. */
export function cameraPlace(signal: Pick<LiveSignal, "location">): CameraPlace | null {
  return placeForLocation(signal.location);
}

const CATEGORY_LABELS = new Map(LIVE_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * Las cámaras que el globo puede dibujar. Se calcula una vez sobre la lista
 * curada: las sedes orbitales, «Global» y los canales multi-sede se quedan
 * fuera, y el globo informa de cuántas quedaron fuera en vez de esconderlo.
 */
export function placedCameras(signals: readonly LiveSignal[] = LIVE_SIGNALS): PlacedCamera[] {
  const out: PlacedCamera[] = [];
  for (const signal of signals) {
    const place = cameraPlace(signal);
    if (!place) continue;
    out.push({
      id: signal.id,
      label: signal.label,
      source: signal.source,
      official: signal.official,
      category: signal.category,
      categoryLabel: CATEGORY_LABELS.get(signal.category) ?? signal.category,
      lat: place.lat,
      lon: place.lon,
      approximate: place.approximate === true,
    });
  }
  return out;
}

/** Reparto entre cámaras situadas en el globo y cámaras sin sede terrena. */
export function cameraCoverage(signals: readonly LiveSignal[] = LIVE_SIGNALS) {
  const placed = placedCameras(signals).length;
  return { placed, unplaceable: signals.length - placed, total: signals.length };
}
