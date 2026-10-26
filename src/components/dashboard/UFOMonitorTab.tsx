import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TriangleAlert as AlertTriangle, Clock, Database, ExternalLink, Loader as Loader2, MapPin,
  Radio, RefreshCw, ShieldCheck, SlidersHorizontal, Users,
} from "lucide-react";
import { fetchAllUapSightingsRows, isUapSightingsTableMissing } from "@/lib/uap-sightings";
import { fetchNuforcRecords, fetchNuforcMeta, NUFORC_SOURCE, type NuforcMeta } from "@/lib/nuforc-records";
import {
  LIVE_CATEGORIES, LIVE_SIGNALS, LIVE_VERIFIED_ON,
  signalThumb, signalsByCategory, type LiveCategoryId, type LiveSignal,
} from "@/lib/live-signals";
import { LiveStage } from "./LiveStage";
import { HistoricCasesStrip, OfficialSourcesStrip } from "./OfficialSourcesStrip";
import { LIVE_STATUS_CHECKED_ON, signalLiveState } from "@/lib/live-status";
import { markRevived, readRevived, writeRevived } from "@/lib/live-revived";
import { toast } from "sonner";

type Sighting = {
  id: string;
  location: string;
  date_reported: string | null;
  type: string | null;
  severity: string | null;
  description: string | null;
  source: string | null;
  source_url: string | null;
  lat: number | null;
  lon: number | null;
};

/**
 * Clearly-labelled sample records. They are only shown when the UAP table is
 * unreachable, and the UI marks them as sample data instead of passing them off
 * as real reports.
 */
const SAMPLE_SIGHTINGS: Sighting[] = [
  { id: "sample-1", location: "Phoenix, AZ, USA", date_reported: "2026-03-07", type: "Triangle Formation", severity: "confirmed", description: "Multiple witnesses report triangular craft with 3 lights hovering silently over Camelback Mountain.", source: "NUFORC", source_url: "https://nuforc.org/", lat: 33.5, lon: -112.0 },
  { id: "sample-2", location: "Hessdalen, Norway", date_reported: "2026-03-06", type: "Luminous Orb", severity: "investigating", description: "Recurring light phenomenon detected by automated sensors. Spectral analysis shows unusual emission lines.", source: "Hessdalen Project", source_url: "https://hessdalen.org/", lat: 62.8, lon: 11.2 },
  { id: "sample-3", location: "Colares, Brazil", date_reported: "2026-03-05", type: "Bright Beam", severity: "signal", description: "Fishermen report bright beams of light scanning the river surface at 03:00 local time.", source: "MUFON", source_url: "https://mufon.com/", lat: -0.9, lon: -48.5 },
  { id: "sample-4", location: "Skinwalker Ranch, UT, USA", date_reported: "2026-03-07", type: "Anomalous Signal", severity: "confirmed", description: "UAPX sensors detected a 1.6 GHz signal burst with no identified source. Duration: 4.2 seconds.", source: "AARO", source_url: "https://www.aaro.mil/", lat: 40.2, lon: -109.9 },
  { id: "sample-5", location: "Fukuoka, Japan", date_reported: "2026-03-04", type: "Disc-shaped Object", severity: "investigating", description: "JASDF radar tracked an unidentified object at 40,000 ft moving at Mach 3. No flight plan filed.", source: "JASDF", source_url: "https://www.mod.go.jp/asdf/", lat: 33.6, lon: 130.4 },
  { id: "sample-6", location: "Rendlesham Forest, UK", date_reported: "2026-03-06", type: "Ground Trace", severity: "signal", description: "Unusual ground markings found with elevated radiation readings. Triangular pattern, 3 m each side.", source: "UK MOD", source_url: "https://www.gov.uk/government/organisations/ministry-of-defence", lat: 52.1, lon: 1.4 },
];

/** Reports painted per page: enough to read the newest, short enough that the
 * historical record and the camera wall stay a scroll away instead of 20 000 px
down. */
const REGISTRY_PAGE = 18;

const SEVERITY_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "confirmed", label: "Confirmadas" },
  { id: "investigating", label: "En estudio" },
  { id: "signal", label: "Señales" },
] as const;

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "confirmed":
      return <Badge className="border-destructive/30 bg-destructive/20 text-[9px] text-destructive">UAP confirmado</Badge>;
    case "investigating":
      return <Badge className="border-primary/30 bg-primary/20 text-[9px] text-primary">En investigación</Badge>;
    case "signal":
      return <Badge className="border-secondary/30 bg-secondary/20 text-[9px] text-secondary">Señal detectada</Badge>;
    default:
      return null;
  }
}

