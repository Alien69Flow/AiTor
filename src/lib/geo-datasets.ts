/**
 * Static strategic / geopolitical datasets for the tactical globe.
 * Modelled on the WorldMonitor + Liveuamap + ConflictRadar360 taxonomies:
 * every event carries an emoji icon, a category, a reliability score and a
 * short brief so the popup is useful, not just a dot.
 */

export type ConflictCategory =
  | "strike"
  | "missile"
  | "air"
  | "naval"
  | "ground"
  | "drone"
  | "infrastructure"
  | "cyber"
  | "nuclear"
  | "diplomacy"
  | "civil";

export const CONFLICT_ICONS: Record<ConflictCategory, string> = {
  strike: "💥",
  missile: "🚀",
  air: "🛩️",
  naval: "🚢",
  ground: "🪖",
  drone: "🛸",
  infrastructure: "⚡",
  cyber: "💻",
  nuclear: "☢️",
  diplomacy: "🕊️",
  civil: "🔥",
};

export const CONFLICT_COLORS: Record<ConflictCategory, string> = {
  strike: "#ef4444",
  missile: "#f97316",
  air: "#38bdf8",
  naval: "#0ea5e9",
  ground: "#a3641a",
  drone: "#c084fc",
  infrastructure: "#facc15",
  cyber: "#22d3ee",
  nuclear: "#7c3aed",
  diplomacy: "#34d399",
  civil: "#fb923c",
};

export interface ConflictZone {
  id: string;
  lat: number;
  lon: number;
  name: string;
  country: string;
  category: ConflictCategory;
  /** 0-100 confidence in the reporting, Liveuamap-style */
  reliability: number;
  intensity: number;
  brief: string;
  source: string;
}

export const CONFLICT_ZONES: ConflictZone[] = [
  { id: "ua-donbas", lat: 48.02, lon: 37.8, name: "Donbas front", country: "Ukraine", category: "ground", reliability: 92, intensity: 1, brief: "Sustained artillery and assault operations along the Pokrovsk–Donetsk axis.", source: "Liveuamap / ISW" },
  { id: "ua-kharkiv", lat: 49.99, lon: 36.23, name: "Kharkiv oblast", country: "Ukraine", category: "missile", reliability: 88, intensity: 0.9, brief: "Recurrent missile and glide-bomb strikes on urban and energy targets.", source: "Liveuamap" },
  { id: "ua-crimea", lat: 44.61, lon: 33.53, name: "Sevastopol", country: "Crimea", category: "naval", reliability: 80, intensity: 0.8, brief: "Black Sea Fleet basing; repeated USV and cruise-missile activity.", source: "OSINT aggregate" },
  { id: "ru-belgorod", lat: 50.6, lon: 36.59, name: "Belgorod", country: "Russia", category: "drone", reliability: 74, intensity: 0.6, brief: "Cross-border drone strikes and air-defence engagements.", source: "Liveuamap" },
  { id: "il-gaza", lat: 31.42, lon: 34.36, name: "Gaza Strip", country: "Palestine", category: "strike", reliability: 90, intensity: 1, brief: "Urban combat and airstrikes; severe humanitarian impact.", source: "OCHA / ACLED" },
  { id: "il-lebanon", lat: 33.28, lon: 35.35, name: "South Lebanon", country: "Lebanon", category: "air", reliability: 85, intensity: 0.85, brief: "Cross-border exchanges between IDF and Hezbollah units.", source: "ACLED" },
  { id: "sy-damascus", lat: 33.51, lon: 36.29, name: "Damascus", country: "Syria", category: "strike", reliability: 72, intensity: 0.6, brief: "Periodic airstrikes on IRGC-linked logistics nodes.", source: "SOHR" },
  { id: "ye-hodeidah", lat: 14.79, lon: 42.95, name: "Hodeidah", country: "Yemen", category: "naval", reliability: 83, intensity: 0.9, brief: "Houthi anti-shipping attacks affecting Red Sea transits.", source: "UKMTO" },
  { id: "ye-sanaa", lat: 15.37, lon: 44.19, name: "Sana'a", country: "Yemen", category: "missile", reliability: 78, intensity: 0.7, brief: "Missile/UAV launch sites and coalition retaliation strikes.", source: "ACLED" },
  { id: "ir-natanz", lat: 33.72, lon: 51.73, name: "Natanz", country: "Iran", category: "nuclear", reliability: 70, intensity: 0.7, brief: "Enrichment complex under IAEA dispute; sabotage history.", source: "IAEA" },
  { id: "tw-strait", lat: 24.5, lon: 119.5, name: "Taiwan Strait", country: "Taiwan / China", category: "air", reliability: 86, intensity: 0.8, brief: "Daily PLA median-line crossings and ADIZ incursions.", source: "MND Taiwan" },
  { id: "scs-spratly", lat: 9.7, lon: 115.8, name: "Spratly Islands", country: "South China Sea", category: "naval", reliability: 79, intensity: 0.7, brief: "Coast-guard confrontations around Second Thomas Shoal.", source: "AMTI" },
  { id: "kp-dmz", lat: 37.96, lon: 126.68, name: "Korean DMZ", country: "Korea", category: "ground", reliability: 68, intensity: 0.5, brief: "Loudspeaker/balloon campaigns and border fortification works.", source: "Yonhap" },
  { id: "sd-khartoum", lat: 15.5, lon: 32.56, name: "Khartoum", country: "Sudan", category: "civil", reliability: 84, intensity: 0.95, brief: "SAF vs RSF urban warfare; mass displacement.", source: "ACLED" },
  { id: "ml-sahel", lat: 16.77, lon: -3.0, name: "Sahel corridor", country: "Mali / Niger", category: "ground", reliability: 75, intensity: 0.8, brief: "Jihadist insurgency and junta counter-operations.", source: "ACLED" },
  { id: "cd-goma", lat: -1.68, lon: 29.22, name: "Goma", country: "DR Congo", category: "ground", reliability: 80, intensity: 0.85, brief: "M23 offensive pressure on North Kivu.", source: "UN MONUSCO" },
  { id: "mm-rakhine", lat: 20.15, lon: 92.9, name: "Rakhine", country: "Myanmar", category: "civil", reliability: 71, intensity: 0.75, brief: "Arakan Army offensives against junta garrisons.", source: "ACLED" },
  { id: "pk-af", lat: 33.99, lon: 70.65, name: "Durand Line", country: "Pakistan / Afghanistan", category: "strike", reliability: 69, intensity: 0.6, brief: "Cross-border strikes and TTP insurgent activity.", source: "OSINT aggregate" },
  { id: "hti-pap", lat: 18.55, lon: -72.33, name: "Port-au-Prince", country: "Haiti", category: "civil", reliability: 77, intensity: 0.8, brief: "Gang control of key districts; state collapse conditions.", source: "UN" },
  { id: "ve-esequibo", lat: 6.5, lon: -59.0, name: "Essequibo", country: "Guyana / Venezuela", category: "diplomacy", reliability: 65, intensity: 0.4, brief: "Territorial dispute with military posturing near the border.", source: "ICJ" },
  { id: "arm-az", lat: 39.8, lon: 46.7, name: "Syunik corridor", country: "Armenia / Azerbaijan", category: "diplomacy", reliability: 62, intensity: 0.4, brief: "Delimitation talks amid periodic border incidents.", source: "OSINT aggregate" },
  { id: "bab-mandeb", lat: 12.58, lon: 43.33, name: "Bab el-Mandeb", country: "Red Sea", category: "infrastructure", reliability: 88, intensity: 0.9, brief: "Shipping rerouted around the Cape; insurance premiums elevated.", source: "IMB" },
];

