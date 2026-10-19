/**
 * Curated live signals for the anomaly monitor.
 *
 * Every entry was checked from the build machine before being listed:
 *  - `youtube.com/oembed` returns 200 → the video exists AND its owner allows
 *    being embedded (this is what made the previous list fail: 5 of its 6
 *    cameras now answer 404/403).
 *  - `i.ytimg.com/vi/<id>/hqdefault.jpg` returns 200 → the poster is real.
 *  - `"isLiveNow"` was read from the watch page → `liveAtBuild`.
 *
 * Live status changes constantly, so the player also detects failures at
 * runtime and offers the official page instead of showing a broken box.
 */

export type LiveCategoryId = "orbit" | "volcano" | "sky" | "launch" | "quake" | "atc";

export interface LiveCategory {
  id: LiveCategoryId;
  label: string;
  hint: string;
}

export interface LiveSignal {
  id: string;
  label: string;
  /** Channel or institution that publishes the stream. */
  source: string;
  /** Official institution (NASA, USGS…) vs an independent operator. */
  official: boolean;
  category: LiveCategoryId;
  videoId: string;
  /** Channel id, used for the always-current `live_stream?channel=` embed. */
  channelId?: string;
  /** Live state measured when this list was verified. */
  liveAtBuild: boolean;
  location: string;
  /** Public page of the stream, used as the fallback when embedding fails. */
  pageUrl: string;
  note?: string;
}

export const LIVE_VERIFIED_ON = "19 oct 2026";

export const LIVE_CATEGORIES: LiveCategory[] = [
  { id: "orbit", label: "Órbita", hint: "Estación espacial y emisiones oficiales" },
  { id: "launch", label: "Lanzamientos", hint: "Rampa, misiones y operaciones espaciales" },
  { id: "quake", label: "Sismos", hint: "Sismógrafos y monitorización sísmica en directo" },
  { id: "volcano", label: "Volcanes", hint: "Vigilancia volcánica en directo" },
  { id: "sky", label: "Aurora y cielo", hint: "Auroras, meteoros, observatorios y cielo profundo" },
  { id: "atc", label: "Tráfico aéreo", hint: "Aeropuertos y control de tráfico aéreo" },
];

