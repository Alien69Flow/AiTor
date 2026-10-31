import { useMemo, useState } from "react";
import {
  Layers,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
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
  Plane,
  Ship,
  SlidersHorizontal,
  Plus,
  Minus,
  type LucideIcon,
} from "lucide-react";
import {
  EARTH_SHELLS,
  GLOBE_LAYERS,
  LAYER_GROUPS,
  MAX_RASTER_LAYERS,
  TIER_LABEL,
  isRasterLayer,
  layerDef,
  type EnvLayerKey,
  type LayerGroup,
  type Tier,
} from "@/lib/globe-layers";
import type { LayerStatusMap } from "@/hooks/useUnifiedIntel";
import type { ViewScale } from "@/components/globe/GlobeScaleHud";
import { overscanLabel, tileOverscan, type TileOverscan } from "@/lib/tile-zoom";
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

interface DataSource {
  key: string;
  label: string;
  title: string;
  color: string;
  Icon: typeof Activity;
}

const DATA_SOURCES: DataSource[] = [
  { key: "usgs", label: "USGS", title: "USGS Earthquakes", color: "#fbbf24", Icon: Activity },
  { key: "nasa", label: "NASA EONET", title: "NASA EONET", color: "#34d399", Icon: Satellite },
  { key: "noaa", label: "NOAA SWPC", title: "NOAA Space Weather", color: "#c084fc", Icon: Radio },
  { key: "owm", label: "OpenWeather", title: "OpenWeather Tiles", color: "#22d3ee", Icon: CloudRain },
  { key: "opensky", label: "OpenSky", title: "OpenSky Air Traffic", color: "#00ffff", Icon: Plane },
  { key: "vesselfinder", label: "VesselFinder", title: "VesselFinder Marine", color: "#38bdf8", Icon: Ship },
];

/** Nombres cortos de grupo: la cabecera cabe sin cortar y se lee de un vistazo. */
const GROUP_LABEL: Record<LayerGroup, string> = {
  "Atmospheric & Weather": "Atmósfera y tiempo",
  "Biosphere & Climate": "Biosfera y clima",
  "Space & Cosmos": "Espacio y cosmos",
  "OSINT & Hazards": "OSINT y riesgos",
  "Markets & Feeds": "Mercados y señales",
  "Strategic Infrastructure": "Infraestructura",
  Geopolitical: "Geopolítica",
};

interface LegendPanelProps {
  visibleLayers: Set<LayerKey>;
  onToggleLayer: (key: LayerKey) => void;
  counts?: Record<LayerKey, number>;
  envLayers: Set<EnvLayerKey>;
  onToggleEnvLayer: (key: EnvLayerKey) => void;
  /**
   * Enciende o apaga varias capas de una vez, con el cupo de teselas resuelto
   * por quien las dibuja. Sin este callback el panel va una a una, que con
   * lluvia de avisos es peor experiencia pero sigue funcionando.
   */
  onBulkEnvLayers?: (keys: EnvLayerKey[], enabled: boolean) => void;
  tier: Tier;
  hasAccess: (required: Tier) => boolean;
  onClose?: () => void;
  defaultCollapsed?: boolean;
  layerStatus?: LayerStatusMap;
  /**
   * Escala actual de la cámara. Con ella se sabe si una capa de teselas se
   * está viendo ampliada por encima de su último nivel real (píxeles
   * estirados) y el panel lo avisa.
   */
  viewScale?: ViewScale | null;
}

/** Interruptor: una sola fuente de verdad visual para todas las filas. */
function Switch({ on, disabled = false }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "relative inline-flex h-[14px] w-[26px] shrink-0 items-center rounded-full border transition-colors",
        disabled
          ? "border-slate-700/50 bg-slate-800/60"
          : on
            ? "border-primary/70 bg-primary/80"
            : "border-slate-600/60 bg-slate-800",
      ].join(" ")}
    >
      <span
        className={[
          "absolute h-[10px] w-[10px] rounded-full transition-all",
          on && !disabled ? "left-[13px] bg-slate-950" : "left-[2px] bg-slate-400",
        ].join(" ")}
      />
    </span>
  );
}

