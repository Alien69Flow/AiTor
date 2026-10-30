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
  { id: "hormuz", lat: 26.57, lon: 56.25, name: "Strait of Hormuz", detail: "≈20 Mb/d crude + a fifth of global LNG · 39 km wide, 3 km lanes" },
  { id: "malacca", lat: 1.30, lon: 103.50, name: "Strait of Malacca", detail: "Phillips Channel: 2.8 km wide, 25 m deep · ~30% of traded goods" },
  { id: "suez", lat: 30.02, lon: 32.56, name: "Suez Canal", detail: "193 km, no locks, 24 m draft · 12–15% of world trade" },
  { id: "panama", lat: 9.08, lon: -79.68, name: "Panama Canal", detail: "Neopanamax locks · Gatun Lake level sets the daily slot count" },
  { id: "bosphorus", lat: 41.12, lon: 29.07, name: "Bosphorus", detail: "Black Sea's only outlet · 700 m at the narrows, Montreux regime" },
  { id: "dardanelles", lat: 40.20, lon: 26.40, name: "Dardanelles", detail: "Aegean leg of the Turkish Straits · 1.2 km at Çanakkale" },
  { id: "gibraltar", lat: 35.95, lon: -5.60, name: "Strait of Gibraltar", detail: "13 km at the narrows · Atlantic–Mediterranean gateway" },
  { id: "bab", lat: 12.58, lon: 43.33, name: "Bab el-Mandeb", detail: "Perim Island splits the lane to 3 km · Red Sea south gate" },
  { id: "dover", lat: 51.02, lon: 1.45, name: "Strait of Dover", detail: "Busiest lane on Earth · 400+ vessels and 150 ferries a day" },
  { id: "danish", lat: 55.60, lon: 12.70, name: "Danish Straits", detail: "Øresund + Great Belt · Russia's Baltic export route" },
  { id: "taiwan", lat: 24.50, lon: 119.50, name: "Taiwan Strait", detail: "130–180 km wide · ~half of world container traffic" },
  { id: "luzon", lat: 21.00, lon: 121.50, name: "Luzon Strait", detail: "Bashi Channel · PLAN breakout route into the Pacific" },
  { id: "lombok", lat: -8.60, lon: 115.70, name: "Lombok Strait", detail: "250 m deep, 18 km wide · the deep-draft Malacca alternative" },
  { id: "sunda", lat: -6.00, lon: 105.50, name: "Sunda Strait", detail: "Java–Sumatra · only 20 m deep, so VLCCs cannot use it" },
  { id: "makassar", lat: -1.00, lon: 118.50, name: "Makassar Strait", detail: "Indonesian throughflow · VLCC route between Lombok and Sunda" },
  { id: "otranto", lat: 40.20, lon: 19.00, name: "Strait of Otranto", detail: "72 km · Adriatic mouth, Albanian–Italian gap" },
  { id: "sicily", lat: 37.00, lon: 11.50, name: "Sicilian Channel", detail: "Pantelleria–Tunisia gap, 145 km · Italy's gas corridor" },
  { id: "messina", lat: 38.25, lon: 15.63, name: "Strait of Messina", detail: "3.3 km between Sicily and Calabria" },
  { id: "korea", lat: 34.00, lon: 129.00, name: "Korea Strait", detail: "Tsushima gap · Japan–Korea sealane" },
  { id: "tsugaru", lat: 41.50, lon: 140.50, name: "Tsugaru Strait", detail: "Honshu–Hokkaido · 19.5 km, international waters" },
  { id: "laperouse", lat: 45.80, lon: 142.00, name: "La Pérouse Strait", detail: "Sakhalin–Hokkaido · 43 km, Russian Pacific access" },
  { id: "kerch", lat: 45.25, lon: 36.50, name: "Kerch Strait", detail: "Azov Sea access · 3.1 km at the narrows, 19 km bridge" },
  { id: "torres", lat: -9.80, lon: 142.20, name: "Torres Strait", detail: "Great Barrier Reef pilotage · Prince of Wales Channel, 12 m" },
  { id: "windward", lat: 19.90, lon: -74.20, name: "Windward Passage", detail: "Cuba–Hispaniola · 80 km, Panama route approach" },
  { id: "yucatan", lat: 21.50, lon: -85.50, name: "Yucatán Channel", detail: "217 km · Gulf of Mexico outlet to the Atlantic" },
  { id: "magellan", lat: -53.50, lon: -70.50, name: "Strait of Magellan", detail: "3 km at Angostura · canal-free Panama alternative" },
  { id: "drake", lat: -58.00, lon: -65.00, name: "Drake Passage", detail: "800 km · Cape Horn route, no transit fees" },
  { id: "bering", lat: 65.80, lon: -169.00, name: "Bering Strait", detail: "82 km between the Diomedes · Northern Sea Route gateway" },
  { id: "vilkitsky", lat: 77.90, lon: 104.00, name: "Vilkitsky Strait", detail: "Severnaya Zemlya–Taymyr gap · NSR bottleneck" },
];

/**
 * Reactors, enrichment, reprocessing and weapons facilities. Coordinates are
 * the published plant/site centroids; the detail column says what the site is
 * for, because a nuclear marker without its role is just a purple dot.
 */
