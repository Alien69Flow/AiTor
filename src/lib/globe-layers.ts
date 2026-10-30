import {
	Wind, Cloud, Gauge, Compass, Thermometer, Droplets,
	Sun, Flame, Activity, Plane, Ship, TrendingUp,
	Satellite, AlertTriangle, Shield, Landmark, Radio,
	Bitcoin, Zap, Crosshair, Waves,
	CloudFog, Tornado, SunMedium, MoonStar, Contrast, Camera,
	Leaf, Fish, Snowflake, Factory, CloudDrizzle, Cloudy, Atom,
	ThermometerSun, Sprout, Orbit, RadioTower, Magnet, Video, Radiation,
	type LucideIcon,
} from "lucide-react";

export type EnvLayerKey =
	| "atmosphere"
	| "clouds"
	| "isobars"
	| "wind"
	| "temperature"
	| "humidity"
	| "precipitation"
	| "solarActivity"
	| "wildfires"
	| "earthquakes"
	| "airTraffic"
	| "marineTraffic"
	| "marketData"
	// WorldMonitor-style layers
	| "conflictZones"
	| "nuclearSites"
	| "militaryBases"
	| "underseaCables"
	| "pipelines"
	| "chokepoints"
	| "satellites"
	| "internetOutages"
	| "economicCenters"
	// Earth-observation layers (NASA GIBS rasters)
	| "satelliteImagery"
	| "airQuality"
	| "dust"
	| "seaTemperature"
	| "uvIndex"
	| "nightLights"
	| "dayNight"
	// Envolturas de la atmósfera y esferas terrestres
	| "cloudTopHeight"
	| "stratosphere"
	| "seaSalinity"
	| "iceSurfaceTemp"
	// Clima, biosfera y sostenibilidad (rasters GIBS sin clave)
	| "precipitationRate"
	| "waterVapor"
	| "ozone"
	| "landSurfaceTemp"
	| "soilMoisture"
	| "vegetation"
	| "oceanChlorophyll"
	| "seaIce"
	| "carbonDioxide"
	// Atmósfera alta y órbita
	| "ionosphere"
	| "magnetosphere"
	| "vanAllen"
	| "heliosphere"
	| "iss"
	// Cámaras del Alien situadas en el globo
	| "liveCameras";

export type Tier = "signal" | "node" | "synapse" | "oracle" | "quantum";

export const TIER_RANK: Record<Tier, number> = {
	signal: 0,
	node: 1,
	synapse: 2,
	oracle: 3,
	quantum: 4,
};
export const TIER_LABEL: Record<Tier, string> = {
	signal: "Signal",
	node: "Node",
	synapse: "Synapse",
	oracle: "Oracle",
	quantum: "Quantum",
};

export type LayerGroup =
	| "Atmospheric & Weather"
	| "Biosphere & Climate"
	| "Space & Cosmos"
	| "OSINT & Hazards"
	| "Markets & Feeds"
	| "Strategic Infrastructure"
	| "Geopolitical";

export interface globeLayerDef {
	key: EnvLayerKey;
	label: string;
	group: LayerGroup;
	color: string;
	Icon: LucideIcon;
	/** OpenWeatherMap tile layer id, proxied server-side */
	owm?: string;		/**
		 * NASA GIBS raster tile config (open, no API key). Each layer links its own
		 * TileMatrixSet — asking for the wrong level returns `TILEMATRIXSET is
		 * invalid for LAYER` — and its own TIME availability window, so level and
		 * date policy live here instead of being hard-coded in the renderer.
		 */
		gibs?: {
			/** GIBS layer identifier (WMTS) */
			layer: string;
			/** GoogleMapsCompatible level linked by that layer (6, 8, 9…) */
			level: number;
			alpha?: number;
			/** Hours to subtract from today for daily products (default 36 ≈ ayer) */
			dateOffsetHours?: number;
			/** Fixed TIME value for layers that no longer publish daily data */
			date?: string;
			/**
			 * Sin segmento TIME. Sirve para dos casos, ambos comprobados contra
			 * el servidor: capas de climatología que no tienen dimensión temporal
			 * (CERES UV, Black Marble) y productos periódicos —compuestos de 16
			 * días, medias mensuales, CO₂— donde pedir una fecha cualquiera
			 * responde 404, pero omitirla devuelve la última disponible. Con
			 * `dateOffsetHours` esas capas fallarían casi todos los días.
			 */
			timeless?: boolean;
		};
	requiredTier: Tier;
	/** Data source attribution */
	source?: string;
	/** How fresh is the data */
	freshness?: string;
	/** Brief description */
	description?: string;
}

