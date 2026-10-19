import {
	Wind, Cloud, Gauge, Compass, Thermometer, Droplets,
	Sun, Flame, Activity, Plane, Ship, TrendingUp,
	Satellite, AlertTriangle, Shield, Landmark, Radio,
	Bitcoin, Zap, Crosshair, Waves,
	CloudFog, Tornado, SunMedium, MoonStar, Contrast, Camera,
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
	| "dayNight";

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
	owm?: string;
	/**
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
		/** No TIME segment — layer only serves its timeless template */
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

	// === Space & Cosmos ===
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
];

export function layerDef(key: EnvLayerKey): globeLayerDef | undefined {
	return GLOBE_LAYERS.find((l) => l.key === key);
}