function Chip({ icon, children, tone = "default" }: { icon?: ReactNode; children: ReactNode; tone?: "default" | "live" | "warn" }) {
  const toneClass =
    tone === "live"
      ? "border-destructive/30 bg-destructive/10 text-destructive-foreground"
      : tone === "warn"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
        : "border-border/50 bg-card/40 text-muted-foreground";
  return (
    <span className={`flex items-center gap-1 border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${toneClass}`}>
      {icon}
      {children}
    </span>
  );
}

function SignalCard({
  signal,
  active,
  failed,
  offline,
  onSelect,
}: {
  signal: LiveSignal;
  active: boolean;
  failed: boolean;
  /** La última reverificación semanal no encontró emisión. */
  offline: boolean;
  onSelect: () => void;
}) {
  const state = failed
    ? "No disponible"
    : offline
      ? "Sin emisión"
      : signal.liveAtBuild
        ? "En directo"
        : "En espera";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={`${signal.label} — ${signal.source}`}
      className={`group relative w-[172px] shrink-0 snap-start overflow-hidden border text-left transition-colors ${
        active ? "border-primary/70" : "border-border/50 hover:border-primary/40"
      }`}
    >
      <img
        src={signalThumb(signal)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={`h-[97px] w-full object-cover transition-opacity ${
          failed || offline ? "opacity-25 grayscale" : active ? "opacity-95" : "opacity-70 group-hover:opacity-95"
        }`}
      />
      <span
        className={`absolute left-1 top-1 flex items-center gap-1 border px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider backdrop-blur ${
          failed || offline
            ? "border-border/60 bg-background/80 text-muted-foreground"
            : signal.liveAtBuild
              ? "border-destructive/50 bg-destructive/30 text-destructive-foreground"
              : "border-amber-400/40 bg-background/75 text-amber-300"
        }`}
      >
        <span
          className={`h-1 w-1 rounded-full ${
            failed || offline ? "bg-muted-foreground" : signal.liveAtBuild ? "animate-pulse bg-red-400" : "bg-amber-400"
          }`}
        />
        {state}
      </span>
      <span className="absolute right-1 top-1 border border-border/60 bg-background/80 px-1 py-0.5 font-mono text-[8px] text-muted-foreground backdrop-blur">
        {signal.official ? "Oficial" : "Colab."}
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent px-1.5 pb-1.5 pt-4">
        {/* Two lines instead of an ellipsis: with fifteen volcanoes and four
            airports, the distinguishing part of a name is often the end. */}
        <span className="line-clamp-2 font-heading text-[10px] uppercase leading-tight tracking-wide text-foreground/90">
          {signal.label}
        </span>
        <span className="block truncate font-mono text-[8px] text-muted-foreground">{signal.source}</span>
      </span>
    </button>
  );
}