export interface GeoPoint {
  id: string;
  lat: number;
  lon: number;
  name: string;
  detail: string;
}

export const CHOKEPOINTS: GeoPoint[] = [
  { id: "hormuz", lat: 26.57, lon: 56.25, name: "Strait of Hormuz", detail: "~20% of global oil transits daily" },
  { id: "malacca", lat: 2.5, lon: 101.4, name: "Strait of Malacca", detail: "~25% of global traded goods" },
  { id: "suez", lat: 30.02, lon: 32.56, name: "Suez Canal", detail: "12% of world trade" },
  { id: "panama", lat: 9.08, lon: -79.68, name: "Panama Canal", detail: "Draft restrictions from drought" },
  { id: "bosphorus", lat: 41.12, lon: 29.07, name: "Bosphorus", detail: "Black Sea grain and oil corridor" },
  { id: "gibraltar", lat: 35.95, lon: -5.6, name: "Strait of Gibraltar", detail: "Atlantic–Mediterranean gateway" },
  { id: "bab", lat: 12.58, lon: 43.33, name: "Bab el-Mandeb", detail: "Red Sea southern gate" },
  { id: "taiwan", lat: 24.5, lon: 119.5, name: "Taiwan Strait", detail: "Semiconductor logistics artery" },
  { id: "danish", lat: 55.6, lon: 12.7, name: "Danish Straits", detail: "Baltic export route" },
];

export const NUCLEAR_SITES: GeoPoint[] = [
  { id: "zaporizhzhia", lat: 47.51, lon: 34.59, name: "Zaporizhzhia NPP", detail: "Largest NPP in Europe — front-line" },
  { id: "natanz", lat: 33.72, lon: 51.73, name: "Natanz", detail: "Uranium enrichment complex" },
  { id: "fordow", lat: 34.88, lon: 50.99, name: "Fordow", detail: "Hardened enrichment facility" },
  { id: "yongbyon", lat: 39.8, lon: 125.75, name: "Yongbyon", detail: "DPRK plutonium production" },
  { id: "dimona", lat: 31.0, lon: 35.14, name: "Dimona", detail: "Negev Nuclear Research Center" },
  { id: "sellafield", lat: 54.42, lon: -3.5, name: "Sellafield", detail: "Reprocessing and waste storage" },
  { id: "lahague", lat: 49.68, lon: -1.88, name: "La Hague", detail: "Spent fuel reprocessing" },
  { id: "fukushima", lat: 37.42, lon: 141.03, name: "Fukushima Daiichi", detail: "Decommissioning / water release" },
  { id: "asco", lat: 41.2, lon: 0.57, name: "Ascó", detail: "Spanish PWR reactors" },
];