export const LIVE_SIGNALS: LiveSignal[] = [
  // --- Órbita ---------------------------------------------------------------
  {
    id: "iss-live",
    label: "ISS · Cámara exterior",
    source: "NASA",
    official: true,
    category: "orbit",
    videoId: "M3HKLzjvKPc",
    channelId: "UCLA_DiR1FfKNvjuUpBHmylQ",
    liveAtBuild: true,
    location: "Órbita baja terrestre",
    pageUrl: "https://www.nasa.gov/live/",
    note: "Vista exterior de la estación desde las cámaras de la NASA.",
  },
  {
    id: "iss-view",
    label: "ISS · Vistas en alta definición",
    source: "NASA",
    official: true,
    category: "orbit",
    videoId: "P9C25Un7xaM",
    channelId: "UCLA_DiR1FfKNvjuUpBHmylQ",
    liveAtBuild: false,
    location: "Órbita baja terrestre",
    pageUrl: "https://www.nasa.gov/live/",
    note: "Emite a intervalos: si no hay señal, usa el canal en directo.",
  },
  {
    id: "nasa-tv",
    label: "NASA TV",
    source: "NASA",
    official: true,
    category: "orbit",
    videoId: "21X5lGlDOfg",
    channelId: "UCLA_DiR1FfKNvjuUpBHmylQ",
    liveAtBuild: false,
    location: "Emisiones de misión",
    pageUrl: "https://www.nasa.gov/live/",
    note: "Solo emite durante eventos y ruedas de prensa.",
  },
  {
    id: "iss-tracker",
    label: "ISS · Seguimiento 24/7",
    source: "Tripwebcam",
    official: false,
    category: "orbit",
    videoId: "TAkk2B9GOmc",
    liveAtBuild: true,
    location: "Órbita baja terrestre",
    pageUrl: "https://www.youtube.com/watch?v=TAkk2B9GOmc",
    note: "Reemisión independiente con órbita, aurora y meteorología.",
  },

  {
    id: "kennedy-launches",
    label: "Kennedy Space Center · Rampa 39",
    source: "afarTV · NASA",
    official: false,
    category: "launch",
    videoId: "8beDnMI2y6U",
    liveAtBuild: true,
    location: "Cabo Cañaveral, Florida",
    pageUrl: "https://www.youtube.com/watch?v=8beDnMI2y6U",
    note: "Vista continua de la rampa: los lanzamientos de SpaceX, NASA y Artemis se ven aquí en directo.",
  },

  // --- Volcanes -------------------------------------------------------------
  {
    id: "kilauea-v2",
    label: "Kīlauea · V2cam",
    source: "USGS",
    official: true,
    category: "volcano",
    videoId: "f9-oSpYpubg",
    channelId: "UCeXH8GZyV3sVqAr45AvupOA",
    liveAtBuild: true,
    location: "Halemaʻumaʻu, Hawái",
    pageUrl: "https://www.usgs.gov/volcanoes/kilauea/summit-webcams",
    note: "Segunda cámara oficial del Observatorio Vulcanológico de Hawái.",
  },
  {
    id: "popocatepetl",
    label: "Popocatépetl · San Matías",
    source: "afarTV · CENAPRED",
    official: false,
    category: "volcano",
    videoId: "8c4M11yu5L4",
    liveAtBuild: true,
    location: "Puebla, México",
    pageUrl: "https://www.youtube.com/watch?v=8c4M11yu5L4",
    note: "Vista continua del volcán más vigilado de México.",
  },
  {
    id: "kanlaon",
    label: "Kanlaon · Filipinas",
    source: "afarTV · PHIVOLCS",
    official: false,
    category: "volcano",
    videoId: "LjhN6FZWqi0",
    liveAtBuild: true,
    location: "Negros, Filipinas",
    pageUrl: "https://www.youtube.com/watch?v=LjhN6FZWqi0",
  },
  {
    id: "sangay",
    label: "Sangay · Amazonía",
    source: "afarTV · IG-EPN",
    official: false,
    category: "volcano",
    videoId: "EuFOOh2VQfc",
    liveAtBuild: true,
    location: "Morona Santiago, Ecuador",
    pageUrl: "https://www.youtube.com/watch?v=EuFOOh2VQfc",
  },
  {
    id: "bromo-semeru",
    label: "Bromo y Semeru · Java",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "ZQcPQx8PKQ8",
    liveAtBuild: true,
    location: "Java Oriental, Indonesia",
    pageUrl: "https://www.youtube.com/watch?v=ZQcPQx8PKQ8",
  },
  {
    id: "kilauea-v1",
    label: "Kīlauea · V1cam",
    source: "USGS",
    official: true,
    category: "volcano",
    videoId: "HggWKlZv9yk",
    channelId: "UCeXH8GZyV3sVqAr45AvupOA",
    liveAtBuild: true,
    location: "Halemaʻumaʻu, Hawái",
    pageUrl: "https://www.usgs.gov/volcanoes/kilauea/summit-webcams",
    note: "Cámara oficial del Observatorio Vulcanológico de Hawái.",
  },
  {
    id: "iceland-watch",
    label: "Reykjanes · Vigilancia",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "SuOXfvH34nU",
    liveAtBuild: true,
    location: "Península de Reykjanes, Islandia",
    pageUrl: "https://www.youtube.com/watch?v=SuOXfvH34nU",
  },
  {
    id: "reventador",
    label: "El Reventador",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "uKYA-oNVODY",
    liveAtBuild: true,
    location: "Amazonía, Ecuador",
    pageUrl: "https://www.youtube.com/watch?v=uKYA-oNVODY",
  },
  {
    id: "semeru",
    label: "Semeru · Multicámara",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "Hch0OAJKcjQ",
    liveAtBuild: true,
    location: "Java Oriental, Indonesia",
    pageUrl: "https://www.youtube.com/watch?v=Hch0OAJKcjQ",
  },

  // --- Aurora y cielo -------------------------------------------------------
  {
    id: "greenland-aurora",
    label: "Auroras de Groenlandia",
    source: "WorldCam",
    official: false,
    category: "sky",
    videoId: "uT6qXk9TJq8",
    liveAtBuild: true,
    location: "Groenlandia",
    pageUrl: "https://www.youtube.com/watch?v=uT6qXk9TJq8",
  },
  {
    id: "iceland-aurora",
    label: "Aurora boreal 4K",
    source: "Geimfarinn",
    official: false,
    category: "sky",
    videoId: "XXmUxYSoMr0",
    liveAtBuild: true,
    location: "Islandia",
    pageUrl: "https://www.youtube.com/watch?v=XXmUxYSoMr0",
  },
  {
    id: "superior-aurora",
    label: "Lago Superior · Aurora y meteoros",
    source: "Superior Wilds",
    official: false,
    category: "sky",
    videoId: "5cWbfYOcgK4",
    liveAtBuild: true,
    location: "Míchigan, EE. UU.",
    pageUrl: "https://www.youtube.com/watch?v=5cWbfYOcgK4",
  },
  {
    id: "arjeplog-aurora",
    label: "Arjeplog · Lago y aurora",
    source: "Planet Fast Forward",
    official: false,
    category: "sky",
    videoId: "5A7JI6saAp4",
    liveAtBuild: true,
    location: "Laponia sueca",
    pageUrl: "https://www.youtube.com/watch?v=5A7JI6saAp4",
  },
  {
    id: "oulu-aurora",
    label: "Nallikari · Aurora costera",
    source: "Samimaka",
    official: false,
    category: "sky",
    videoId: "G-WVnv3sVag",
    liveAtBuild: true,
    location: "Oulu, Finlandia",
    pageUrl: "https://www.youtube.com/watch?v=G-WVnv3sVag",
  },
  {
    id: "northumberland-aurora",
    label: "Northumberland · Aurora",
    source: "Northumberland Astro",
    official: false,
    category: "sky",
    videoId: "MYeOK93smBw",
    liveAtBuild: true,
    location: "Cresswell, Reino Unido",
    pageUrl: "https://www.youtube.com/watch?v=MYeOK93smBw",
  },
  {
    id: "northumberland-meteor",
    label: "Northumberland · Meteoros",
    source: "Northumberland Astro",
    official: false,
    category: "sky",
    videoId: "V3BIbEskVeQ",
    liveAtBuild: true,
    location: "Budle Bay, Reino Unido",
    pageUrl: "https://www.youtube.com/watch?v=V3BIbEskVeQ",
    note: "Cámara de meteoros: útil para descartar bólidos como anomalías.",
  },
  {
    id: "greenland-icebergs",
    label: "Icebergs de Groenlandia · VR180",
    source: "afarTV",
    official: false,
    category: "sky",
    videoId: "VRsHARw5GfQ",
    liveAtBuild: true,
    location: "Groenlandia",
    pageUrl: "https://www.youtube.com/watch?v=VRsHARw5GfQ",
  },

  // --- Bloque añadido el 19 oct 2026: verificado desde la máquina de build
  //     (oembed 200 + póster 200 + "isLiveNow" leído en la página de cada
  //     vídeo). Las entradas marcadas liveAtBuild:false se comprobó que no
  //     emitían en ese momento y se mantienen por su horario programado.
  {
    id: "iss-hd",
    label: "ISS · HD en directo",
    source: "NASA",
    official: true,
    category: "orbit",
    videoId: "awQzjn72bI0",
    channelId: "UCLA_DiR1FfKNvjuUpBHmylQ",
    liveAtBuild: true,
    location: "Órbita baja terrestre",
    pageUrl: "https://www.nasa.gov/live/",
    note: "Segunda emisión oficial de la NASA con vistas en alta definición desde la Estación Espacial.",
  },
  {
    id: "jaxa-mmx",
    label: "JAXA · MMX / H3 vuelo 10",
    source: "JAXA",
    official: true,
    category: "launch",
    videoId: "Fn6gzuGa-6c",
    liveAtBuild: false,
    location: "Tanegashima, Japón",
    pageUrl: "https://www.youtube.com/watch?v=Fn6gzuGa-6c",
    note: "Transmisión oficial de JAXA: el lanzamiento de la misión MMX hacia Marte está programado para el 20 de octubre de 2026.",
  },
  {
    id: "globalquake",
    label: "Sismos en tiempo real",
    source: "GlobalQuake",
    official: false,
    category: "quake",
    videoId: "rvtygG4n6ew",
    liveAtBuild: true,
    location: "Red sísmica global",
    pageUrl: "https://www.youtube.com/watch?v=rvtygG4n6ew",
    note: "Monitor 24/7 que detecta y localiza terremotos en cuanto entran en las redes sísmicas.",
  },
  {
    id: "seismograms",
    label: "Sismogramas en directo",
    source: "Meteo Ariccia",
    official: false,
    category: "quake",
    videoId: "kFUox2ccOac",
    liveAtBuild: true,
    location: "Ariccia, Italia",
    pageUrl: "https://www.youtube.com/watch?v=kFUox2ccOac",
    note: "Sismogramas con refresco de un segundo: sirve para contrastar una señal con la actividad sísmica del momento.",
  },
  {
    id: "kilauea-v3",
    label: "Kīlauea · V3cam",
    source: "USGS",
    official: true,
    category: "volcano",
    videoId: "gXKuUyKt8mc",
    liveAtBuild: true,
    location: "Halemaʻumaʻu, Hawái",
    pageUrl: "https://www.usgs.gov/volcanoes/kilauea/summit-webcams",
    note: "Tercera cámara oficial del Observatorio Vulcanológico de Hawái (sur del cráter).",
  },
  {
    id: "etna-multicam",
    label: "Etna · Multicámara",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "EGk3Mr0OshE",
    liveAtBuild: true,
    location: "Sicilia, Italia",
    pageUrl: "https://www.youtube.com/watch?v=EGk3Mr0OshE",
    note: "Varias cámaras 24/7 sobre el volcán más activo de Europa.",
  },
  {
    id: "iceland-multicam",
    label: "Islandia · Volcanes multicámara",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "qkSvU9j4kqM",
    liveAtBuild: true,
    location: "Reykjanes, Islandia",
    pageUrl: "https://www.youtube.com/watch?v=qkSvU9j4kqM",
    note: "Reemisión 24/7 de las cámaras de Reykjanes; los avisos oficiales los publica la Oficina Meteorológica de Islandia.",
  },
  {
    id: "merapi",
    label: "Merapi · Eruptando en 4K",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "SeyldmYkfDI",
    liveAtBuild: true,
    location: "Java, Indonesia",
    pageUrl: "https://www.youtube.com/watch?v=SeyldmYkfDI",
    note: "Cámara continua sobre el volcán más vigilado de Indonesia.",
  },
  {
    id: "sangay-amazon",
    label: "Sangay · Amazonía 4K",
    source: "afarTV",
    official: false,
    category: "volcano",
    videoId: "IOhIO_mF4Cc",
    liveAtBuild: true,
    location: "Morona Santiago, Ecuador",
    pageUrl: "https://www.youtube.com/watch?v=IOhIO_mF4Cc",
    note: "Panorámica 24/7 del Sangay con la selva amazónica de fondo.",
  },
  {
    id: "cfht-star",
    label: "CFHT · Mauna Kea oeste",
    source: "Astro Asahi · CFHT",
    official: false,
    category: "sky",
    videoId: "qh6Nqiq6LIg",
    liveAtBuild: false,
    location: "Mauna Kea, Hawái",
    pageUrl: "https://www.cfht.hawaii.edu/en/gallery/starcam.php",
    note: "Cámara del telescopio Canadá-Francia-Hawái: emite de noche en Hawái (08:14 HST al verificarla no emitía).",
  },
  {
    id: "subaru-star",
    label: "Subaru · Mauna Kea este",
    source: "Astro Asahi · NAOJ",
    official: false,
    category: "sky",
    videoId: "6g4Fh8K-MhY",
    liveAtBuild: false,
    location: "Mauna Kea, Hawái",
    pageUrl: "https://subarutelescope.org/",
    note: "Vista este del observatorio Subaru: emite de noche en Hawái.",
  },
  {
    id: "lax-atc",
    label: "LAX · Pistas 24L/24R con ATC",
    source: "AirlineVideosLive+",
    official: false,
    category: "atc",
    videoId: "n4I0d44oBEs",
    liveAtBuild: true,
    location: "Los Ángeles, EE. UU.",
    pageUrl: "https://www.youtube.com/watch?v=n4I0d44oBEs",
    note: "Cámara 24/7 con audio de control de tráfico aéreo: permite identificar aviones confundidos con un UAP.",
  },
];

