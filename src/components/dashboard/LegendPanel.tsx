import { useEffect, useState } from "react";
import {
  Layers,
  Activity,
  Satellite,
  Map as MapIcon,
  Radio,
  CloudRain,
  Wind,
  Cloud,
  Droplets,
  Gauge,
  Flame,
  Plane,
  Thermometer,
  TrendingUp,
  DollarSign,
  Eye,
  Crosshair,
  Landmark,
  Package,
  PawPrint,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  GlassPanel,
  CategoryChip,
  ToggleRow,
  LedIndicator,
  StatusBadge,
  SectionTitle,
} from "./GlassPanels";

export type LayerKey =
  | "finance"
  | "intel"
  | "conflict"
  | "geopolitical"
  | "logistics"
  | "cryptozoo"
  | "convergence";

export interface LegendCategory {
  key: LayerKey;
  label: string;
  color: string;
  icon: LucideIcon;
}

export const LEGEND_CATEGORIES: LegendCategory[] = [
  { key: "finance", label: "Finance & Tech", color: "#fbbf24", icon: DollarSign },
  { key: "intel", label: "Intel & UAP", color: "#34d399", icon: Eye },
  { key: "conflict", label: "Conflict Zones", color: "#f87171", icon: Crosshair },
  { key: "geopolitical", label: "Geopolitical", color: "#60a5fa", icon: Landmark },
  { key: "logistics", label: "Logistics", color: "#fb923c", icon: Package },
  { key: "cryptozoo", label: "Cryptozoology", color: "#c084fc", icon: PawPrint },
  { key: "convergence", label: "Convergence", color: "#e2e8f0", icon: Sparkles },
];

const DATA_SOURCES = [
  { key: "usgs", label: "USGS Earthquakes", color: "#fbbf24", Icon: Activity, status: "live" },
  { key: "nasa", label: "NASA EONET", color: "#34d399", Icon: Satellite, status: "live" },
  { key: "noaa", label: "NOAA Space Weather", color: "#c084fc", Icon: Radio, status: "live" },
  { key: "owm", label: "OpenWeather", color: "#22d3ee", Icon: CloudRain, status: "standby" },
  { key: "osky", label: "OpenSky Flights", color: "#e2e8f0", Icon: Plane, status: "live" },
  { key: "tle", label: "Celestrak Satellites", color: "#60a5fa", Icon: Satellite, status: "soon" },
  { key: "ocn", label: "NOAA Ocean (ERDDAP)", color: "#06b6d4", Icon: Activity, status: "soon" },
  { key: "ais", label: "AIS Maritime", color: "#fb923c", Icon: Package, status: "soon" },
  { key: "cam", label: "Earthcam Live", color: "#f472b6", Icon: Eye, status: "soon" },
] as const;

interface LegendPanelProps {
  visibleLayers: Set<LayerKey>;
  onToggleLayer: (key: LayerKey) => void;
  counts?: Record<LayerKey, number>;
  cloudsEnabled?: boolean;
  onToggleClouds?: () => void;
  weatherEnabled?: boolean;
  onToggleWeather?: () => void;
  firesEnabled?: boolean;
  onToggleFires?: () => void;
  aircraftEnabled?: boolean;
  onToggleAircraft?: () => void;
  marketsEnabled?: boolean;
  onToggleMarkets?: () => void;
}

