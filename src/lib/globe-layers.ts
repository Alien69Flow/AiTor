import {
	Wind, Cloud, Gauge, Compass, Thermometer, Droplets,
	Sun, Flame, Activity, Plane, Ship, TrendingUp,
	Satellite, AlertTriangle, Shield, Landmark, Radio,
	Bitcoin, Zap, Crosshair, Waves, type LucideIcon,
} from "lucide-react";

export type EnvLayerKey =
	| "atmosphere"
	| "clouds"
	| "isobars"
	| "wind"
	| "temperature"
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
	| "economicCenters";

export type Tier = "explorer" | "architect" | "alien";

export const TIER_RANK: Record<Tier, number> = { explorer: 0, architect: 1, alien: 2 };
export const TIER_LABEL: Record<Tier, string> = {
	explorer: "Explorer",
	architect: "Architect",
	alien: "Alien",
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
		requiredTier: "explorer",
		description: "Earth's atmospheric halo glow"
	},
	{ 
		key: "clouds", 
		label: "Clouds", 
		group: "Atmospheric & Weather", 
		color: "#7dd3fc", 
		Icon: Cloud, 
		owm: "clouds_new", 
		requiredTier: "explorer",
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
		requiredTier: "explorer",
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
		requiredTier: "explorer",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Rain, snow, and precipitation intensity"
	},
	{ 
		key: "isobars", 
		label: "Isobars / Pressure", 
		group: "Atmospheric & Weather", 
		color: "#a5b4fc", 
		Icon: Gauge, 
		owm: "pressure_new", 
		requiredTier: "architect",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Barometric pressure lines and gradients"
	},
	{ 
		key: "wind", 
		label: "Wind Speed & Dir.", 
		group: "Atmospheric & Weather", 
		color: "#6ee7b7", 
		Icon: Compass, 
		owm: "wind_new", 
		requiredTier: "architect",
		source: "OpenWeatherMap",
		freshness: "15 min",
		description: "Global wind patterns and direction"
	},

	// === Space & Cosmos ===
	{ 
		key: "solarActivity", 
		label: "Solar Activity", 
		group: "Space & Cosmos", 
		color: "#c084fc", 
		Icon: Sun, 
		requiredTier: "architect",
		source: "NOAA SWPC",
		freshness: "30 min",
		description: "Kp index and aurora borealis intensity"
	},

	// === OSINT & Hazards ===
	{ 
		key: "wildfires", 
		label: "Wildfires (FIRMS)", 
		group: "OSINT & Hazards", 
		color: "#fb923c", 
		Icon: Flame, 
		requiredTier: "explorer",
		source: "NASA FIRMS",
		freshness: "3 hours",
		description: "Active wildfire detection from NASA"
	},
	{ 
		key: "earthquakes", 
		label: "Earthquakes (USGS)", 
		group: "OSINT & Hazards", 
		color: "#fbbf24", 
		Icon: Activity, 
		requiredTier: "explorer",
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
		requiredTier: "explorer",
		source: "ADS-B.lol",
		freshness: "15 sec",
		description: "Live aircraft telemetry from ADS-B.lol"
	},
	{ 
		key: "marineTraffic", 
		label: "Marine Traffic", 
		group: "OSINT & Hazards", 
		color: "#38bdf8", 
		Icon: Ship, 
		requiredTier: "architect",
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
		requiredTier: "explorer",
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
		requiredTier: "architect",
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
		requiredTier: "alien",
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
		requiredTier: "alien",
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
		requiredTier: "architect",
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
		requiredTier: "architect",
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
		requiredTier: "architect",
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
		requiredTier: "alien",
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
		requiredTier: "architect",
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
		requiredTier: "explorer",
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
	"wildfires",
	"earthquakes",
	"airTraffic",
	"marketData",
];

export function layerDef(key: EnvLayerKey): globeLayerDef | undefined {
	return GLOBE_LAYERS.find((l) => l.key === key);
}