/**
 * Fuentes vivas que no son rasters: su capa sólo existe si un conector trae
 * datos reales. Se declaran aquí para que el catálogo y el globo no puedan
 * discrepar sobre qué capas necesitan conector.
 */
/**
 * Envolturas de la atmósfera y esferas de la Tierra, para lo que el panel
 * agrupa pero el globo necesita saber: `key` de la capa que la representa y si
 * existe una fuente abierta capaz de medirla.
 *
 * La mesosfera no tiene capa porque ninguna de las fuentes abiertas que usa
 * este proyecto publica una malla suya: el perfilador MLS de Aura llega a 46 hPa
 * (~22 km, estratosfera alta) y el limbo de OMPS mide aerosoles entre 12 y
 * 20 km. Lo único que el globo dibuja a esa altura es el óvalo auroral (unos
 * 100 km), que es de la termosfera. Se declara aquí para que no parezca un
 * olvido y para que se vea de un vistazo qué falta si aparece una fuente.
 */
export interface EarthShell {
	id: string;
	label: string;
	/** Altura o extensión que abarca. */
	range: string;
	/**
	 * `shell` es una capa de altitud y `sphere` una esfera del sistema (vida,
	 * campo magnético, radiación atrapada, burbuja solar): no se apilan por
	 * altura, pero el panel las presenta juntas porque son la misma pregunta
	 * —qué envuelve a la Tierra y qué lo mide—.
	 */
	kind: "shell" | "sphere";
	/** Capa del globo que la representa, si la hay. */
	layer?: EnvLayerKey;
	/** Instrumento que la mide, cuando existe. */
	source?: string;
	/** Qué queda fuera y por qué, cuando la capa no mide todo lo que abarca. */
	note?: string;
}