export const NUCLEAR_SITES: GeoPoint[] = [
  // Fuel cycle, enrichment and weapons complex
  { id: "zaporizhzhia", lat: 47.51, lon: 34.59, name: "Zaporizhzhia NPP", detail: "6 × VVER-1000 · Europe's largest plant, held by Russia since 2022" },
  { id: "natanz", lat: 33.72, lon: 51.73, name: "Natanz", detail: "FEP/FFEP gas-centrifuge enrichment, Iran" },
  { id: "fordow", lat: 34.88, lon: 50.99, name: "Fordow", detail: "Enrichment hall 80–90 m inside a mountain" },
  { id: "isfahan", lat: 32.57, lon: 51.81, name: "Isfahan UCF", detail: "Uranium conversion plant (yellowcake → UF6)" },
  { id: "arak", lat: 34.38, lon: 49.24, name: "Arak (IR-40)", detail: "Heavy-water research reactor, core sealed under JCPOA" },
  { id: "bushehr", lat: 28.83, lon: 50.89, name: "Bushehr NPP", detail: "VVER-1000 · Iran's only operating power reactor" },
  { id: "yongbyon", lat: 39.80, lon: 125.75, name: "Yongbyon", detail: "5 MWe reactor + radiochemical lab · DPRK plutonium" },
  { id: "dimona", lat: 31.00, lon: 35.14, name: "Dimona", detail: "Negev Nuclear Research Center · undeclared arsenal" },
  { id: "sellafield", lat: 54.42, lon: -3.50, name: "Sellafield", detail: "Magnox/THORP reprocessing · world's oldest waste stockpile" },
  { id: "la-hague", lat: 49.68, lon: -1.88, name: "La Hague", detail: "Orano reprocessing · ~1 000 t of spent fuel a year" },
  { id: "rokkasho", lat: 40.96, lon: 141.33, name: "Rokkasho", detail: "Reprocessing + MOX plant · Japan's closed fuel cycle" },
  { id: "chernobyl", lat: 51.39, lon: 30.10, name: "Chernobyl", detail: "Unit 4 destroyed 1986 · New Safe Confinement arch" },
  { id: "mayak", lat: 55.71, lon: 60.85, name: "Mayak (Ozersk)", detail: "Reprocessing · site of the 1957 Kyshtym accident" },
  { id: "hanford", lat: 46.55, lon: -119.49, name: "Hanford", detail: "US plutonium production · 56 Mgal of tank waste" },
  { id: "los-alamos", lat: 35.88, lon: -106.30, name: "Los Alamos", detail: "US weapons design laboratory" },
  { id: "oak-ridge", lat: 35.93, lon: -84.31, name: "Oak Ridge (Y-12)", detail: "Highly enriched uranium storage and assembly" },
  { id: "pantex", lat: 35.31, lon: -101.56, name: "Pantex", detail: "US warhead assembly and disassembly plant" },
  { id: "savannah-river", lat: 33.25, lon: -81.66, name: "Savannah River", detail: "H-Canyon reprocessing + MOX facility" },
  // Reactors that matter for grid, geopolitics or geography
  { id: "fukushima-daiichi", lat: 37.42, lon: 141.03, name: "Fukushima Daiichi", detail: "6 BWRs · 2011 meltdown, ALPS water release" },
  { id: "kashiwazaki-kariwa", lat: 37.43, lon: 138.60, name: "Kashiwazaki-Kariwa", detail: "7 units, 8.2 GW · world's largest nuclear site" },
  { id: "onagawa", lat: 38.40, lon: 141.50, name: "Onagawa", detail: "BWR closest to the 2011 epicentre, survived intact" },
  { id: "bruce", lat: 44.33, lon: -81.60, name: "Bruce", detail: "8 CANDU, 6.3 GW · largest operating station on Earth" },
  { id: "darlington", lat: 43.87, lon: -78.72, name: "Darlington", detail: "4 CANDU · site of the first grid-scale SMRs" },
  { id: "pickering", lat: 43.81, lon: -79.07, name: "Pickering", detail: "8 CANDU · refurbishment approved to 2060s" },
  { id: "palo-verde", lat: 33.39, lon: -112.86, name: "Palo Verde", detail: "3 PWR, 4 GW · largest US output, only inland site" },
  { id: "vogtle", lat: 33.14, lon: -81.76, name: "Vogtle", detail: "AP1000 units 3–4 · first new US reactors in 30 years" },
  { id: "watts-bar", lat: 35.60, lon: -84.79, name: "Watts Bar", detail: "TVA PWR · last US reactor to start (2016)" },
  { id: "cattenom", lat: 49.42, lon: 6.22, name: "Cattenom", detail: "4 × 1.3 GW PWR · 12 km from Luxembourg" },
  { id: "gravelines", lat: 51.01, lon: 2.13, name: "Gravelines", detail: "6 PWR, 5.4 GW · France's largest plant" },
  { id: "tricastin", lat: 44.33, lon: 4.72, name: "Tricastin", detail: "4 PWR + Eurodif enrichment + Pierrelatte" },
  { id: "flamanville", lat: 49.54, lon: -1.88, name: "Flamanville", detail: "EPR unit 3, 1.6 GW · first French EPR" },
  { id: "chooz", lat: 50.09, lon: 4.79, name: "Chooz", detail: "2 PWR · Chooz A was the first French PWR" },
  { id: "nogent", lat: 48.51, lon: 3.52, name: "Nogent-sur-Seine", detail: "2 × 1.3 GW · 100 km upstream of Paris" },
  { id: "almaraz", lat: 39.80, lon: -5.70, name: "Almaraz", detail: "2 PWR · Spain's largest, Tagus river cooling" },
  { id: "asco", lat: 41.20, lon: 0.57, name: "Ascó", detail: "2 PWR · Ebro river, Catalonia" },
  { id: "cofrentes", lat: 39.22, lon: -1.05, name: "Cofrentes", detail: "BWR, 1.1 GW · Spain's most powerful single unit" },
  { id: "forsmark", lat: 60.40, lon: 18.17, name: "Forsmark", detail: "3 BWR · Sweden's largest, Baltic coast" },
  { id: "ringhals", lat: 57.26, lon: 12.11, name: "Ringhals", detail: "4 units · Vattenfall's west-coast station" },
  { id: "olkiluoto", lat: 61.24, lon: 21.44, name: "Olkiluoto", detail: "EPR + Onkalo · world's first deep geological repository" },
  { id: "loviisa", lat: 60.37, lon: 26.35, name: "Loviisa", detail: "2 VVER-440 · Finnish coast, Russian fuel" },
  { id: "tihange", lat: 50.53, lon: 5.27, name: "Tihange", detail: "3 PWR · Meuse river, Belgian phase-out reversed" },
  { id: "doel", lat: 51.33, lon: 4.25, name: "Doel", detail: "4 PWR · Scheldt estuary, near Antwerp" },
  { id: "borssele", lat: 51.43, lon: 3.71, name: "Borssele", detail: "1 PWR · the Netherlands' only plant" },
  { id: "temelin", lat: 49.18, lon: 14.38, name: "Temelín", detail: "2 VVER-1000 · Czech Republic" },
  { id: "dukovany", lat: 49.09, lon: 16.15, name: "Dukovany", detail: "4 VVER-440 · Czech Republic" },
  { id: "paks", lat: 46.57, lon: 18.85, name: "Paks", detail: "4 VVER-440 · about half of Hungary's electricity" },
  { id: "kozloduy", lat: 43.75, lon: 23.77, name: "Kozloduy", detail: "2 VVER-1000 · Bulgaria, Danube cooling" },
  { id: "cernavoda", lat: 44.32, lon: 28.06, name: "Cernavodă", detail: "2 CANDU · Romania, Danube–Black Sea canal" },
  { id: "khmelnytskyi", lat: 50.30, lon: 26.65, name: "Khmelnytskyi", detail: "2 VVER-1000 · AP1000 units under construction" },
  { id: "rivne", lat: 51.33, lon: 25.88, name: "Rivne", detail: "4 units · western Ukraine" },
  { id: "south-ukraine", lat: 47.82, lon: 31.22, name: "South Ukraine", detail: "3 VVER · Yuzhnoukrainsk, Southern Bug" },
  { id: "leningrad", lat: 59.85, lon: 29.05, name: "Leningrad (Sosnovy Bor)", detail: "4 RBMK + 2 VVER-1200 · Gulf of Finland" },
  { id: "kursk", lat: 51.67, lon: 35.61, name: "Kursk", detail: "4 RBMK · Kursk-II VVER-TOI replacement" },
  { id: "smolensk", lat: 54.17, lon: 33.25, name: "Smolensk", detail: "3 RBMK · western Russia" },
  { id: "balakovo", lat: 52.09, lon: 47.95, name: "Balakovo", detail: "4 VVER-1000 · Russia's largest output" },
  { id: "novovoronezh", lat: 51.27, lon: 39.22, name: "Novovoronezh", detail: "VVER-1200 flagship · Don river" },
  { id: "rostov", lat: 47.59, lon: 42.37, name: "Rostov (Volgodonsk)", detail: "4 VVER-1000 · Don river, Sea of Azov basin" },
  { id: "kola", lat: 67.47, lon: 32.47, name: "Kola", detail: "4 VVER-440 · Arctic Circle, Murmansk region" },
  { id: "bilibino", lat: 68.05, lon: 166.47, name: "Bilibino", detail: "4 EGP-6 · northernmost CHP reactor, Chukotka" },
  { id: "akkuyu", lat: 36.14, lon: 33.54, name: "Akkuyu", detail: "4 VVER-1200 · Turkey's first plant, Mediterranean coast" },
  { id: "barakah", lat: 23.97, lon: 52.20, name: "Barakah", detail: "4 APR-1400 · first nuclear plant in the Arab world" },
  { id: "hinkley-point", lat: 51.21, lon: -3.13, name: "Hinkley Point C", detail: "2 EPR, 3.2 GW · UK's largest construction site" },
  { id: "sizewell", lat: 52.22, lon: 1.62, name: "Sizewell", detail: "Sizewell B PWR · Sizewell C approved" },
  { id: "heysham", lat: 54.03, lon: -2.90, name: "Heysham", detail: "4 AGR · Lancashire coast" },
  { id: "torness", lat: 55.97, lon: -2.40, name: "Torness", detail: "2 AGR · East Lothian" },
  { id: "koeberg", lat: -33.68, lon: 18.43, name: "Koeberg", detail: "2 PWR · Africa's only nuclear plant, Cape Town grid" },
  { id: "angra", lat: -23.01, lon: -44.47, name: "Angra dos Reis", detail: "2 PWR · Brazil's only operating plant" },
  { id: "atucha", lat: -33.97, lon: -59.21, name: "Atucha", detail: "2 PHWR · Argentina, Paraná river" },
  { id: "laguna-verde", lat: 19.72, lon: -96.41, name: "Laguna Verde", detail: "2 BWR · Mexico's only plant, Gulf coast" },
  { id: "kudankulam", lat: 8.17, lon: 77.71, name: "Kudankulam", detail: "2 VVER-1000 operating, 4 more building · Tamil Nadu" },
  { id: "tarapur", lat: 19.83, lon: 72.66, name: "Tarapur", detail: "2 BWR + 2 PHWR · India's first plant" },
  { id: "kalpakkam", lat: 12.56, lon: 80.16, name: "Kalpakkam", detail: "PFBR fast breeder + MAPS · Tamil Nadu coast" },
  { id: "qinshan", lat: 30.44, lon: 120.95, name: "Qinshan", detail: "7 units · China's first plant, Hangzhou Bay" },
  { id: "daya-bay", lat: 22.60, lon: 114.55, name: "Daya Bay", detail: "2 × 1 GW PWR · supplies Hong Kong" },
  { id: "taishan", lat: 21.92, lon: 112.98, name: "Taishan", detail: "2 EPR · first EPRs to enter operation" },
  { id: "hongyanhe", lat: 39.80, lon: 121.48, name: "Hongyanhe", detail: "6 CPR-1000 · largest in north-east China" },
  { id: "fuqing", lat: 25.45, lon: 119.45, name: "Fuqing", detail: "Hualong One debut · Fujian coast" },
  { id: "tianwan", lat: 34.69, lon: 119.46, name: "Tianwan", detail: "VVER + Hualong One · Jiangsu coast" },
  { id: "sanmen", lat: 29.10, lon: 121.95, name: "Sanmen", detail: "AP1000 debut · Zhejiang coast" },
  { id: "hanbit", lat: 35.42, lon: 126.42, name: "Hanbit (Yeonggwang)", detail: "6 units · South Korea's largest plant" },
  { id: "kori", lat: 35.32, lon: 129.30, name: "Kori", detail: "First Korean plant + APR-1400 · Busan coast" },
  { id: "wolsong", lat: 35.71, lon: 129.48, name: "Wolsong", detail: "CANDU + APR-1400 · Gyeongju" },
  { id: "maanshan", lat: 21.96, lon: 120.75, name: "Maanshan", detail: "2 PWR · Taiwan's south coast" },
  { id: "metsamor", lat: 40.18, lon: 44.15, name: "Metsamor", detail: "2 VVER-440 · Armenia, in a seismic zone" },
  { id: "rooppur", lat: 24.11, lon: 89.05, name: "Rooppur", detail: "2 VVER-1200 · Bangladesh's first plant" },
  { id: "el-dabaa", lat: 31.04, lon: 28.63, name: "El Dabaa", detail: "4 VVER-1200 · Egypt's first plant" },
  { id: "ostrovets", lat: 54.76, lon: 26.09, name: "Ostrovets", detail: "2 VVER-1200 · Belarus' first plant, 45 km from Vilnius" },
  { id: "krsko", lat: 45.94, lon: 15.51, name: "Krško", detail: "1 PWR · jointly owned by Slovenia and Croatia" },
];