/**
 * Official, research and archive sources. `kind` powers the filter in the
 * sources panel: agencies publish live data, archives hold the historical record.
 */
export type SourceKind = "official" | "research" | "archive" | "data";

export interface OfficialSource {
  label: string;
  url: string;
  desc: string;
  kind: SourceKind;
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  official: "Agencias",
  research: "Investigación",
  archive: "Archivos",
  data: "Datos en vivo",
};

export const OFFICIAL_SOURCES: OfficialSource[] = [
  // --- Agencias y organismos públicos ---------------------------------------
  { label: "AARO", url: "https://www.aaro.mil/", desc: "All-domain Anomaly Resolution Office (DoD)", kind: "official" },
  { label: "NASA Live", url: "https://www.nasa.gov/live/", desc: "Emisiones oficiales de la NASA", kind: "official" },
  { label: "ESA Web TV", url: "https://watch.esa.int/", desc: "Televisión oficial de la ESA", kind: "official" },
  { label: "CNES GEIPAN", url: "https://www.cnes-geipan.fr/", desc: "Grupo francés de estudio de fenómenos aeroespaciales", kind: "official" },
  { label: "NOAA SWPC", url: "https://www.swpc.noaa.gov/", desc: "Centro de predicción del clima espacial", kind: "official" },
  { label: "NOAA polo sur", url: "https://gml.noaa.gov/obop/spo/livecamera.html", desc: "Cámara del Polo Sur (imagen cada 15 min)", kind: "official" },
  { label: "USGS HVO", url: "https://www.usgs.gov/volcanoes/kilauea/summit-webcams", desc: "Webcams del Observatorio de Hawái", kind: "official" },
  { label: "Copernicus EMS", url: "https://emergency.copernicus.eu/", desc: "Cartografía satelital de emergencias (UE)", kind: "official" },
  { label: "GDACS", url: "https://www.gdacs.org/", desc: "Alertas globales de desastres (ONU/UE)", kind: "official" },

  // --- Investigación civil ---------------------------------------------------
  { label: "NUFORC", url: "https://nuforc.org/", desc: "National UFO Reporting Center", kind: "research" },
  { label: "MUFON", url: "https://mufon.com/", desc: "Mutual UFO Network", kind: "research" },
  { label: "Hessdalen", url: "https://hessdalen.org/", desc: "Observatorio automatizado de Hessdalen", kind: "research" },
  { label: "Galileo Project", url: "https://projects.iq.harvard.edu/galileo", desc: "Programa de Harvard sobre objetos aéreos no identificados", kind: "research" },
  { label: "Enigma Labs", url: "https://enigmalabs.io/", desc: "Base de datos y mapa de avistamientos", kind: "research" },
  { label: "UAF Allsky", url: "https://allsky.gi.alaska.edu/", desc: "Cámaras de aurora de Alaska", kind: "research" },
  { label: "Explore.org", url: "https://explore.org/livecams", desc: "Cámaras naturales (auroras y fauna)", kind: "research" },

  // --- Archivos históricos ---------------------------------------------------
  { label: "Archivos Blue Book", url: "https://www.archives.gov/research/military/air-force/ufos", desc: "Proyecto Blue Book en los Archivos Nacionales de EE. UU.", kind: "archive" },
  { label: "CIA FOIA UFO", url: "https://www.cia.gov/readingroom/collection/ufos-fact-or-fiction", desc: "Colección desclasificada de la CIA", kind: "archive" },
  { label: "FBI Vault", url: "https://vault.fbi.gov/UFO", desc: "Expedientes UFO del FBI", kind: "archive" },
  { label: "Project Blue Book", url: "https://www.projectbluebook.org/", desc: "Índice consultable del proyecto (1952-1969)", kind: "archive" },
  { label: "The Black Vault", url: "https://theblackvault.com/", desc: "Archivo de documentos desclasificados", kind: "archive" },

  // --- Datos en vivo ---------------------------------------------------------
  { label: "USGS sismos", url: "https://earthquake.usgs.gov/earthquakes/map/", desc: "Mapa sísmico global en tiempo real", kind: "data" },
  { label: "EMSC", url: "https://www.emsc-csem.org/", desc: "Sismología euro-mediterránea", kind: "data" },
  { label: "CNEOS fireballs", url: "https://cneos.jpl.nasa.gov/fireballs/", desc: "Bólidos registrados por NASA/JPL", kind: "data" },

  // --- Bloque añadido el 19 oct 2026: cada URL comprobada con HTTP 200 -----
  // Agencias
  { label: "NASA UAP", url: "https://science.nasa.gov/uap/", desc: "Programa de fenómenos anómalos no identificados de la NASA", kind: "official" },
  { label: "SEFAA Chile", url: "https://sefaa.dgac.gob.cl/", desc: "Sección de Fenómenos Anómalos Aéreos de la DGAC de Chile", kind: "official" },
  { label: "ESA Space Weather", url: "https://www.esa.int/Space_Weather/", desc: "Meteorología espacial de la ESA", kind: "official" },
  { label: "NASA DSN Now", url: "https://eyes.nasa.gov/apps/dsn-now/", desc: "Antenas de la Red de Espacio Profundo en tiempo real", kind: "official" },
  { label: "Spot the Station", url: "https://spotthestation.nasa.gov/", desc: "Paso de la ISS sobre tu ubicación (NASA)", kind: "official" },
  { label: "NOAA GOES", url: "https://www.goes.noaa.gov/", desc: "Imágenes de los satélites meteorológicos GOES", kind: "official" },
  { label: "AVO webcams", url: "https://avo.alaska.edu/webcam/", desc: "Cámaras del Observatorio de Volcanes de Alaska (USGS/UAF)", kind: "official" },

  // Investigación
  { label: "UAPx", url: "https://uapx.org/", desc: "Proyecto civil de investigación y captura de UAP", kind: "research" },
  { label: "Rubin Observatory", url: "https://rubinobservatory.org/", desc: "Observatorio Vera C. Rubin: rastreo del cielo nocturno", kind: "research" },

  // Archivo
  { label: "UFO files UK", url: "https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/ufos/", desc: "Expedientes UFO del Ministerio de Defensa británico", kind: "archive" },

  // Datos en vivo
  { label: "IODA", url: "https://ioda.inetintel.cc.gatech.edu/", desc: "Cortes de internet globales en tiempo real", kind: "data" },
  { label: "NOAA Kp (JSON)", url: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", desc: "Pronóstico de índice Kp, API sin clave", kind: "data" },
  { label: "USGS sismos (JSON)", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson", desc: "Terremotos M4.5+ de la última semana, GeoJSON sin clave", kind: "data" },
  { label: "JPL Sentry", url: "https://ssd-api.jpl.nasa.gov/sentry.api", desc: "Asteroides con probabilidad de impacto, API sin clave", kind: "data" },
  { label: "SOHO", url: "https://soho.nascom.nasa.gov/", desc: "Imágenes solares de la sonda SOHO (NASA/ESA)", kind: "data" },
];

/** Documented cases, each pointing at the archive that holds the record. */
export interface HistoricCase {
  id: string;
  year: string;
  place: string;
  title: string;
  note: string;
  archiveUrl: string;
}

export const HISTORIC_CASES: HistoricCase[] = [
  {
    id: "roswell-1947",
    year: "1947",
    place: "Roswell, Nuevo México",
    title: "Incidente de Roswell",
    note: "El caso que abrió el expediente moderno: globo Mogul, informe militar y décadas de reinterpretaciones.",
    archiveUrl: "https://www.archives.gov/research/military/air-force/ufos",
  },
  {
    id: "washington-1952",
    year: "1952",
    place: "Washington D. C.",
    title: "Ecos en el radar del Capitolio",
    note: "Series de contactos radar sobre la capital durante el verano de 1952, con intercepciones abortadas.",
    archiveUrl: "https://www.projectbluebook.org/",
  },
  {
    id: "tehran-1976",
    year: "1976",
    place: "Teherán, Irán",
    title: "Caso Teherán",
    note: "Dos F-4 pierden instrumentación al aproximarse a un objeto; incluye el informe desclasificado de la USAF.",
    archiveUrl: "https://www.cia.gov/readingroom/collection/ufos-fact-or-fiction",
  },
  {
    id: "rendlesham-1980",
    year: "1980",
    place: "Rendlesham Forest, Reino Unido",
    title: "Rendlesham Forest",
    note: "Luces y aterrizaje reportado junto a la base de Bentwaters; el memo de Halt es el documento clave.",
    archiveUrl: "https://theblackvault.com/",
  },
  {
    id: "phoenix-1997",
    year: "1997",
    place: "Arizona, EE. UU.",
    title: "Luces de Phoenix",
    note: "Testigos en varios condados describen una formación en V; existe registro de bengalas militares esa noche.",
    archiveUrl: "https://nuforc.org/",
  },
  {
    id: "nimitz-2004",
    year: "2004",
    place: "Pacífico, frente a San Diego",
    title: "Encuentro Nimitz",
    note: "El grupo de ataque Nimitz registra el objeto en FLIR; es uno de los casos del informe de AARO.",
    archiveUrl: "https://www.aaro.mil/",
  },
];

export function signalThumb(signal: LiveSignal): string {
  return `https://i.ytimg.com/vi/${signal.videoId}/hqdefault.jpg`;
}

export function signalEmbedUrl(signal: LiveSignal): string {
  return `https://www.youtube.com/embed/${signal.videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
}

export function signalChannelEmbedUrl(signal: LiveSignal): string | null {
  return signal.channelId
    ? `https://www.youtube.com/embed/live_stream?channel=${signal.channelId}&autoplay=1&mute=1`
    : null;
}

export function signalsByCategory(category: LiveCategoryId): LiveSignal[] {
  return LIVE_SIGNALS.filter((signal) => signal.category === category);
}