export const EARTH_SHELLS: EarthShell[] = [
	// Envolturas por altitud, de la superficie al espacio.
	{
		id: "troposphere", label: "Troposfera", range: "0-16 km", kind: "shell",
		layer: "cloudTopHeight", source: "NASA GIBS · MODIS Cloud Top Height",
	},
	{
		id: "stratosphere", label: "Estratosfera", range: "16-50 km", kind: "shell",
		layer: "stratosphere", source: "NASA GIBS · Aura MLS a 46 hPa (~22 km)",
		note: "La capa sondea el tercio inferior de la envoltura: es donde está la capa de ozono y donde se ve el calentamiento súbito.",
	},
	{
		id: "mesosphere", label: "Mesosfera", range: "50-85 km", kind: "shell",
		note: "Sin capa: ninguna fuente abierta de este proyecto publica una malla suya (MLS llega a ~22 km y el limbo de OMPS mide aerosoles entre 12 y 20 km).",
	},
	{
		id: "thermosphere", label: "Termosfera / Ionosfera", range: "85-600 km", kind: "shell",
		layer: "ionosphere", source: "NOAA SWPC · GLOTEC (TEC)",
		note: "Lo que se mide es el contenido electrónico total: la ionización, que es la parte útil para radio y GNSS.",
	},
	{
		id: "exosphere", label: "Exosfera", range: "+600 km", kind: "shell",
		layer: "iss", source: "WhereTheISS.at (TLE NORAD 25544)",
		note: "La ISS orbita a ~420 km, dentro de la termosfera alta; la capa marca la frontera con el espacio y la estación que la cruza.",
	},

	// Esferas del sistema: no son alturas, son dominios.
	{
		id: "biosphere", label: "Biosfera", range: "Superficie, agua y aire", kind: "sphere",
		layer: "vegetation", source: "NASA GIBS · MODIS NDVI (16 días)",
		note: "Se lee por el vigor de la vegetación y la clorofila marina: la parte viva del sistema.",
	},
	{
		id: "magnetosphere", label: "Magnetosfera", range: "~10 R⊕ de día, cola a >100 R⊕", kind: "sphere",
		layer: "magnetosphere", source: "NOAA SWPC · OVATION (óvalo auroral)",
		note: "El globo dibuja su huella ionosférica, el óvalo auroral; el campo en L1 lo mide el conector del viento solar (Bt y Bz).",
	},
	{
		id: "vanAllen", label: "Cinturones de Van Allen", range: "1,2-8 R⊕", kind: "sphere",
		layer: "vanAllen", source: "NOAA GOES · electrones >2 MeV",
		note: "La intensidad medida es la del cinturón exterior (GOES está dentro de él, a 6,6 R⊕); el interior es de protones y se dibuja sin intensidad propia.",
	},
	{
		id: "heliosphere", label: "Heliosfera", range: "Frontera a ~120 UA", kind: "sphere",
		layer: "heliosphere", source: "NOAA SWPC · viento solar en L1",
		note: "Se mide lo que la infla (velocidad del viento, Bz y F10,7); la frontera sólo la han cruzado las Voyager, a 121,6 UA (2012) y 119 UA (2018).",
	},
];

export const CONNECTOR_LAYER_KEYS: readonly EnvLayerKey[] = [
	"ionosphere",
	"iss",
	"liveCameras",
	"magnetosphere",
	"satellites",
	"vanAllen",
	"heliosphere",
];