/**
 * Permanent, publicly documented installations — the ones whose loss or
 * activation changes a theatre. Each entry names the operator role, because
 * "base" alone says nothing about why it is on the map.
 */
export const MILITARY_BASES: GeoPoint[] = [
  // Europe and the Atlantic
  { id: "ramstein", lat: 49.44, lon: 7.60, name: "Ramstein AB", detail: "USAFE-AFAFRICA HQ · airlift and drone relay hub" },
  { id: "rota", lat: 36.64, lon: -6.35, name: "Naval Station Rota", detail: "US/Spanish · four US destroyers, Atlantic entry" },
  { id: "moron", lat: 37.17, lon: -5.62, name: "Morón AB", detail: "US/Spanish · SPMAGTF Africa and rapid airlift" },
  { id: "incirlik", lat: 37.00, lon: 35.42, name: "Incirlik AB", detail: "Turkish/NATO · southern flank, B61 storage" },
  { id: "aviano", lat: 46.03, lon: 12.60, name: "Aviano AB", detail: "US 31st Fighter Wing · F-16, Adriatic" },
  { id: "lakenheath", lat: 52.41, lon: 0.56, name: "RAF Lakenheath", detail: "US 48th Fighter Wing · F-35A in Europe" },
  { id: "mildenhall", lat: 52.36, lon: 0.49, name: "RAF Mildenhall", detail: "US tankers and special operations" },
  { id: "spangdahlem", lat: 49.97, lon: 6.70, name: "Spangdahlem AB", detail: "US 52nd Fighter Wing · Eifel" },
  { id: "grafenwoehr", lat: 49.70, lon: 11.94, name: "Grafenwöhr", detail: "US Army's largest training area in Europe" },
  { id: "vicenza", lat: 45.55, lon: 11.58, name: "Caserma Ederle", detail: "US 173rd Airborne · SETAF HQ" },
  { id: "faslane", lat: 56.07, lon: -4.82, name: "HMNB Clyde", detail: "UK Trident SSBN base · Gare Loch" },
  { id: "portsmouth", lat: 50.80, lon: -1.10, name: "HMNB Portsmouth", detail: "Royal Navy surface fleet · two carriers" },
  { id: "toulon", lat: 43.12, lon: 5.93, name: "Toulon", detail: "French Mediterranean fleet · Charles de Gaulle" },
  { id: "ile-longue", lat: 48.30, lon: -4.51, name: "Île Longue", detail: "French SSBN base · M51 missiles" },
  { id: "shape", lat: 50.50, lon: 3.98, name: "SHAPE Mons", detail: "NATO Allied Command Operations HQ" },
  { id: "redzikowo", lat: 54.48, lon: 17.10, name: "Redzikowo", detail: "Aegis Ashore · NATO missile-defence site, Poland" },
  { id: "deveselu", lat: 44.09, lon: 24.09, name: "Deveselu", detail: "Aegis Ashore · first NATO site, Romania" },
  { id: "kurecik", lat: 38.35, lon: 37.80, name: "Kürecik", detail: "US AN/TPY-2 radar · Malatya, Turkey" },
  { id: "keflavik", lat: 63.99, lon: -22.61, name: "Keflavík", detail: "Iceland · GIUK gap patrol and P-8 rotations" },
  { id: "thule", lat: 76.53, lon: -68.70, name: "Pituffik (Thule)", detail: "US Space Force · ballistic-missile radar, Arctic" },
  // Middle East, Africa and South Asia
  { id: "al-udeid", lat: 25.12, lon: 51.32, name: "Al Udeid AB", detail: "US CENTCOM forward HQ · largest US base in the Gulf" },
  { id: "al-dhafra", lat: 24.25, lon: 54.55, name: "Al Dhafra AB", detail: "UAE/US · F-35, tankers, ISR over the Gulf" },
  { id: "isa", lat: 25.92, lon: 50.59, name: "Isa Air Base", detail: "Bahrain · US and coalition strike aircraft" },
  { id: "bahrain", lat: 26.21, lon: 50.61, name: "NSA Bahrain", detail: "US 5th Fleet HQ · Manama" },
  { id: "arifjan", lat: 28.94, lon: 48.09, name: "Camp Arifjan", detail: "US Army logistics hub · Kuwait" },
  { id: "duqm", lat: 19.65, lon: 57.70, name: "Duqm", detail: "Omani port · US/UK logistics and dry dock" },
  { id: "diego", lat: -7.31, lon: 72.41, name: "Diego Garcia", detail: "UK/US · bombers and SSB tenders, Indian Ocean" },
  { id: "lemonnier", lat: 11.55, lon: 43.16, name: "Camp Lemonnier", detail: "US AFRICOM · Djibouti, counter-terrorism and drones" },
  { id: "manda-bay", lat: -2.28, lon: 40.90, name: "Manda Bay", detail: "Kenya · US naval and special-operations airfield" },
  { id: "nevatim", lat: 31.21, lon: 35.01, name: "Nevatim AB", detail: "Israeli F-35I squadrons · Negev" },
  { id: "hatzerim", lat: 31.23, lon: 34.66, name: "Hatzerim AB", detail: "Israeli fighter and training wing" },
  { id: "bandar-abbas", lat: 27.14, lon: 56.21, name: "Bandar Abbas", detail: "IRGC Navy HQ · guards the Hormuz approaches" },
  { id: "karwar", lat: 14.79, lon: 74.13, name: "INS Kadamba", detail: "Indian Navy's largest base · Karwar, Arabian Sea" },
  { id: "visakhapatnam", lat: 17.69, lon: 83.28, name: "Visakhapatnam", detail: "Indian Eastern Fleet · Bay of Bengal" },
  { id: "gwadar", lat: 25.12, lon: 62.32, name: "Gwadar", detail: "Pakistan · Chinese-built deep-water port" },
  // Russia
  { id: "sevastopol", lat: 44.61, lon: 33.53, name: "Sevastopol", detail: "Black Sea Fleet HQ · repeatedly struck by USVs" },
  { id: "hmeimim", lat: 35.40, lon: 35.95, name: "Hmeimim AB", detail: "Russian air base · Latakia, Mediterranean power projection" },
  { id: "tartus", lat: 34.90, lon: 35.87, name: "Tartus", detail: "Russia's only Mediterranean naval facility" },
  { id: "severomorsk", lat: 69.07, lon: 33.42, name: "Severomorsk", detail: "Russian Northern Fleet HQ · Kola Bay" },
  { id: "gadzhiyevo", lat: 69.25, lon: 33.33, name: "Gadzhiyevo", detail: "Russian SSBN base · Delta IV and Borei" },
  { id: "baltiysk", lat: 54.65, lon: 19.92, name: "Baltiysk", detail: "Russian Baltic Fleet · Kaliningrad exclave" },
  { id: "vladivostok", lat: 43.12, lon: 131.88, name: "Vladivostok", detail: "Russian Pacific Fleet HQ" },
  { id: "petropavlovsk", lat: 53.02, lon: 158.65, name: "Petropavlovsk", detail: "Russian SSBN bastion · Kamchatka" },
  { id: "engels", lat: 51.48, lon: 46.21, name: "Engels AB", detail: "Russian Tu-95/Tu-160 strategic bomber base" },
  { id: "belaya", lat: 52.92, lon: 103.58, name: "Belaya AB", detail: "Russian Tu-22M3 and Tu-160 · Irkutsk" },
  // China
  { id: "yulin", lat: 18.22, lon: 109.53, name: "Yulin (Sanya)", detail: "PLAN South Sea Fleet submarine base · Hainan" },
  { id: "zhanjiang", lat: 21.20, lon: 110.38, name: "Zhanjiang", detail: "PLAN South Sea Fleet HQ · Leizhou peninsula" },
  { id: "qingdao", lat: 36.07, lon: 120.38, name: "Qingdao", detail: "PLAN North Sea Fleet HQ · Shandong" },
  { id: "ningbo", lat: 29.87, lon: 121.55, name: "Ningbo", detail: "PLAN East Sea Fleet HQ · Zhejiang" },
  { id: "kashgar", lat: 39.47, lon: 75.99, name: "Kashgar", detail: "PLA Western Theater · Xinjiang, near the Wakhan" },
  { id: "djibouti-cn", lat: 11.59, lon: 43.05, name: "PLA Djibouti", detail: "China's only overseas base · Doraleh" },
  { id: "fiery-cross", lat: 9.55, lon: 112.89, name: "Fiery Cross Reef", detail: "Chinese artificial island · 3 300 m runway" },
  { id: "subi-reef", lat: 10.92, lon: 114.08, name: "Subi Reef", detail: "Chinese artificial island · Spratlys" },
  // Asia-Pacific
  { id: "yokosuka", lat: 35.29, lon: 139.67, name: "Yokosuka", detail: "US 7th Fleet HQ · only forward-deployed carrier" },
  { id: "kadena", lat: 26.36, lon: 127.77, name: "Kadena AB", detail: "US Pacific Air Forces' largest wing · Okinawa" },
  { id: "misawa", lat: 40.70, lon: 141.37, name: "Misawa AB", detail: "US F-16 and SIGINT · northern Honshu" },
  { id: "iwakuni", lat: 34.14, lon: 132.24, name: "MCAS Iwakuni", detail: "USMC F-35B · Inland Sea" },
  { id: "sasebo", lat: 33.16, lon: 129.72, name: "Sasebo", detail: "US/Japan amphibious base · Kyushu" },
  { id: "humphreys", lat: 36.96, lon: 127.03, name: "Camp Humphreys", detail: "USFK HQ · largest US base in Korea" },
  { id: "osan", lat: 37.09, lon: 127.03, name: "Osan AB", detail: "US 7th Air Force · F-16 and A-10" },
  { id: "kunsan", lat: 35.90, lon: 126.62, name: "Kunsan AB", detail: "US F-16 wing · Yellow Sea" },
  { id: "andersen", lat: 13.58, lon: 144.92, name: "Andersen AFB", detail: "US bombers · Guam, second-island chain" },
  { id: "guam-naval", lat: 13.44, lon: 144.65, name: "Naval Base Guam", detail: "US submarine squadron · Apra Harbor" },
  { id: "hualien", lat: 24.00, lon: 121.62, name: "Hualien", detail: "Taiwan · Chiashan hardened aircraft shelters" },
  { id: "subic", lat: 14.79, lon: 120.28, name: "Subic Bay", detail: "Philippines · EDCA site facing the South China Sea" },
  { id: "sinpo", lat: 40.03, lon: 128.19, name: "Sinpo", detail: "DPRK submarine and SLBM test yard" },
  { id: "changi", lat: 1.32, lon: 103.98, name: "Changi Naval Base", detail: "Republic of Singapore Navy · US littoral access" },
  { id: "darwin", lat: -12.44, lon: 130.85, name: "Robertson Barracks", detail: "Australian/US Marine rotational force · Darwin" },
  { id: "pine-gap", lat: -23.80, lon: 133.74, name: "Pine Gap", detail: "US/Australia satellite ground station · Joint Defence Facility" },
  // Americas
  { id: "pearl-harbor", lat: 21.35, lon: -157.95, name: "Pearl Harbor–Hickam", detail: "US INDOPACOM · Pacific Fleet HQ" },
  { id: "norfolk", lat: 36.95, lon: -76.31, name: "Naval Station Norfolk", detail: "World's largest naval station · Atlantic Fleet" },
  { id: "san-diego", lat: 32.68, lon: -117.13, name: "Naval Base San Diego", detail: "US Pacific surface fleet homeport" },
  { id: "fort-liberty", lat: 35.14, lon: -79.00, name: "Fort Liberty", detail: "US Army's largest installation · XVIII Airborne" },
  { id: "nellis", lat: 36.24, lon: -115.03, name: "Nellis AFB", detail: "USAF Warfare Center · Red Flag" },
  { id: "offutt", lat: 41.12, lon: -95.91, name: "Offutt AFB", detail: "US STRATCOM HQ · Omaha" },
  { id: "whiteman", lat: 38.73, lon: -93.55, name: "Whiteman AFB", detail: "US B-2 Spirit fleet" },
  { id: "minot", lat: 48.42, lon: -101.36, name: "Minot AFB", detail: "US B-52 and Minuteman III · North Dakota" },
  { id: "barksdale", lat: 32.50, lon: -93.66, name: "Barksdale AFB", detail: "US Global Strike Command HQ · B-52" },
  { id: "guantanamo", lat: 19.90, lon: -75.15, name: "Guantánamo Bay", detail: "US naval station · leased since 1903" },
  { id: "soto-cano", lat: 14.38, lon: -87.62, name: "Soto Cano AB", detail: "US JTF-Bravo · Honduras, Central America" },
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

/**
 * Submarine systems, with real landing points and a few ocean waypoints.
 *
 * These are the fallback: the globe prefers the full TeleGeography GeoJSON
 * (~220 systems, precise geometry) and only draws this catalogue when that
 * fetch fails, so the two never stack. `path` runs landing → landing in
 * [lon, lat]; capacity and length come from the consortium's own specs.
 */
export const UNDERSEA_CABLES: GeoLine[] = [
  { id: "marea", name: "MAREA", detail: "Virginia Beach ↔ Bilbao · 6 600 km · 224 Tbps", path: [[-75.98, 36.85], [-60, 38.5], [-40, 40.5], [-20, 42.5], [-2.93, 43.26]] },
  { id: "dunant", name: "Dunant", detail: "Virginia Beach ↔ Saint-Hilaire-de-Riez · 6 400 km · 250 Tbps", path: [[-75.98, 36.85], [-55, 39], [-35, 42], [-17, 45], [-1.98, 46.70]] },
  { id: "amitie", name: "Amitié", detail: "Lynn ↔ Le Porge · 6 800 km · first 24-fibre-pair transatlantic", path: [[-70.95, 42.47], [-50, 44], [-30, 45.5], [-1.19, 44.87]] },
  { id: "tat14", name: "TAT-14", detail: "NJ ↔ Blaabjerg/Norden/Katwijk/Bude · 15 428 km", path: [[-74.03, 40.12], [-50, 44], [-25, 49], [-8, 50], [4.40, 52.20]] },
  { id: "apollo", name: "Apollo", detail: "Bude ↔ Manasquan · 6 500 km · 25 Tbps", path: [[-4.55, 50.83], [-25, 48], [-50, 44], [-74.03, 40.12]] },
  { id: "havfrue", name: "Havfrue / AEC-2", detail: "NJ ↔ Blaabjerg ↔ Larvik · 7 850 km", path: [[-74.03, 40.12], [-45, 45], [-20, 52], [-1.5, 56], [8.15, 55.75], [9.98, 59.04]] },
  { id: "faster", name: "FASTER", detail: "Bandon OR ↔ Shima ↔ Tanshui · 9 000 km · 60 Tbps", path: [[-124.41, 43.12], [-150, 47], [-175, 45], [170, 41], [136.83, 34.34], [121.44, 25.17]] },
  { id: "jupiter", name: "JUPITER", detail: "Hermosa Beach ↔ Maruyama ↔ Daet · 14 000 km · 400 Tbps design", path: [[-118.40, 33.87], [-150, 35], [-175, 36], [160, 36], [139.94, 34.94], [122.95, 14.12]] },
  { id: "unity", name: "Unity", detail: "Redondo Beach ↔ Chikura · 10 000 km · 12 Tbps", path: [[-118.39, 33.83], [-150, 32], [-180, 32], [160, 33], [140.00, 34.93]] },
  { id: "plcn", name: "PLCN", detail: "El Segundo ↔ Baler · 12 800 km · 144 Tbps", path: [[-118.42, 33.92], [-150, 30], [-180, 25], [160, 20], [121.56, 15.76]] },
  { id: "tpe", name: "Trans-Pacific Express", detail: "Nedonna Beach ↔ Japan ↔ Taiwan ↔ Qingdao · 18 000 km", path: [[-123.94, 45.62], [-150, 48], [-180, 45], [160, 42], [140.75, 36.79], [121.44, 25.17], [126.62, 37.09], [120.38, 36.07]] },
  { id: "hawaiki", name: "Hawaiki", detail: "Pacific City ↔ Hawaii ↔ Mangawhai ↔ Sydney · 15 000 km · 43 Tbps", path: [[-123.97, 45.47], [-150, 38], [-157.95, 21.35], [-170, 5], [179, -25], [174.50, -36.10], [151.29, -33.70]] },
  { id: "sccn", name: "Southern Cross NEXT", detail: "Sydney ↔ Auckland ↔ Hawaii ↔ LA · 72 Tbps", path: [[151.29, -33.70], [174.50, -36.10], [178, -10], [-157.95, 21.35], [-140, 30], [-118.40, 33.87]] },
  { id: "seamewe5", name: "SEA-ME-WE 5", detail: "Singapore ↔ Marseille via Suez · 20 000 km · 24 Tbps", path: [[103.82, 1.35], [100.33, 5.41], [72.88, 19.08], [55, 18], [43.05, 11.59], [39.18, 21.49], [32.53, 29.97], [15.08, 37.50], [5.37, 43.30]] },
  { id: "seamewe3", name: "SEA-ME-WE 3", detail: "Norden ↔ Singapore ↔ Japan ↔ Perth · 39 000 km", path: [[7.20, 53.60], [-6.20, 36.47], [-16.91, 32.65], [29.92, 31.20], [43.05, 11.59], [58.41, 23.59], [80.28, 13.08], [79.86, 6.83], [100.33, 5.41], [103.82, 1.35], [107.00, 10.00], [114.17, 22.32], [127.98, 26.59], [129.30, 35.32], [115.86, -31.95]] },
  { id: "2africa", name: "2Africa", detail: "Ring around Africa and back via Suez · 45 000 km · 180 Tbps", path: [[32.30, 31.26], [43.05, 11.59], [39.72, -4.03], [39.28, -6.82], [18.44, -33.72], [14.53, -22.68], [13.23, -8.79], [11.86, -4.78], [9.43, 0.42], [3.39, 6.44], [-0.19, 5.55], [-4.02, 5.30], [-17.47, 14.72], [-15.98, 18.09], [-5.80, 35.77], [5.37, 43.30], [15.08, 37.50]] },
  { id: "eig", name: "Europe India Gateway", detail: "Bude ↔ Gibraltar ↔ Suez ↔ Mumbai · 15 000 km", path: [[-4.55, 50.83], [-9.13, 37.55], [-5.60, 36.00], [5.37, 43.30], [23.73, 37.98], [29.92, 31.20], [39.18, 21.49], [43.05, 11.59], [58.41, 23.59], [72.88, 19.08]] },
  { id: "mainone", name: "MainOne", detail: "Lagos ↔ Accra ↔ Casablanca ↔ Seixal · 14 000 km · 10 Tbps", path: [[3.39, 6.44], [-0.19, 5.55], [-7.59, 33.57], [-9.10, 38.64]] },
  { id: "wacs", name: "WACS", detail: "Melkbosstrand ↔ Sines · 14 500 km · west coast ring", path: [[18.44, -33.72], [11.00, -18.00], [-5.00, 5.00], [-8.87, 37.95]] },
  { id: "sam1", name: "SAm-1", detail: "Santos ↔ Fortaleza ↔ San Juan ↔ Boca Raton · 25 000 km", path: [[-46.32, -24.00], [-40, -15], [-38.52, -3.72], [-60, 10], [-66.10, 18.43], [-80.09, 26.35]] },
  { id: "curie", name: "Curie", detail: "Valparaíso ↔ El Segundo · 10 500 km", path: [[-71.63, -33.03], [-80, -20], [-100, -5], [-118.42, 33.92]] },
  { id: "monet", name: "MONET", detail: "Miami ↔ Fortaleza ↔ Santos · 10 560 km", path: [[-80.13, 25.77], [-60, 15], [-38.52, -3.72], [-46.32, -24.00]] },
  { id: "malbec", name: "Malbec", detail: "Santos ↔ Buenos Aires · 2 500 km", path: [[-46.32, -24.00], [-48, -30], [-58.38, -34.60]] },
  { id: "aag", name: "Asia-America Gateway", detail: "Malaysia ↔ HK ↔ Guam ↔ Hawaii ↔ California · 20 000 km", path: [[103.84, 2.44], [100.60, 7.20], [107.08, 10.35], [114.17, 22.32], [144.79, 13.44], [-158.10, 21.59], [-120.85, 35.37]] },
  { id: "asc", name: "Australia–Singapore Cable", detail: "Perth ↔ Jakarta ↔ Singapore · 4 600 km", path: [[115.84, -32.01], [106.88, -6.10], [103.85, 1.20]] },
  { id: "shefa2", name: "SHEFA-2", detail: "Shetland ↔ Faroe ↔ Iceland · repeated subsea outages", path: [[-2.09, 57.15], [-6.77, 62.01], [-20.00, 63.60]] },
  { id: "greenland-connect", name: "Greenland Connect", detail: "Nuuk ↔ Qaqortoq ↔ Newfoundland", path: [[-46.04, 60.72], [-48, 55], [-53.97, 48.55]] },
  { id: "clion1", name: "C-Lion1", detail: "Helsinki ↔ Rostock · 1 100 km · severed in the Baltic, Oct 2024", path: [[24.94, 60.16], [20.00, 57.50], [12.10, 54.18]] },
];

/** Major oil and gas trunk lines, with operator-published capacities. */
export const PIPELINES: GeoLine[] = [
  { id: "nord-stream", name: "Nord Stream 1 & 2", detail: "Vyborg ↔ Greifswald · 2 × 1 224 km · 55 bcm/yr each · sabotaged 2022", path: [[28.73, 60.72], [22, 58], [17, 56], [13.44, 54.15]] },
  { id: "turkstream", name: "TurkStream", detail: "Anapa ↔ Kıyıköy · 2 × 930 km · 31.5 bcm/yr", path: [[37.32, 44.90], [31, 43], [28.08, 41.63]] },
  { id: "blue-stream", name: "Blue Stream", detail: "Dzhubga ↔ Samsun · 1 213 km · 16 bcm/yr", path: [[38.70, 44.30], [37.50, 42.50], [36.20, 41.35]] },
  { id: "medgaz", name: "Medgaz", detail: "Beni Saf ↔ Almería · 210 km · 10.5 bcm/yr", path: [[-1.38, 35.30], [-2.20, 35.60], [-2.40, 36.83]] },
  { id: "transmed", name: "Trans-Mediterranean", detail: "Hassi R'Mel ↔ Sicily ↔ Minerbio · 2 475 km · 33.5 bcm/yr", path: [[3.27, 32.93], [9.00, 35.00], [11.02, 37.06], [12.59, 37.65], [11.48, 44.62]] },
  { id: "greenstream", name: "Greenstream", detail: "Mellitah ↔ Gela · 520 km · 11 bcm/yr", path: [[12.03, 32.09], [13.20, 34.50], [14.21, 37.03]] },
  { id: "tap", name: "Trans-Adriatic (TAP)", detail: "Kipoi ↔ Melendugno · 878 km · 10 bcm/yr", path: [[26.15, 40.75], [20.00, 41.00], [19.56, 40.72], [18.36, 40.26]] },
  { id: "tanap", name: "TANAP", detail: "Posof ↔ Eskişehir ↔ Greece · 1 850 km · 16 bcm/yr", path: [[42.55, 41.55], [38.00, 40.00], [30.52, 39.78], [26.15, 40.75]] },
  { id: "scp", name: "South Caucasus Pipeline", detail: "Baku ↔ Tbilisi ↔ Turkey · 692 km", path: [[49.87, 40.40], [46.00, 41.20], [44.79, 41.72], [42.55, 41.55]] },
  { id: "btc", name: "Baku–Tbilisi–Ceyhan", detail: "Baku ↔ Ceyhan · 1 768 km · 1.2 Mb/d, bypasses Russia and Hormuz", path: [[49.87, 40.40], [44.79, 41.72], [41.27, 39.90], [35.80, 36.88]] },
  { id: "druzhba-n", name: "Druzhba (north)", detail: "Almetyevsk ↔ Schwedt · 4 000 km, world's longest oil line", path: [[52.30, 54.90], [40, 53.5], [34.36, 53.28], [22.10, 52.75], [14.30, 53.05]] },
  { id: "druzhba-s", name: "Druzhba (south)", detail: "Bryansk ↔ Budkovce ↔ Százhalombatta · Hungary and Czech branches", path: [[34.36, 53.28], [26, 50.5], [21.91, 48.66], [18.92, 47.30]] },
  { id: "yamal-europe", name: "Yamal–Europe", detail: "Torzhok ↔ Frankfurt (Oder) · 4 196 km", path: [[34.96, 57.04], [28, 54.5], [23.85, 53.27], [14.56, 52.35]] },
  { id: "kirkuk-ceyhan", name: "Kirkuk–Ceyhan", detail: "Kirkuk ↔ Ceyhan · 970 km · 1.6 Mb/d", path: [[44.39, 35.47], [43.49, 34.93], [42.36, 37.10], [39.00, 37.00], [35.80, 36.88]] },
  { id: "petroline", name: "Petroline (East–West)", detail: "Abqaiq ↔ Yanbu · 1 200 km · 5 Mb/d, the Hormuz hedge", path: [[49.68, 25.94], [46, 25.5], [42, 25.0], [38.06, 24.09]] },
  { id: "adcop", name: "ADCOP (Habshan–Fujairah)", detail: "Habshan ↔ Fujairah · 360 km · 1.5 Mb/d, skips Hormuz", path: [[53.60, 23.75], [55.00, 24.50], [56.35, 25.12]] },
  { id: "sumed", name: "SUMED", detail: "Ain Sukhna ↔ Sidi Kerir · 320 km · 2.5 Mb/d around the canal", path: [[32.33, 29.60], [31.00, 30.40], [29.66, 31.03]] },
  { id: "eilat-ashkelon", name: "Eilat–Ashkelon (EAPC)", detail: "Eilat ↔ Ashkelon · 254 km · Red Sea to Mediterranean", path: [[34.95, 29.55], [34.80, 31.00], [34.57, 31.67]] },
  { id: "taps", name: "Trans-Alaska (TAPS)", detail: "Prudhoe Bay ↔ Valdez · 1 288 km · 2 Mb/d", path: [[-148.34, 70.26], [-146.00, 66.00], [-146.35, 61.13]] },
  { id: "keystone", name: "Keystone", detail: "Hardisty ↔ Cushing ↔ Port Arthur · 4 324 km", path: [[-111.30, 52.68], [-101.00, 49.00], [-97.10, 40.05], [-96.77, 35.98], [-93.93, 29.90]] },
  { id: "colonial", name: "Colonial", detail: "Houston ↔ Linden · 8 850 km · largest US refined-products line", path: [[-95.35, 29.75], [-90.00, 32.00], [-79.79, 36.07], [-74.25, 40.63]] },
  { id: "west-east-gas", name: "West–East Gas (China)", detail: "Tarim ↔ Jingbian ↔ Shanghai · 8 700 km", path: [[84.40, 41.10], [100.00, 39.00], [108.80, 37.60], [117.20, 39.10], [121.47, 31.23]] },
  { id: "power-of-siberia", name: "Power of Siberia", detail: "Chayanda ↔ Heihe · 3 000 km · 38 bcm/yr", path: [[118.63, 58.28], [125.00, 54.00], [127.54, 50.29], [127.49, 50.24]] },
  { id: "espo", name: "ESPO", detail: "Taishet ↔ Kozmino · 4 740 km · Pacific crude outlet", path: [[98.00, 55.94], [110.00, 55.00], [123.94, 53.99], [132.83, 42.78]] },
  { id: "central-asia-china", name: "Central Asia–China", detail: "Galkynysh ↔ Khorgos · 1 833 km · 55 bcm/yr", path: [[61.50, 37.50], [66.00, 40.00], [68.30, 43.20], [80.42, 44.20]] },
  { id: "maghreb-europe", name: "Maghreb–Europe (MEG)", detail: "Hassi R'Mel ↔ Córdoba ↔ Tarifa · 1 620 km", path: [[3.27, 32.93], [0.00, 34.50], [-5.00, 35.00], [-5.60, 36.01]] },
];