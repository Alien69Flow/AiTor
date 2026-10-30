import {
  Layers,
  Activity,
  Satellite,
  Radio,
  CloudRain,
  DollarSign,
  Eye,
  Crosshair,
  Landmark,
  Package,
  PawPrint,
  Sparkles,
  Lock,
  Plane,
  Ship,
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
import {
  EARTH_SHELLS,
  GLOBE_LAYERS,
  LAYER_GROUPS,
  TIER_LABEL,
  layerDef,
  type EnvLayerKey,
  type Tier,
} from "@/lib/globe-layers";
import type { LayerStatusMap } from "@/hooks/useUnifiedIntel";
import { aircraftMarkerIcon } from "@/lib/aircraft-marker";
import {
  ALTITUDE_BANDS,
  ROLE_LABELS,
  UNKNOWN_BAND,
  type AircraftRole,
} from "@/lib/aircraft-class";

/** Orden en que se enseñan los tipos: de más a menos frecuentes en el cielo. */
const ROLE_ORDER: AircraftRole[] = [
  "pasajeros",
  "carga",
  "militar",
  "gobierno",
  "privado",
  "otro",
];

/**
 * Capa → conector que la alimenta. Vive aquí, en un solo sitio, porque lo leen
 * dos listas distintas: el catálogo por grupos y el de esferas de la Tierra. Si
 * estuviera duplicado, una capa podría enseñar estado en una lista y no en la
 * otra.
 */
const LAYER_STATUS_KEY: Partial<Record<EnvLayerKey, keyof LayerStatusMap>> = {
  precipitation: "rainRadar",
  wind: "surfaceWeather",
  isobars: "surfaceWeather",
  temperature: "surfaceWeather",
  humidity: "surfaceWeather",
  earthquakes: "quakesEmsc",
  wildfires: "fires",
  solarActivity: "aurora",
  magnetosphere: "aurora",
  satellites: "satellites",
  iss: "iss",
  ionosphere: "ionosphere",
  vanAllen: "vanAllen",
  heliosphere: "heliosphere",
  underseaCables: "cables",
  economicCenters: "bitcoinNodes",
  airTraffic: "aviation",
  dryingIndex: "drying",
  pollen: "pollen",
  seaState: "sea",
  snowDepth: "snow",
  conflictZones: "gdelt",
  internetOutages: "gdelt",
};

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
  { key: "owm", label: "OpenWeather Tiles", color: "#22d3ee", Icon: CloudRain, status: "live" },
  { key: "opensky", label: "OpenSky Air Traffic", color: "#00FFFF", Icon: Plane, status: "live" },
  { key: "vesselfinder", label: "VesselFinder Marine", color: "#38BDF8", Icon: Ship, status: "live" },
] as const;

interface LegendPanelProps {
  visibleLayers: Set<LayerKey>;
  onToggleLayer: (key: LayerKey) => void;
  counts?: Record<LayerKey, number>;
  envLayers: Set<EnvLayerKey>;
  onToggleEnvLayer: (key: EnvLayerKey) => void;
  tier: Tier;
  hasAccess: (required: Tier) => boolean;
  onClose?: () => void;
  defaultCollapsed?: boolean;
  layerStatus?: LayerStatusMap;
}