export const GLOBE_LAYERS: globeLayerDef[] = [
	// === Atmospheric & Weather ===
	{ 
		key: "atmosphere", 
		label: "Atmosphere", 
		group: "Atmospheric & Weather", 
		color: "#22d3ee", 
		Icon: Wind, 
		requiredTier: "signal",
		description: "Earth's atmospheric halo glow"
	},
	{ 
		key: "clouds", 
		label: "Clouds", 
		group: "Atmospheric & Weather", 
		color: "#7dd3fc", 
		Icon: Cloud, 
		owm: "clouds_new", 
		requiredTier: "signal",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Live cloud coverage from OpenWeatherMap"
	},
	{ 
		key: "temperature", 
		label: "Temperature", 
		group: "Atmospheric & Weather", 
		color: "#fb923c", 
		Icon: Thermometer, 
		owm: "temp_new", 
		requiredTier: "signal",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Global surface temperature map"
	},
	{ 
		key: "precipitation", 
		label: "Precipitation", 
		group: "Atmospheric & Weather", 
		color: "#60a5fa", 
		Icon: Droplets, 
		owm: "precipitation_new", 
		requiredTier: "signal",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Rain, snow, and precipitation intensity"
	},
	{
		key: "humidity",
		label: "Humidity %",
		group: "Atmospheric & Weather",
		color: "#22d3ee",
		Icon: Droplets,
		requiredTier: "signal",
		source: "Open-Meteo",
		freshness: "15 min",
		description: "Global relative humidity telemetry"
	},
	{ 
		key: "isobars", 
		label: "Isobars / Pressure", 
		group: "Atmospheric & Weather", 
		color: "#a5b4fc", 
		Icon: Gauge, 
		owm: "pressure_new", 
		requiredTier: "synapse",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Barometric pressure lines and gradients"
	},	{
		key: "wind",
		label: "Wind Speed & Dir.",
		group: "Atmospheric & Weather",
		color: "#6ee7b7",
		Icon: Compass,
		owm: "wind_new",
		requiredTier: "synapse",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Global wind patterns and direction"
	},
	{
		key: "satelliteImagery",
		label: "Satellite (True Color)",
		group: "Atmospheric & Weather",
		color: "#e2e8f0",
		Icon: Camera,
		requiredTier: "signal",
		source: "NASA GIBS · MODIS Terra",
		freshness: "1 día",
		description: "Composición real color del pase MODIS de hoy",
		gibs: { layer: "MODIS_Terra_CorrectedReflectance_TrueColor", level: 9, alpha: 1, dateOffsetHours: 36 },
	},
	{
		key: "airQuality",
		label: "Air Quality (AOD)",
		group: "Atmospheric & Weather",
		color: "#a3e635",
		Icon: CloudFog,
		requiredTier: "signal",
		source: "NASA GIBS · MODIS AOD 3km",
		freshness: "1 día",
		description: "Espesor óptico de aerosoles — contaminación y smog global",
		gibs: { layer: "MODIS_Terra_Aerosol_Optical_Depth_3km", level: 6, alpha: 0.7 },
	},
	{
		key: "dust",
		label: "Dust / Polvo",
		group: "Atmospheric & Weather",
		color: "#d6d3d1",
		Icon: Tornado,
		requiredTier: "signal",
		source: "NASA GIBS · AIRS",
		freshness: "1 día",
		description: "Puntajes de polvo en suspensión (Sahara, tormentas de arena)",
		gibs: { layer: "AIRS_L2_Dust_Score_Day", level: 6, alpha: 0.7 },
	},
	{
		key: "seaTemperature",
		label: "Sea Temperature (SST)",
		group: "Atmospheric & Weather",
		color: "#38bdf8",
		Icon: Waves,
		requiredTier: "signal",
		source: "NASA GIBS · GHRSST MUR25",
		freshness: "1-2 días",
		description: "Temperatura superficial del océano (1/25°)",
		gibs: { layer: "GHRSST_L4_MUR25_Sea_Surface_Temperature", level: 6, alpha: 0.8, dateOffsetHours: 60 },
	},
	{
		key: "uvIndex",
		label: "UV Index",
		group: "Atmospheric & Weather",
		color: "#e879f9",
		Icon: SunMedium,
		requiredTier: "signal",
		source: "NASA GIBS · CERES (climatología)",
		freshness: "Clima",
		description: "Índice ultravioleta medio — patrón global estacional",
		gibs: { layer: "CERES_Combined_Surface_UV_Index_All_Sky_Monthly", level: 6, alpha: 0.75, timeless: true },
	},
	{
		key: "dayNight",
		label: "Day / Night",
		group: "Atmospheric & Weather",
		color: "#facc15",
		Icon: Contrast,
		requiredTier: "signal",
		source: "Cesium (sol)",
		freshness: "En vivo",
		description: "Terminador día/noche — sombras reales según el sol"
	},
	{
		key: "precipitationRate",
		label: "Precipitation (GPM)",
		group: "Atmospheric & Weather",
		color: "#38bdf8",
		Icon: CloudDrizzle,
		requiredTier: "signal",
		source: "NASA GIBS · GPM IMERG",
		freshness: "~1 día (última pasada)",
		description: "Tasa de lluvia medida por satélite, no por radar",
		gibs: { layer: "IMERG_Precipitation_Rate", level: 6, alpha: 0.75, timeless: true },
	},
	{
		key: "waterVapor",
		label: "Vapor de agua",
		group: "Atmospheric & Weather",
		color: "#67e8f9",
		Icon: Cloudy,
		requiredTier: "signal",
		source: "NASA GIBS · AMSR2 (JAXA)",
		freshness: "Mensual (última disponible)",
		description: "Columna de vapor de agua precipitable sobre el océano",
		gibs: { layer: "AMSRU2_Columnar_Water_Vapor_Day", level: 6, alpha: 0.7, timeless: true },
	},
	{
		key: "ozone",
		label: "Ozono",
		group: "Atmospheric & Weather",
		color: "#a78bfa",
		Icon: Atom,
		requiredTier: "signal",
		source: "NASA GIBS · OMPS",
		freshness: "1 día",
		description: "Columna total de ozono — agujero antártico y distribución global",
		gibs: { layer: "OMPS_Ozone_Total_Column", level: 6, alpha: 0.7, timeless: true },
	},
	{
		key: "cloudTopHeight",
		label: "Troposfera · techo de nubes",
		group: "Atmospheric & Weather",
		color: "#93c5fd",
		Icon: Cloud,
		requiredTier: "signal",
		source: "NASA GIBS · MODIS Cloud Top Height",
		freshness: "1 día",
		description: "A qué altura está el techo de cada nube: el grosor real de la troposfera, de 2 km en los polos a 16 km en el ecuador",
		gibs: { layer: "MODIS_Terra_Cloud_Top_Height_Day", level: 6, alpha: 0.8, timeless: true },
	},
	{
		key: "stratosphere",
		label: "Estratosfera · temperatura",
		group: "Atmospheric & Weather",
		color: "#818cf8",
		Icon: Gauge,
		requiredTier: "signal",
		source: "NASA GIBS · Aura MLS (46 hPa)",
		freshness: "1 día",
		description: "Temperatura a 46 hPa (~22 km): calentamiento súbito estratosférico y el agujero de ozono visto por dentro",
		gibs: { layer: "MLS_Temperature_46hPa_Day", level: 6, alpha: 0.75, timeless: true },
	},
	{
		key: "landSurfaceTemp",
		label: "Temp. superficie terrestre",
		group: "Atmospheric & Weather",
		color: "#fb7185",
		Icon: ThermometerSun,
		requiredTier: "signal",
		source: "NASA GIBS · MODIS LST",
		freshness: "1 día",
		description: "Temperatura del suelo y de la cubierta vegetal, de día",
		gibs: { layer: "MODIS_Terra_Land_Surface_Temp_Day", level: 7, alpha: 0.75, timeless: true },
	},

	// === Biosphere & Climate ================================================
	{
		key: "vegetation",
		label: "Vegetación (NDVI)",
		group: "Biosphere & Climate",
		color: "#4ade80",
		Icon: Leaf,
		requiredTier: "signal",
		source: "NASA GIBS · MODIS NDVI",
		freshness: "Compuesto de 16 días",
		description: "Vigor de la vegetación: selva, cultivos, sequía y reverdecimiento",
		gibs: { layer: "MODIS_Terra_L3_NDVI_16Day", level: 9, alpha: 0.85, timeless: true },
	},
	{
		key: "oceanChlorophyll",
		label: "Clorofila marina",
		group: "Biosphere & Climate",
		color: "#34d399",
		Icon: Fish,
		requiredTier: "signal",
		source: "NASA GIBS · VIIRS",
		freshness: "1 día",
		description: "Fitoplancton: la base de la cadena trófica y el bombeo de carbono",
		gibs: { layer: "VIIRS_SNPP_L2_Chlorophyll_A", level: 7, alpha: 0.8, timeless: true },
	},
	{
		key: "soilMoisture",
		label: "Humedad del suelo",
		group: "Biosphere & Climate",
		color: "#a3e635",
		Icon: Sprout,
		requiredTier: "signal",
		source: "NASA GIBS · SMAP L4",
		freshness: "1-3 días",
		description: "Agua en la zona radicular — sequía agrícola antes de que se vea",
		gibs: { layer: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", level: 6, alpha: 0.75, timeless: true },
	},
	{
		key: "carbonDioxide",
		label: "CO₂ (OCO-2)",
		group: "Biosphere & Climate",
		color: "#f97316",
		Icon: Factory,
		requiredTier: "signal",
		source: "NASA GIBS · OCO-2",
		freshness: "Media mensual",
		description: "Columna media de CO₂ — emisiones y sumideros, mes a mes",
		gibs: { layer: "OCO-2_Carbon_Dioxide_Total_Column_Average", level: 8, alpha: 0.8, timeless: true },
	},
	{
		key: "seaIce",
		label: "Hielo marino",
		group: "Biosphere & Climate",
		color: "#e0f2fe",
		Icon: Snowflake,
		requiredTier: "signal",
		source: "NASA GIBS · AMSR2 (JAXA)",
		freshness: "Última disponible (estacional)",
		description: "Concentración de hielo en el Ártico y la Antártida",
		gibs: { layer: "AMSRU2_Sea_Ice_Concentration_12km", level: 6, alpha: 0.85, timeless: true },
	},
	{
		key: "iceSurfaceTemp",
		label: "Temperatura del hielo",
		group: "Biosphere & Climate",
		color: "#a5f3fc",
		Icon: Thermometer,
		requiredTier: "signal",
		source: "NASA GIBS · MODIS Ice Surface Temp",
		freshness: "1 día",
		description: "Criósfera: a qué temperatura está el hielo y la nieve, el termómetro del deshielo",
		gibs: { layer: "MODIS_Terra_Ice_Surface_Temp_Day", level: 7, alpha: 0.8, timeless: true },
	},
	{
		key: "seaSalinity",
		label: "Salinidad del mar",
		group: "Biosphere & Climate",
		color: "#2dd4bf",
		Icon: Waves,
		requiredTier: "signal",
		source: "NASA GIBS · SMAP (8 días)",
		freshness: "8 días",
		description: "Hidrosfera: salinidad superficial, que marca corrientes, lluvia y deshielo",
		gibs: { layer: "SMAP_L3_Sea_Surface_Salinity_CAP_8Day_RunningMean", level: 6, alpha: 0.75, timeless: true },
	},

	// === Space & Cosmos ===
	{
		key: "iss",
		label: "ISS en vivo",
		group: "Space & Cosmos",
		color: "#f87171",
		Icon: Orbit,
		requiredTier: "signal",
		source: "WhereTheISS.at (TLE oficial)",
		freshness: "10 s",
		description: "Posición real de la Estación Espacial: latitud, longitud y altitud",
	},
	{
		key: "ionosphere",
		label: "Termosfera · Ionosfera (TEC)",
		group: "Space & Cosmos",
		color: "#22d3ee",
		Icon: RadioTower,
		// La ionosfera se mide con un TEC público de NOAA: no cuesta nada servirla
		// y es parte de la misma pregunta que la estratosfera y la exosfera, así
		// que basta con tener cuenta. Antes pedía Synapse y quedaba en gris sin
		// explicación aparente al lado de sus vecinas.
		requiredTier: "node",
		source: "NOAA SWPC · GLOTEC",
		freshness: "10 min",
		description: "Contenido electrónico total de la termosfera: retraso de señal GNSS y corte de radio HF",
	},
	{
		key: "magnetosphere",
		label: "Magnetosfera (óvalo)",
		group: "Space & Cosmos",
		color: "#c084fc",
		Icon: Magnet,
		// Mismo criterio que la ionosfera: el óvalo auroral sale de OVATION, que
		// es abierto, y su sitio es la lista de envolturas de la Tierra.
		requiredTier: "node",
		source: "NOAA SWPC · OVATION",
		freshness: "30 min",
		description: "Huella ionosférica de la magnetosfera: el óvalo auroral, sin depender del Kp",
	},
	{
		key: "vanAllen",
		label: "Cinturones de Van Allen",
		group: "Space & Cosmos",
		color: "#f0abfc",
		Icon: Radiation,
		// Los cinturones cierran la lista de esferas; dejarlos tras Synapse partía
		// la secuencia en dos y hacía que la mitad pareciera no existir.
		requiredTier: "node",
		source: "NOAA GOES · electrones >2 MeV",
		freshness: "5 min",
		description: "Los dos toroides de partículas atrapadas (1,2-8 R⊕) en el plano del ecuador magnético, con la intensidad que mide GOES",
	},
	{
		key: "heliosphere",
		label: "Heliosfera · viento solar",
		group: "Space & Cosmos",
		color: "#fdba74",
		Icon: Sun,
		requiredTier: "signal",
		source: "NOAA SWPC · viento solar en L1",
		freshness: "1-5 min",
		description: "Velocidad del viento solar, Bz y F10,7 medidos en L1: lo que infla la burbuja que envuelve el Sistema Solar",
	},
	{
		key: "solarActivity",
		label: "Solar Activity",
		group: "Space & Cosmos",
		color: "#c084fc",
		Icon: Sun,
		requiredTier: "synapse",
		source: "NOAA SWPC",
		freshness: "30 min",
		description: "Kp index and aurora borealis intensity",
		gibs: { layer: "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance", level: 8, alpha: 0.35 },
	},
	{
		key: "nightLights",
		label: "Night Lights",
		group: "Space & Cosmos",
		color: "#fde68a",
		Icon: MoonStar,
		requiredTier: "signal",
		source: "NASA GIBS · VIIRS Black Marble",
		freshness: "Mosaico 2016",
		description: "Luces nocturnas vistas desde el espacio",
		gibs: { layer: "VIIRS_Black_Marble", level: 8, alpha: 0.9, date: "2016-01-01" },
	},

	// === OSINT & Hazards ===
	{
		key: "liveCameras",
		label: "Cámaras del Alien",
		group: "OSINT & Hazards",
		color: "#f472b6",
		Icon: Video,
		requiredTier: "signal",
		source: "Monitor UAP (cámaras curadas)",
		freshness: "En vivo",
		description: "Las cámaras de la pestaña Alien en su sitio real; al pulsar se abre su directo",
	},
	{
		key: "wildfires",
		label: "Wildfires (FIRMS)",
		group: "OSINT & Hazards",
		color: "#fb923c",
		Icon: Flame,
		requiredTier: "signal",
		source: "NASA FIRMS",
		freshness: "3 hours",
		description: "Detecciones activas de fuego (puntos FIRMS NRT)"
	},
	{ 
		key: "earthquakes", 
		label: "Earthquakes (USGS)", 
		group: "OSINT & Hazards", 
		color: "#fbbf24", 
		Icon: Activity, 
		requiredTier: "signal",
		source: "USGS",
		freshness: "5 min",
		description: "Real-time earthquake data from USGS"
	},
	{ 
		key: "airTraffic", 
		label: "Air Traffic", 
		group: "OSINT & Hazards", 
		color: "#e2e8f0", 
		Icon: Plane, 
		requiredTier: "signal",
		source: "OpenSky Network",
		freshness: "2 min",
		description: "Live flight tracking via OpenSky"
	},
	{ 
		key: "marineTraffic", 
		label: "Marine Traffic", 
		group: "OSINT & Hazards", 
		color: "#38bdf8", 
		Icon: Ship, 
		requiredTier: "synapse",
		source: "VesselFinder / AIS",
		freshness: "3 min",
		description: "Ship tracking via VesselFinder AIS"
	},

	// === Markets & Feeds ===
	{ 
		key: "marketData", 
		label: "Live Market Data", 
		group: "Markets & Feeds", 
		color: "#fbbf24", 
		Icon: TrendingUp, 
		requiredTier: "signal",
		source: "CoinGecko",
		freshness: "1 min",
		description: "Cryptocurrency and market data"
	},

	// === Strategic Infrastructure (WorldMonitor Integration) ===
	{ 
		key: "conflictZones", 
		label: "Conflict Zones", 
		group: "Geopolitical", 
		color: "#dc2626", 
		Icon: Crosshair, 
		requiredTier: "synapse",
		source: "UCDP / WorldMonitor",
		freshness: "Daily",
		description: "Active armed conflict zones and events"
	},
	{ 
		key: "nuclearSites", 
		label: "Nuclear Sites", 
		group: "Strategic Infrastructure", 
		color: "#7c3aed", 
		Icon: AlertTriangle, 
		requiredTier: "oracle",
		source: "WorldMonitor Registry",
		freshness: "Static",
		description: "Nuclear facilities and power plants"
	},
	{ 
		key: "militaryBases", 
		label: "Military Bases", 
		group: "Strategic Infrastructure", 
		color: "#4b5563", 
		Icon: Shield, 
		requiredTier: "oracle",
		source: "WorldMonitor Registry",
		freshness: "Static",
		description: "Major military installations worldwide"
	},
	{ 
		key: "underseaCables", 
		label: "Undersea Cables", 
		group: "Strategic Infrastructure", 
		color: "#0891b2", 
		Icon: Waves, 
		requiredTier: "synapse",
		source: "WorldMonitor Registry",
		freshness: "Static",
		description: "Submarine communications cables"
	},
	{ 
		key: "pipelines", 
		label: "Pipelines", 
		group: "Strategic Infrastructure", 
		color: "#ca8a04", 
		Icon: Landmark, 
		requiredTier: "synapse",
		source: "WorldMonitor Registry",
		freshness: "Static",
		description: "Major oil and gas pipelines"
	},
	{ 
		key: "chokepoints", 
		label: "Strategic Chokepoints", 
		group: "Strategic Infrastructure", 
		color: "#ea580c", 
		Icon: Zap, 
		requiredTier: "synapse",
		source: "WorldMonitor Registry",
		freshness: "Static",
		description: "Critical maritime straits and canals"
	},
	{ 
		key: "satellites", 
		label: "Orbital Surveillance", 
		group: "Space & Cosmos", 
		color: "#8b5cf6", 
		Icon: Satellite, 
		requiredTier: "oracle",
		source: "Space-Track.org",
		freshness: "1 hour",
		description: "Active satellite positions"
	},
	{ 
		key: "internetOutages", 
		label: "Internet Outages", 
		group: "OSINT & Hazards", 
		color: "#dc2626", 
		Icon: Radio, 
		requiredTier: "synapse",
		source: "WorldMonitor / Oracle",
		freshness: "15 min",
		description: "Real-time internet disruption events"
	},
	{ 
		key: "economicCenters", 
		label: "Economic Centers", 
		group: "Markets & Feeds", 
		color: "#10b981", 
		Icon: TrendingUp, 
		requiredTier: "signal",
		source: "WorldMonitor Registry",
		freshness: "Static",
		description: "Major financial and economic hubs"
	},
];

export const LAYER_GROUPS: LayerGroup[] = [
	"Atmospheric & Weather",
	"Biosphere & Climate",
	"Space & Cosmos",
	"OSINT & Hazards",
	"Markets & Feeds",
	"Strategic Infrastructure",
	"Geopolitical",
];

export const DEFAULT_ACTIVE_LAYERS: EnvLayerKey[] = [
	"atmosphere",
	"clouds",
	"temperature",
	"humidity",
	"precipitation",
	"wildfires",
	"earthquakes",
	"airTraffic",
	"marketData",
	"dayNight",
	"iss",
	"liveCameras",
	// Las dos esferas que el panel destaca: vienen encendidas para que se vea de
	// entrada qué mide el globo más allá de la superficie.
	"vanAllen",
	"heliosphere",
];

export function layerDef(key: EnvLayerKey): globeLayerDef | undefined {
	return GLOBE_LAYERS.find((l) => l.key === key);
}