export const MILITARY_BASES: GeoPoint[] = [
  { id: "ramstein", lat: 49.44, lon: 7.6, name: "Ramstein AB", detail: "USAFE hub, Europe" },
  { id: "rota", lat: 36.64, lon: -6.35, name: "Naval Station Rota", detail: "US/Spain Atlantic base" },
  { id: "moron", lat: 37.17, lon: -5.62, name: "Morón AB", detail: "US/Spain expeditionary" },
  { id: "incirlik", lat: 37.0, lon: 35.42, name: "Incirlik AB", detail: "NATO southern flank" },
  { id: "diego", lat: -7.31, lon: 72.41, name: "Diego Garcia", detail: "Indian Ocean bomber base" },
  { id: "guam", lat: 13.58, lon: 144.92, name: "Andersen AFB", detail: "Pacific strategic node" },
  { id: "djibouti", lat: 11.55, lon: 43.16, name: "Camp Lemonnier", detail: "Horn of Africa" },
  { id: "tartus", lat: 34.9, lon: 35.87, name: "Tartus", detail: "Russian naval facility" },
  { id: "yokosuka", lat: 35.29, lon: 139.67, name: "Yokosuka", detail: "US 7th Fleet HQ" },
];

export const ECONOMIC_CENTERS: GeoPoint[] = [
  { id: "nyc", lat: 40.71, lon: -74.0, name: "New York", detail: "NYSE / NASDAQ" },
  { id: "ldn", lat: 51.51, lon: -0.13, name: "London", detail: "LSE / FX clearing" },
  { id: "hkg", lat: 22.32, lon: 114.17, name: "Hong Kong", detail: "HKEX" },
  { id: "sgp", lat: 1.35, lon: 103.82, name: "Singapore", detail: "Commodities & shipping finance" },
  { id: "tky", lat: 35.68, lon: 139.69, name: "Tokyo", detail: "TSE" },
  { id: "fra", lat: 50.11, lon: 8.68, name: "Frankfurt", detail: "ECB / Deutsche Börse" },
  { id: "zrh", lat: 47.37, lon: 8.54, name: "Zurich", detail: "Private banking" },
  { id: "dxb", lat: 25.2, lon: 55.27, name: "Dubai", detail: "DMCC / gold & crypto" },
  { id: "mad", lat: 40.42, lon: -3.7, name: "Madrid", detail: "BME / LatAm gateway" },
  { id: "sha", lat: 31.23, lon: 121.47, name: "Shanghai", detail: "SSE" },
];

export interface GeoLine {
  id: string;
  name: string;
  detail: string;
  path: [number, number][]; // [lon, lat]
}

export const UNDERSEA_CABLES: GeoLine[] = [
  { id: "marea", name: "MAREA", detail: "Virginia Beach ↔ Bilbao, 200 Tbps", path: [[-75.98, 36.85], [-45, 39], [-15, 42], [-2.93, 43.26]] },
  { id: "sea-me-we", name: "SEA-ME-WE 5", detail: "Singapore ↔ France via Suez", path: [[103.8, 1.35], [80, 8], [60, 20], [43.3, 12.6], [32.5, 30], [15, 37], [5.37, 43.3]] },
  { id: "2africa", name: "2Africa", detail: "45,000 km ring around Africa", path: [[-5.6, 35.9], [-17.4, 14.7], [3.4, 6.4], [13, -8], [18.4, -33.9], [39.2, -6.8], [43.3, 12.6], [32.5, 30]] },
  { id: "faster", name: "FASTER", detail: "Oregon ↔ Japan/Taiwan", path: [[-124, 44], [-170, 48], [170, 42], [139.7, 35.4]] },
];

export const PIPELINES: GeoLine[] = [
  { id: "ns", name: "Nord Stream", detail: "Sabotaged Sept 2022", path: [[28.5, 60.0], [20, 56.5], [14.3, 55.5], [12.4, 54.6]] },
  { id: "turkstream", name: "TurkStream", detail: "Russia ↔ Turkey via Black Sea", path: [[37.9, 44.9], [32, 43], [28.1, 41.6]] },
  { id: "medgaz", name: "Medgaz", detail: "Algeria ↔ Almería", path: [[1.6, 35.8], [-1.5, 35.5], [-2.46, 36.83]] },
  { id: "druzhba", name: "Druzhba", detail: "Longest oil pipeline in the world", path: [[52.3, 55.8], [44, 54], [34, 52], [24, 51], [18, 50.5], [12.4, 51.3]] },
];