export function LegendPanel({
  visibleLayers,
  onToggleLayer,
  counts,
  envLayers,
  onToggleEnvLayer,
  tier,
  hasAccess,
  onClose,
  defaultCollapsed = true,
  layerStatus,
}: LegendPanelProps) {
  return (
    <GlassPanel
      icon={Layers}
      title="Legend & Controls"
      collapsible
      defaultCollapsed={defaultCollapsed}
      className="w-full max-w-[284px] rounded-sm"
      glowBorder
      glowColor="#22d3ee"
      headerRight={
        <div className="flex items-center gap-2">
          <span className="text-[8px] uppercase tracking-wider text-amber-400/80">
            {TIER_LABEL[tier]}
          </span>
          <LedIndicator color="#34d399" active size="sm" />
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-4 max-h-[58vh] overflow-y-auto legend-scroll pr-2 font-mono">
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

        {/* Explicit layer enumeration, grouped */}
        {LAYER_GROUPS.map((group) => {
          const defs = GLOBE_LAYERS.filter((l) => l.group === group);
          if (!defs.length) return null;
          return (
            <div key={group}>
              <SectionTitle>{group}</SectionTitle>
              <div className="grid grid-cols-1 gap-2">
                {defs.map((def) => {
                  const locked = !hasAccess(def.requiredTier);
                  const statusKey = LAYER_STATUS_KEY[def.key];
                  const status = statusKey ? layerStatus?.[statusKey] : undefined;
                  return (
                    <div key={def.key} className="relative">
                      <ToggleRow
                        icon={def.Icon}
                        label={def.label}
                        color={locked ? "#64748b" : def.color}
                        active={!locked && envLayers.has(def.key)}
                        onChange={() => onToggleEnvLayer(def.key)}
                      />
                      {locked && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 pointer-events-none">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          <span className="text-[7px] uppercase tracking-wider text-amber-400 font-bold">
                            {TIER_LABEL[def.requiredTier]}
                          </span>
                        </span>
                      )}
                      {!locked && status && envLayers.has(def.key) && (
                        <span className={`absolute right-11 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${status.error ? "bg-destructive" : status.loading ? "bg-accent animate-pulse" : "bg-primary"}`} title={status.error ?? `${status.count} señales`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/*
          Tráfico aéreo: la capa ya no pinta todos los contactos igual. El color
          dice la altitud y la forma el tipo de vuelo, así que los dos canales
          se explican aquí, con el marcador real y no con un cuadrado de color.
        */}
        <div>
          <SectionTitle>Tráfico aéreo</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {[...ALTITUDE_BANDS, UNKNOWN_BAND].map((band) => (
              <span
                key={band.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-700/25 bg-slate-800/25"
                title={`Color de los contactos entre ${band.label}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: band.color }}
                />
                <span className="text-[9px] text-white/80 truncate">{band.label}</span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1.5">
            {ROLE_ORDER.map((role) => (
              <span key={role} className="flex items-center gap-1.5 min-w-0">
                <img
                  src={aircraftMarkerIcon(null, "#E2E8F0", role)}
                  alt=""
                  aria-hidden
                  className="w-4 h-4 shrink-0"
                />
                <span className="text-[9px] text-white/80 truncate">{ROLE_LABELS[role]}</span>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[8px] leading-relaxed text-slate-500">
            El color es la altitud; la forma, el tipo de vuelo. El tipo se infiere del código ICAO
            de la aeronave y de su indicativo, no de una identidad declarada: lo que no se puede
            asegurar aparece como «sin clasificar».
          </p>
        </div>

        {/*
          Esferas y envolturas de la Tierra — de la troposfera a la heliosfera,
          en orden. Cada fila dice qué abarca y qué la mide; tocar una enciende
          su capa. Las que se quedan sin capa no se esconden: aparecen en gris y
          con su motivo, para que el hueco sea visible en vez de parecer olvido.
        */}
        <div>
          <SectionTitle>Esferas y envolturas</SectionTitle>
          <div className="space-y-1.5">
            {EARTH_SHELLS.map((shell) => {
              const def = shell.layer ? layerDef(shell.layer) : undefined;
              const status = def ? (LAYER_STATUS_KEY[def.key] ? layerStatus?.[LAYER_STATUS_KEY[def.key]!] : undefined) : undefined;
              const locked = def ? !hasAccess(def.requiredTier) : true;
              const on = def ? !locked && envLayers.has(def.key) : false;
              const title = [shell.source ? `Fuente: ${shell.source}` : "Sin fuente abierta que la mida", shell.note]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={shell.id}
                  type="button"
                  disabled={!def || locked}
                  onClick={() => def && onToggleEnvLayer(def.key)}
                  title={title}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700/25 bg-slate-800/20 text-left transition-colors hover:border-primary/40 disabled:cursor-default disabled:opacity-55"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: on ? (status?.error ? "#ef4444" : def?.color ?? "#64748b") : "#334155" }}
                    />
                    <span className="text-[10px] truncate text-white/85">{shell.label}</span>
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-500 shrink-0">
                    {shell.range}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[8px] leading-relaxed text-slate-500">
            {EARTH_SHELLS.filter((shell) => shell.layer).length} de {EARTH_SHELLS.length} tienen medida propia;
            el resto se declara vacío a propósito.
          </p>
        </div>

        {/* Live Data Sources */}
        <div>
          <SectionTitle>Live Data Feeds</SectionTitle>
          <div className="space-y-2">
            {DATA_SOURCES.map((src) => (
              <div
                key={src.key}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-800/25 border border-slate-700/20 rounded-xl"
              >
                <div className="flex items-center gap-2.5">
                  <src.Icon className="w-4 h-4 shrink-0" style={{ color: src.color }} />
                  <span className="text-[11px] truncate text-white/85">{src.label}</span>
                </div>
                <StatusBadge variant="success" glow>LIVE</StatusBadge>
              </div>
            ))}
          </div>
        </div>

        {/* Active layers summary */}
        <div className="pt-2 border-t border-slate-700/25">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-slate-500 uppercase tracking-wider">Active Data Layers</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {envLayers.size + visibleLayers.size}
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