export function UFOMonitorTab() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [feedNote, setFeedNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]["id"]>("all");
  /** The registry holds ~190 reports; only the newest page is painted at first. */
  const [visibleCount, setVisibleCount] = useState(REGISTRY_PAGE);
  // No category is preselected: the stage and its iframes only mount after the
  // visitor asks for one, so the anomaly registry paints first.
  const [category, setCategory] = useState<LiveCategoryId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, string>>({});
  // Cámaras que el informe semanal dio por apagadas pero que sí emiten.
  const [revived, setRevived] = useState<Record<string, string>>(() => readRevived());

  useEffect(() => {
    writeRevived(revived);
  }, [revived]);

  const liveState = useCallback(
    (signal: LiveSignal) => {
      if (revived[signal.id]) return "live" as const;
      const state = signalLiveState(signal);
      // Sin dato fiable de la sonda se mantiene la foto del build: `unknown` no
      // es lo mismo que «apagada».
      if (state === "unknown" && signal.liveAtBuild) return "live" as const;
      return state;
    },
    [revived],
  );
  const [nuforcMeta, setNuforcMeta] = useState<NuforcMeta | null>(null);

  const selected = useMemo(
    () => LIVE_SIGNALS.find((signal) => signal.id === selectedId) ?? null,
    [selectedId]
  );
  const categorySignals = useMemo(() => (category ? signalsByCategory(category) : []), [category]);
  const liveCount = LIVE_SIGNALS.filter((signal) => liveState(signal) === "live" && !failures[signal.id]).length;
  const officialCams = LIVE_SIGNALS.filter((signal) => signal.official).length;
  const nuforcCount = useMemo(
    () => sightings.filter((record) => record.source === NUFORC_SOURCE.label).length,
    [sightings]
  );
  /** Newest report the UAP table itself returned, so its last sync is visible. */
  const tableNewest = useMemo(() => {
    const dates = sightings
      .filter((record) => record.source !== NUFORC_SOURCE.label && record.date_reported)
      .map((record) => record.date_reported as string)
      .sort();
    return dates.at(-1) ?? null;
  }, [sightings]);

  const visibleSightings = useMemo(
    () => (severity === "all" ? sightings : sightings.filter((s) => (s.severity || "signal") === severity)),
    [sightings, severity]
  );

  const fetchSightings = useCallback(async () => {
    // The database table and the open NUFORC mirror are independent feeds:
    // one of them dying must not empty the registry on its own.
    const [table, external, externalMeta] = await Promise.all([
      fetchAllUapSightingsRows()
        .then((rows) => ({ rows: rows as Sighting[], unreachable: false }))
        .catch(() => ({ rows: [] as Sighting[], unreachable: true })),
      fetchNuforcRecords(180),
      fetchNuforcMeta(),
    ]);
    setNuforcMeta(externalMeta);

    // The table currently stores repeated placeholder rows ("Global", no
    // description), so fold identical records together before deciding
    // whether there is anything worth showing.
    const seen = new Set<string>();
    const unique = table.rows.filter((row) => {
      const key = [row.location, row.type, row.date_reported, (row.description ?? "").slice(0, 80)].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const informative = unique.filter(
      (row) => (row.description ?? "").trim().length > 0 || (row.location ?? "").trim().toLowerCase() !== "global"
    );

    const byDateDesc = (a: Sighting, b: Sighting) => {
      const toTime = (value: string | null) => {
        const time = Date.parse(value ?? "");
        return Number.isNaN(time) ? 0 : time;
      };
      return toTime(b.date_reported) - toTime(a.date_reported);
    };

    if (informative.length > 0 || external.length > 0) {
      setSightings([...informative, ...external].sort(byDateDesc).slice(0, 300));
      setFeedNote(
        informative.length > 0
          ? null
          : `La tabla UAP no aporta registros propios: el registro se completa con ${external.length} informes del espejo abierto de NUFORC (avistamientos entre ${externalMeta?.dateFrom ?? "?"} y ${externalMeta?.dateTo ?? "?"}).`
      );
    } else {
      setSightings(SAMPLE_SIGHTINGS);
      setFeedNote(
        table.unreachable
          ? "No se pudo consultar la tabla UAP ni el espejo NUFORC. Se muestran ejemplos locales, no informes reales."
          : unique.length > 0
            ? `La tabla UAP sólo contiene ${unique.length} registro(s) sin ubicación ni descripción. Se muestran ejemplos locales hasta que se completen.`
            : "La tabla UAP no devolvió registros. Se muestran ejemplos locales, no informes reales."
      );
    }
    setLoading(false);
  }, []);

  const refreshFeed = async () => {
    if (isUapSightingsTableMissing()) {
      toast.info("La tabla UAP no responde; se muestran registros de ejemplo marcados como tales");
      return;
    }
    setRefreshing(true);
    try {
      await fetchSightings();
      toast.success("Feed sincronizado");
    } catch {
      toast.error("Error conectando con las fuentes de datos");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchSightings();
  }, [fetchSightings]);

  // A new severity filter starts from the newest page again, not from the last
  // expanded position.
  useEffect(() => {
    setVisibleCount(REGISTRY_PAGE);
  }, [severity]);

  const handleUnavailable = useCallback((signal: LiveSignal, reason: string) => {
    setFailures((prev) => (prev[signal.id] ? prev : { ...prev, [signal.id]: reason }));
  }, []);

  // El reproductor está reproduciendo: se retira la marca de «sin emisión» que
  // dejó la última verificación, en este navegador, hasta que caduque, y se
  // borra el fallo de esta sesión para que el contador de la categoría suba.
  const handleLive = useCallback((signal: LiveSignal) => {
    setRevived((previous) => (previous[signal.id] ? previous : markRevived(previous, signal.id)));
    setFailures((previous) => {
      if (!previous[signal.id]) return previous;
      const next = { ...previous };
      delete next[signal.id];
      return next;
    });
  }, []);

  const pickCategory = (id: LiveCategoryId) => {
    setCategory(id);
    const first = signalsByCategory(id)[0];
    if (first) setSelectedId(first.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-card/40 px-3 py-2 backdrop-blur">
        <Radio className="h-4 w-4 shrink-0 animate-pulse text-destructive" aria-hidden="true" />
        <h2 className="font-heading text-xs uppercase tracking-wider text-primary">Monitor UAP</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip icon={<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />} tone="live">
            {liveCount} señales en vivo
          </Chip>
          <Chip icon={<Database className="h-3 w-3" aria-hidden="true" />}>
            {sightings.length} registros
          </Chip>
          <Chip icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}>
            {officialCams} cámaras oficiales
          </Chip>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshFeed}
          disabled={refreshing}
          className="ml-auto h-7 px-2 font-mono text-[9px] text-primary hover:text-primary/80"
        >
          {refreshing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          {refreshing ? "Sincronizando…" : "Sincronizar"}
        </Button>
      </header>

      <div className="flex flex-col gap-5 p-3">
        {/* --- Official sources, right under the header ------------------- */}
        <OfficialSourcesStrip />

        {/* --- Cameras, right after the sources (on demand) --------------- */}
        <section aria-label="Señales en directo" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-destructive/80" aria-hidden="true" />
            <h3 className="font-heading text-[11px] uppercase tracking-wider text-foreground/85">Cámaras en directo</h3>
            <span className="font-mono text-[9px] text-muted-foreground/55">
              {officialCams} oficiales · {liveCount} emitiendo
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Categorías de señal">
              {LIVE_CATEGORIES.map((entry) => {
                const active = category === entry.id;
                const signals = signalsByCategory(entry.id);
                // El contador dice cuántas emiten ahora, no cuántas hay listadas:
                // una categoría con 30 fichas y 2 en directo engaña.
                const liveInCategory = signals.filter(
                  (signal) => liveState(signal) === "live" && !failures[signal.id],
                ).length;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => pickCategory(entry.id)}
                    aria-pressed={active}
                    title={`${entry.hint} · ${liveInCategory} en directo de ${signals.length}`}
                    className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-heading text-[10px] uppercase tracking-wider transition-colors ${
                      active ? "border-primary/50 bg-primary/10 text-primary" : "border-border/50 bg-card/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {entry.label}
                    <span className="font-mono text-[8px] opacity-60">{liveInCategory}</span>
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[9px] text-muted-foreground/60">
              {category
                ? `${categorySignals.filter((signal) => liveState(signal) === "live").length} de ${categorySignals.length} emitiendo`
                : "Elige una categoría para cargar sus cámaras"}
            </p>
          </div>

          {selected ? (
            <>
              <LiveStage
                signal={selected}
                blockedReason={failures[selected.id]}
                onUnavailable={handleUnavailable}
                onLive={handleLive}
              />
              {liveState(selected) === "offline" && !failures[selected.id] && (
                <p className="border border-amber-400/30 bg-amber-400/5 px-2 py-1.5 font-mono text-[9px] leading-4 text-amber-300/90">
                  La verificación del {LIVE_STATUS_CHECKED_ON} no encontró emisión en esta cámara. Se está probando
                  de nuevo: si arranca, se desmarca sola.
                </p>
              )}

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Canales disponibles">
                {categorySignals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    active={signal.id === selected.id}
                    failed={Boolean(failures[signal.id])}
                    offline={liveState(signal) === "offline"}
                    onSelect={() => setSelectedId(signal.id)}
                  />
                ))}
              </div>
              <p className="font-mono text-[9px] text-muted-foreground/60">
                Lista curada el {LIVE_VERIFIED_ON}
                {LIVE_STATUS_CHECKED_ON ? ` · reverificada el ${LIVE_STATUS_CHECKED_ON}` : ""}. Las cámaras marcadas «sin emisión»
                no emitían en esa comprobación; el reproductor también detecta cortes y ofrece la fuente oficial.
              </p>
            </>
          ) : (
            <p className="border border-dashed border-border/50 bg-card/20 px-3 py-6 text-center font-mono text-[10px] leading-5 text-muted-foreground/70">
              Elige una categoría para cargar sus cámaras: no se descarga ningún vídeo ni miniatura hasta que la abras.
            </p>
          )}
        </section>

        {/* --- Anomaly feed ----------------------------------------------- */}
        <section aria-label="Registro de avistamientos" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400/80" aria-hidden="true" />
            <h3 className="font-heading text-[11px] uppercase tracking-wider text-foreground/85">Registro de anomalías</h3>
            <span className="font-mono text-[9px] text-muted-foreground">
              {Math.min(visibleCount, visibleSightings.length)} de {visibleSightings.length}
              {visibleSightings.length !== sightings.length ? ` de ${sightings.length}` : ""} · más recientes primero
            </span>
            {nuforcCount > 0 && (
              <span
                className="font-mono text-[9px] text-muted-foreground/55"
                title={`${sightings.length - nuforcCount} registros de la tabla UAP · ${nuforcCount} del espejo abierto de NUFORC (dataset DataHerb, ordenado por fecha de avistamiento). Instantánea generada el ${nuforcMeta?.generatedAt.slice(0, 10) ?? "—"}.`}
              >
                {sightings.length - nuforcCount} tabla UAP{tableNewest ? ` (última ${tableNewest})` : ""} · {nuforcCount} NUFORC
                {nuforcMeta?.dateFrom && nuforcMeta?.dateTo && ` (${nuforcMeta.dateFrom} → ${nuforcMeta.dateTo})`}
                {nuforcMeta?.stale &&
                  nuforcMeta.datasetAgeDays !== null &&
                  ` · origen congelado hace ${Math.floor(nuforcMeta.datasetAgeDays / 365)} años`}
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
              {SEVERITY_FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSeverity(option.id)}
                  aria-pressed={severity === option.id}
                  className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                    severity === option.id
                      ? "border-secondary/50 bg-secondary/10 text-secondary"
                      : "border-border/40 text-muted-foreground/70 hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {feedNote && !loading && (
            <p className="border border-amber-400/30 bg-amber-400/5 px-2 py-1.5 font-mono text-[9px] leading-4 text-amber-300/90" role="status">
              {feedNote}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
            </div>
          ) : visibleSightings.length === 0 ? (
            <p className="py-6 text-center font-mono text-[10px] text-muted-foreground">
              Ningún registro con ese filtro.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleSightings.slice(0, visibleCount).map((s) => (
                <article
                  key={s.id}
                  className="flex flex-col gap-2 border border-border/40 bg-card/40 p-3 transition-colors hover:border-primary/35 hover:bg-card/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-heading text-[11px] text-foreground/90">
                      <MapPin className="h-3 w-3 shrink-0 text-primary/70" aria-hidden="true" />
                      <span className="truncate">{s.location}</span>
                    </span>
                    <SeverityBadge severity={s.severity || "signal"} />
                  </div>
                  {s.description && (
                    <p className="font-mono text-[10px] leading-4 text-muted-foreground">{s.description}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-muted-foreground/60">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                      {s.date_reported ?? "sin fecha"}
                    </span>
                    {s.type && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                        {s.type}
                      </span>
                    )}
                    {s.source && <span>{s.source}</span>}
                    {s.source_url && (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-primary/70 hover:text-primary"
                      >
                        <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                        Fuente
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {visibleSightings.length > visibleCount && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount((count) => count + REGISTRY_PAGE)}
              className="mx-auto h-8 px-3 font-mono text-[9px] uppercase tracking-wider text-primary hover:text-primary/80"
            >
              Ver {Math.min(REGISTRY_PAGE, visibleSightings.length - visibleCount)} más ·
              {" "}
              {visibleSightings.length - visibleCount} restantes
            </Button>
          )}
        </section>

        {/* --- Historical record ------------------------------------------ */}
        <HistoricCasesStrip />

        {/* --- Method ----------------------------------------------------- */}
        <footer className="flex flex-col gap-2 border-t border-border/40 pt-3">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] leading-4 text-muted-foreground/55">
            <span className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5" aria-hidden="true" />
              Las cámaras son emisiones de terceros: se marcan como oficiales (NASA, USGS) o de colaboradores.
            </span>
            <span>Las búsquedas se hacen por palabras clave, no hay verificación automática de avistamientos.</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