function SectionHeader({
  label,
  count,
  open,
  onToggle,
  action,
}: {
  label: string;
  count?: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-primary/70" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        )}
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/85 group-hover:text-primary">
          {label}
        </span>
        {count && (
          <span className="ml-auto shrink-0 font-mono text-[8px] tabular-nums text-muted-foreground/70">
            {count}
          </span>
        )}
      </button>
      {action}
    </div>
  );
}

export function LegendPanel({
  visibleLayers,
  onToggleLayer,
  counts,
  envLayers,
  onToggleEnvLayer,
  onBulkEnvLayers,
  tier,
  hasAccess,
  onClose,
  defaultCollapsed = true,
  layerStatus,
  viewScale,
}: LegendPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<LayerGroup>>(
    () => new Set<LayerGroup>(["Atmospheric & Weather", "Space & Cosmos"]),
  );
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => new Set<string>());

  const rasterActive = GLOBE_LAYERS.filter(
    (def) => envLayers.has(def.key) && isRasterLayer(def),
  ).length;
  const enabledCount = GLOBE_LAYERS.filter((def) => envLayers.has(def.key)).length;
  const lockedCount = GLOBE_LAYERS.filter((def) => !hasAccess(def.requiredTier)).length;

  const overscans = useMemo(() => {
    const map = new Map<EnvLayerKey, TileOverscan>();
    if (!viewScale || !Number.isFinite(viewScale.metresPerPixel)) return map;
    for (const def of GLOBE_LAYERS) {
      if (!envLayers.has(def.key)) continue;
      const overscan = tileOverscan(def, viewScale.metresPerPixel, viewScale.latitudeDeg ?? 0);
      if (overscan) map.set(def.key, overscan);
    }
    return map;
  }, [envLayers, viewScale]);

  const needle = query.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  const groups = LAYER_GROUPS.map((group) => {
    const defs = GLOBE_LAYERS.filter(
      (def) =>
        def.group === group &&
        matches(`${def.label} ${def.source ?? ""} ${def.description ?? ""}`) &&
        (!onlyActive || envLayers.has(def.key)),
    );
    const all = GLOBE_LAYERS.filter((def) => def.group === group);
    return {
      group,
      defs,
      total: all.length,
      on: all.filter((def) => envLayers.has(def.key)).length,
      available: all.filter((def) => hasAccess(def.requiredTier)),
    };
  }).filter((entry) => entry.total > 0 && (entry.defs.length > 0 || needle.length > 0));

  const searching = needle.length > 0;

  const bulk = (keys: EnvLayerKey[], enabled: boolean) => {
    if (keys.length === 0) return;
    if (onBulkEnvLayers) {
      onBulkEnvLayers(keys, enabled);
      return;
    }
    for (const key of keys) onToggleEnvLayer(key);
  };

  const toggleGroup = (group: LayerGroup) => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const togglePanel = (panel: string) => {
    setOpenPanels((previous) => {
      const next = new Set(previous);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  };

  const everyLayer = GLOBE_LAYERS.filter((def) => hasAccess(def.requiredTier)).map((def) => def.key);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex w-full items-center gap-2 rounded-md border border-primary/25 bg-background/80 px-2.5 py-2 text-left backdrop-blur-md transition-colors hover:border-primary/50"
        aria-label="Abrir el panel de capas y leyenda"
      >
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/85">
          Capas
        </span>
        <span className="ml-auto font-mono text-[9px] tabular-nums text-primary">
          {enabledCount}/{GLOBE_LAYERS.length}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <section
      className="flex max-h-[min(78vh,720px)] w-full flex-col overflow-hidden rounded-md border border-primary/25 bg-background/85 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl font-mono"
      aria-label="Panel de capas y leyenda del globo"
    >
      {/* Cabecera fija: qué es, cuánto hay encendido y salir. */}
      <header className="flex items-center gap-2 border-b border-border/60 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-label="Plegar el panel de capas"
          aria-expanded
        >
          <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/90">
            Capas del globo
          </span>
        </button>
        <span className="ml-auto shrink-0 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-primary">
          {enabledCount}/{GLOBE_LAYERS.length}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Buscador y acciones: con 53 capas, la lista sin filtro no se recorre. */}
      <div className="border-b border-border/40 px-2.5 py-2">
        <label className="flex items-center gap-1.5 rounded-sm border border-border/60 bg-muted/20 px-2 py-1 focus-within:border-primary/50">
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar capa, fuente o variable…"
            aria-label="Buscar capas"
            className="w-full bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </label>

        <div className="mt-1.5 flex items-center gap-1.5">
          {/* Una sola pieza para encender o apagar todo: dos botones sueltos se
              leían como acciones distintas y no como el mismo interruptor. */}
          <span className="inline-flex overflow-hidden rounded-sm border border-border/60">
            <button
              type="button"
              onClick={() => bulk(everyLayer, true)}
              className="px-2 py-0.5 text-[8px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
              title={`Encender las ${everyLayer.length} capas disponibles (las teselas se limitan a ${MAX_RASTER_LAYERS})`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => bulk(everyLayer, false)}
              className="border-l border-border/60 px-2 py-0.5 text-[8px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
              title="Apagar todas las capas"
            >
              Ninguna
            </button>
          </span>
          <button
            type="button"
            onClick={() => setOnlyActive((value) => !value)}
            aria-pressed={onlyActive}
            className={[
              "flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-wider transition-colors",
              onlyActive
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <SlidersHorizontal className="h-2.5 w-2.5" />
            Solo activas
          </button>
          <span
            className={[
              "ml-auto font-mono text-[8px] tabular-nums",
              lockedCount > 0 ? "text-amber-400/80" : "text-primary/70",
            ].join(" ")}
            title={
              lockedCount > 0
                ? `Inicia sesión para encender ${lockedCount} capas más (plan ${TIER_LABEL[tier]})`
                : "Todas las capas están disponibles"
            }
          >
            {lockedCount > 0 ? `${lockedCount} por plan` : "todo disponible"}
          </span>
        </div>
      </div>

      <div className="legend-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {/* Categorías de inteligencia: encienden grupos de señales del globo. */}
        {!searching && (
          <div className="pt-1.5">
            <SectionHeader
              label="Inteligencia"
              count={`${visibleLayers.size}/${LEGEND_CATEGORIES.length}`}
              open={openPanels.has("intel")}
              onToggle={() => togglePanel("intel")}
            />
            {openPanels.has("intel") && (
              <div className="grid grid-cols-2 gap-1 pb-1">
                {LEGEND_CATEGORIES.map((category) => {
                  const on = visibleLayers.has(category.key);
                  const count = counts?.[category.key];
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => onToggleLayer(category.key)}
                      aria-pressed={on}
                      className={[
                        "flex items-center gap-1.5 rounded-sm border px-1.5 py-1 text-left transition-colors",
                        on
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/45 bg-muted/10 hover:border-border",
                      ].join(" ")}
                    >
                      <category.icon
                        className="h-3 w-3 shrink-0"
                        style={{ color: on ? category.color : "#64748b" }}
                      />
                      <span className="truncate text-[9px] text-foreground/85">{category.label}</span>
                      {typeof count === "number" && (
                        <span className="ml-auto shrink-0 font-mono text-[8px] tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Catálogo por grupos. */}
        {groups.map(({ group, defs, total, on, available }) => {
          const open = searching || openGroups.has(group);
          // El botón del grupo actúa sobre lo que el plan permite: si quedara
          // alguna capa bloqueada, contar el total del grupo dejaría el botón
          // pidiendo «encender» para siempre.
          const availableOn = available.filter((def) => envLayers.has(def.key)).length;
          const groupOff = availableOn < available.length;
          return (
            <div key={group} className="border-t border-border/30 first:border-t-0">
              <SectionHeader
                label={GROUP_LABEL[group]}
                count={`${on}/${total}`}
                open={open}
                onToggle={() => toggleGroup(group)}
                action={
                  // Sin capas disponibles (todo el grupo pide plan) no hay nada
                  // que encender: el botón desaparece en vez de quedarse mudo.
                  available.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => bulk(available.map((def) => def.key), groupOff)}
                      title={groupOff ? "Encender todo el grupo" : "Apagar todo el grupo"}
                      aria-label={`${groupOff ? "Encender" : "Apagar"} ${GROUP_LABEL[group]}`}
                      className="shrink-0 rounded-sm border border-border/50 p-0.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      {groupOff ? <Plus className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                    </button>
                  ) : (
                    <Lock className="h-2.5 w-2.5 shrink-0 text-amber-400/60" aria-label="Requiere plan" />
                  )
                }
              />

              {open && (
                <ul className="space-y-px pb-1.5">
                  {defs.map((def) => {
                    const locked = !hasAccess(def.requiredTier);
                    const isOn = !locked && envLayers.has(def.key);
                    const statusKey = LAYER_STATUS_KEY[def.key];
                    const status = statusKey ? layerStatus?.[statusKey] : undefined;
                    const overscan = !locked ? overscans.get(def.key) : undefined;
                    return (
                      <li key={def.key}>
                        <button
                          type="button"
                          onClick={() => !locked && onToggleEnvLayer(def.key)}
                          disabled={locked}
                          aria-pressed={isOn}
                          title={[
                            def.description,
                            def.source ? `Fuente: ${def.source}` : null,
                            def.freshness ? `Actualiza: ${def.freshness}` : null,
                            locked ? `Requiere plan ${TIER_LABEL[def.requiredTier]}` : null,
                            overscan
                              ? `Ampliada por encima de z${overscan.max}: lo que se ve está interpolado`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          className={[
                            "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left transition-colors",
                            locked
                              ? "cursor-default opacity-55"
                              : "hover:bg-muted/25",
                            isOn && !locked ? "bg-primary/[0.07]" : "",
                          ].join(" ")}
                        >
                          <def.Icon
                            className="h-3 w-3 shrink-0"
                            style={{ color: isOn ? def.color : locked ? "#475569" : "#7c8ba1" }}
                          />
                          <span
                            className={[
                              "min-w-0 flex-1 truncate text-[10px]",
                              isOn ? "text-foreground" : "text-foreground/70",
                            ].join(" ")}
                          >
                            {def.label}
                          </span>
                          {overscan && (
                            <span
                              className="shrink-0 rounded-sm border border-amber-500/30 bg-amber-500/10 px-1 font-mono text-[7px] uppercase tracking-wider text-amber-400"
                              aria-label={`Interpolada, ${overscanLabel(overscan)}`}
                            >
                              {overscanLabel(overscan)}
                            </span>
                          )}
                          {status && isOn && !locked && (
                            <span
                              className={[
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                status.error
                                  ? "bg-destructive"
                                  : status.loading
                                    ? "animate-pulse bg-amber-400"
                                    : "bg-primary",
                              ].join(" ")}
                              title={
                                status.error ?? `${status.count} señales · ${def.source ?? "fuente en vivo"}`
                              }
                            />
                          )}
                          {locked && <Lock className="h-2.5 w-2.5 shrink-0 text-amber-400/80" />}
                          <Switch on={isOn} disabled={locked} />
                        </button>
                      </li>
                    );
                  })}
                  {defs.length === 0 && (
                    <li className="px-1 py-1 text-[9px] text-muted-foreground/60">
                      Nada coincide con «{query}».
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}

        {/* Leyenda del tráfico aéreo: color = altitud, forma = tipo. */}
        <div className="border-t border-border/30">
          <SectionHeader
            label="Leyenda · tráfico aéreo"
            open={openPanels.has("air")}
            onToggle={() => togglePanel("air")}
          />
          {openPanels.has("air") && (
            <div className="pb-1.5">
              <div className="grid grid-cols-2 gap-1">
                {[...ALTITUDE_BANDS, UNKNOWN_BAND].map((band) => (
                  <span
                    key={band.id}
                    className="flex items-center gap-1.5 rounded-sm border border-border/40 bg-muted/10 px-1.5 py-0.5"
                    title={`Color de los contactos entre ${band.label}`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: band.color }} />
                    <span className="truncate text-[9px] text-foreground/80">{band.label}</span>
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {ROLE_ORDER.map((role) => (
                  <span key={role} className="flex min-w-0 items-center gap-1">
                    <img
                      src={aircraftMarkerIcon(null, "#e2e8f0", role)}
                      alt=""
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="truncate text-[9px] text-foreground/80">{ROLE_LABELS[role]}</span>
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[8px] leading-relaxed text-muted-foreground/70">
                Color = altitud, forma = tipo de vuelo. El tipo se infiere del código ICAO y del
                indicativo, no de una identidad declarada.
              </p>
            </div>
          )}
        </div>

        {/* Esferas y envolturas: de la troposfera a la heliosfera. */}
        <div className="border-t border-border/30">
          <SectionHeader
            label="Esferas y envolturas"
            count={`${EARTH_SHELLS.filter((shell) => shell.layer).length}/${EARTH_SHELLS.length}`}
            open={openPanels.has("shells")}
            onToggle={() => togglePanel("shells")}
          />
          {openPanels.has("shells") && (
            <ul className="pb-1.5">
              {EARTH_SHELLS.map((shell) => {
                const def = shell.layer ? layerDef(shell.layer) : undefined;
                const locked = def ? !hasAccess(def.requiredTier) : true;
                const on = def ? !locked && envLayers.has(def.key) : false;
                const status = def && LAYER_STATUS_KEY[def.key]
                  ? layerStatus?.[LAYER_STATUS_KEY[def.key]!]
                  : undefined;
                return (
                  <li key={shell.id}>
                    <button
                      type="button"
                      disabled={!def || locked}
                      onClick={() => def && onToggleEnvLayer(def.key)}
                      aria-pressed={on}
                      title={[shell.range, shell.source, shell.note].filter(Boolean).join(" · ")}
                      className="flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left transition-colors enabled:hover:bg-muted/25 disabled:cursor-default disabled:opacity-55"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: on ? (status?.error ? "#ef4444" : def?.color ?? "#64748b") : "#334155",
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/80">
                        {shell.label}
                      </span>
                      <span className="shrink-0 font-mono text-[8px] text-muted-foreground/70">
                        {shell.range}
                      </span>
                      <Switch on={on} disabled={!def || locked} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Fuentes en vivo, en una tira: antes eran seis tarjetas «LIVE». */}
        <div className="border-t border-border/30">
          <SectionHeader
            label="Fuentes en vivo"
            count="6"
            open={openPanels.has("feeds")}
            onToggle={() => togglePanel("feeds")}
          />
          {openPanels.has("feeds") && (
            <div className="flex flex-wrap gap-1 pb-1.5">
              {DATA_SOURCES.map((source) => (
                <span
                  key={source.key}
                  title={`${source.title} · en vivo`}
                  className="flex items-center gap-1 rounded-sm border border-border/40 bg-muted/10 px-1.5 py-0.5"
                >
                  <source.Icon className="h-2.5 w-2.5 shrink-0" style={{ color: source.color }} />
                  <span className="text-[8px] uppercase tracking-wider text-foreground/75">
                    {source.label}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-emerald-400" aria-hidden="true" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pie fijo: cupo real de teselas y qué plan manda. */}
      <footer className="shrink-0 border-t border-border/60 px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-wider">
          <span
            className={rasterActive >= MAX_RASTER_LAYERS ? "text-amber-400" : "text-muted-foreground/80"}
            title={`Cada capa de teselas ocupa su propia caché de texturas; por encima de ${MAX_RASTER_LAYERS} el globo pierde el contexto WebGL.`}
          >
            Teselas {rasterActive}/{MAX_RASTER_LAYERS}
            {rasterActive >= MAX_RASTER_LAYERS && <span className="ml-1">· tope</span>}
          </span>
          <span className="text-muted-foreground/70">{TIER_LABEL[tier]}</span>
        </div>
        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className={[
              "h-full transition-all",
              rasterActive >= MAX_RASTER_LAYERS ? "bg-amber-400/80" : "bg-primary/70",
            ].join(" ")}
            style={{ width: `${Math.min(100, (rasterActive / MAX_RASTER_LAYERS) * 100)}%` }}
          />
        </div>
      </footer>
    </section>
  );
}
