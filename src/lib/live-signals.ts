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

export type LiveCategoryId = "orbit" | "volcano" | "sky";

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

export const LIVE_VERIFIED_ON = "17 oct 2026";

export const LIVE_CATEGORIES: LiveCategory[] = [
  { id: "orbit", label: "Órbita", hint: "Estación espacial y emisiones oficiales" },
  { id: "volcano", label: "Volcanes", hint: "Vigilancia volcánica en directo" },
  { id: "sky", label: "Aurora y cielo", hint: "Auroras, meteoros y cielo profundo" },
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

  // --- Volcanes -------------------------------------------------------------
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
];

export const OFFICIAL_SOURCES = [
  { label: "AARO", url: "https://www.aaro.mil/", desc: "All-domain Anomaly Resolution Office (DoD)" },
  { label: "NUFORC", url: "https://nuforc.org/", desc: "National UFO Reporting Center" },
  { label: "MUFON", url: "https://mufon.com/", desc: "Mutual UFO Network" },
  { label: "Hessdalen", url: "https://hessdalen.org/", desc: "Observatorio automatizado de Hessdalen" },
  { label: "NASA Live", url: "https://www.nasa.gov/live/", desc: "Emisiones oficiales de la NASA" },
  { label: "USGS HVO", url: "https://www.usgs.gov/volcanoes/kilauea/summit-webcams", desc: "Webcams del Observatorio de Hawái" },
  { label: "ESA Web TV", url: "https://watch.esa.int/", desc: "Televisión oficial de la ESA" },
  { label: "NOAA polo sur", url: "https://gml.noaa.gov/obop/spo/livecamera.html", desc: "Cámara del Polo Sur (imagen cada 15 min)" },
  { label: "UAF Allsky", url: "https://allsky.gi.alaska.edu/", desc: "Cámaras de aurora de Alaska" },
  { label: "Explore.org", url: "https://explore.org/livecams", desc: "Cámaras naturales (auroras y fauna)" },
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