export function LegendPanel({
  visibleLayers,
  onToggleLayer,
  counts,
  cloudsEnabled,
  onToggleClouds,
  weatherEnabled,
  onToggleWeather,
  firesEnabled,
  onToggleFires,
  aircraftEnabled,
  onToggleAircraft,
  marketsEnabled,
  onToggleMarkets,
}: LegendPanelProps) {
  const overlayToggles: Array<{
    key: string;
    label: string;
    color: string;
    Icon: LucideIcon;
    enabled: boolean;
    onToggle?: () => void;
  }> = [
    {
      key: "atm",
      label: "Atmosphere",
      color: "#22d3ee",
      Icon: Wind,
      enabled: !!weatherEnabled,
      onToggle: onToggleWeather,
    },
    {
      key: "clds",
      label: "Cloud Layer",
      color: "#7dd3fc",
      Icon: Cloud,
      enabled: !!cloudsEnabled,
      onToggle: onToggleClouds,
    },
    {
      key: "fire",
      label: "Wildfire Events",
      color: "#fb923c",
      Icon: Flame,
      enabled: !!firesEnabled,
      onToggle: onToggleFires,
    },
    {
      key: "air",
      label: "Air Traffic",
      color: "#e2e8f0",
      Icon: Plane,
      enabled: !!aircraftEnabled,
      onToggle: onToggleAircraft,
    },
    {
      key: "mkts",
      label: "Market Data",
      color: "#fbbf24",
      Icon: TrendingUp,
      enabled: !!marketsEnabled,
      onToggle: onToggleMarkets,
    },
  ];

  // Globe raster overlays (RainViewer + OpenWeather clouds / precip / wind / pressure).
  // Globe exposes a toggle on window.__owmToggle and current state on
  // window.__owmState — bridged here so the panel stays decoupled.
  const [owm, setOwm] = useState<{ radar: boolean; clouds: boolean; precipitation: boolean; wind: boolean; pressure: boolean; temperature: boolean }>({
    radar: false, clouds: false, precipitation: false, wind: false, pressure: false, temperature: false,
  });
  const [baseMap, setBaseMap] = useState<"satellite" | "dark">("satellite");
  useEffect(() => {
    const id = setInterval(() => {
      const s = (window as any).__owmState;
      if (s) setOwm({ radar: !!s.radar, clouds: !!s.clouds, precipitation: !!s.precipitation, wind: !!s.wind, pressure: !!s.pressure, temperature: !!s.temperature });
      if ((window as any).__globeBaseState) setBaseMap((window as any).__globeBaseState);
    }, 400);
    return () => clearInterval(id);
  }, []);
  const toggleOwm = (k: "radar" | "clouds" | "precipitation" | "wind" | "pressure" | "temperature") => {
    (window as any).__owmToggle?.(k);
  };
  const owmToggles = [
    { key: "radar", label: "Rain Radar", color: "#22d3ee", Icon: CloudRain },
    { key: "clouds", label: "OWM Clouds", color: "#7dd3fc", Icon: Cloud },
    { key: "precipitation", label: "OWM Rain", color: "#38bdf8", Icon: Droplets },
    { key: "wind", label: "OWM Wind", color: "#a7f3d0", Icon: Wind },
    { key: "pressure", label: "OWM Pressure", color: "#fbbf24", Icon: Gauge },
    { key: "temperature", label: "OWM Temp", color: "#f87171", Icon: Thermometer },
  ] as const;
  const setGlobeBase = (style: "satellite" | "dark") => {
    setBaseMap(style);
    (window as any).__globeSetBase?.(style);
  };

  return (
    <GlassPanel
      icon={Layers}
      title="Legend & Controls"
      collapsible
      defaultCollapsed={false}
      className="w-[300px]"
      glowBorder
      glowColor="#22d3ee"
      headerRight={<LedIndicator color="#34d399" active size="sm" />}
    >
      <div className="space-y-5">
        <div>
          <SectionTitle>Base Map</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <ToggleRow
              icon={Satellite}
              label="Satellite"
              color="#fbbf24"
              active={baseMap === "satellite"}
              onChange={() => setGlobeBase("satellite")}
            />
            <ToggleRow
              icon={MapIcon}
              label="Dark Map"
              color="#22d3ee"
              active={baseMap === "dark"}
              onChange={() => setGlobeBase("dark")}
            />
          </div>
        </div>

        {/* Data Categories */}
        <div>
          <SectionTitle>Intelligence Categories</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {LEGEND_CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat.key}
                label={cat.label}
                color={cat.color}
                active={visibleLayers.has(cat.key)}
                count={counts?.[cat.key]}
                icon={cat.icon}
                onClick={() => onToggleLayer(cat.key)}
              />
            ))}
          </div>
        </div>

        {/* Live Data Sources */}
        <div>
          <SectionTitle>Live Data Feeds</SectionTitle>
          <div className="space-y-2">
            {DATA_SOURCES.map((src) => {
              const isLive = src.status === "live";
              const isSoon = src.status === "soon";
              return (
                <div
                  key={src.key}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-800/25 border border-slate-700/20 rounded-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <src.Icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: isLive ? src.color : "#475569" }}
                    />
                    <span
                      className="text-[11px] truncate"
                      style={{ color: isLive ? "rgba(255,255,255,0.85)" : "#64748b" }}
                    >
                      {src.label}
                    </span>
                  </div>
                  <StatusBadge variant={isLive ? "success" : isSoon ? "warning" : "warning"} glow={isLive}>
                    {isLive ? "LIVE" : isSoon ? "SOON" : "STANDBY"}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overlay Layers */}
        <div>
          <SectionTitle>Overlay Layers</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {overlayToggles.map((t) => (
              <ToggleRow
                key={t.key}
                icon={t.Icon}
                label={t.label}
                color={t.color}
                active={t.enabled}
                onChange={() => t.onToggle?.()}
              />
            ))}
          </div>
        </div>

        {/* OpenWeatherMap raster tiles */}
        <div>
          <SectionTitle>OpenWeather Tiles</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {owmToggles.map((t) => (
              <ToggleRow
                key={t.key}
                icon={t.Icon}
                label={t.label}
                color={t.color}
                active={owm[t.key]}
                onChange={() => toggleOwm(t.key)}
              />
            ))}
          </div>
        </div>

        {/* Active layers summary */}
        <div className="pt-2 border-t border-slate-700/25">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-slate-500 uppercase tracking-wider">
              Active Data Layers
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              {[
                weatherEnabled,
                cloudsEnabled,
                firesEnabled,
                aircraftEnabled,
                marketsEnabled,
              ].filter(Boolean).length + visibleLayers.size}
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
