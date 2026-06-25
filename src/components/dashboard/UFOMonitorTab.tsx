import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Radio,
  Eye,
  MapPin,
  Clock,
  ExternalLink,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Credibility = "OFICIAL" | "CIVIL";

type FeedSource = {
  id: string;
  name: string;
  url: string;
  badge: string;
  credibility: Credibility;
  query: string;
};

const FEED_SOURCES: FeedSource[] = [
  {
    id: "aaro",
    name: "AARO",
    url: "https://www.aaro.mil/",
    badge: "PENTÁGONO OFICIAL",
    credibility: "OFICIAL",
    query: "site:aaro.mil UAP report",
  },
  {
    id: "wargov",
    name: "War.gov UFO",
    url: "https://www.war.gov/UFO/",
    badge: "DESCLASIFICADO",
    credibility: "OFICIAL",
    query: "site:war.gov UFO declassified",
  },
  {
    id: "mufon",
    name: "MUFON",
    url: "https://mufon.com",
    badge: "MUFON CIVIL",
    credibility: "CIVIL",
    query: "site:mufon.com latest UFO sighting",
  },
  {
    id: "nuforc",
    name: "NUFORC",
    url: "https://nuforc.org",
    badge: "NUFORC CIVIL",
    credibility: "CIVIL",
    query: "site:nuforc.org recent UFO report",
  },
];

type FeedItem = {
  id: string;
  source: FeedSource;
  title: string;
  description: string;
  url: string;
  date: string | null;
  location: string | null;
};

type LiveCam = {
  id: string;
  label: string;
  category: "ESPACIO" | "NATURALEZA" | "VOLCANES" | "OCÉANO";
  embed?: string;
  external: string;
  source: string;
};

const LIVE_CAMS: LiveCam[] = [
  { id: "iss", label: "ISS Live Feed", category: "ESPACIO", embed: "https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1&mute=1", external: "https://www.youtube.com/watch?v=21X5lGlDOfg", source: "NASA" },
  { id: "sdo", label: "NASA Solar SDO", category: "ESPACIO", external: "https://sdo.gsfc.nasa.gov/data/", source: "NASA SDO" },
  { id: "goes", label: "GOES Satélite", category: "ESPACIO", external: "https://www.star.nesdis.noaa.gov/GOES/", source: "NOAA" },
  { id: "milkyway", label: "Milky Way", category: "ESPACIO", embed: "https://www.youtube.com/embed/0FH9cgRhQ-k?autoplay=1&mute=1", external: "https://www.youtube.com/watch?v=0FH9cgRhQ-k", source: "YouTube" },

  { id: "bears", label: "Bears Katmai", category: "NATURALEZA", external: "https://explore.org/livecams/brown-bears/brown-bear-salmon-cam-brooks-falls", source: "explore.org" },
  { id: "waterhole", label: "African Waterhole", category: "NATURALEZA", external: "https://explore.org/livecams/african-wildlife/african-waterhole", source: "explore.org" },
  { id: "aurora", label: "Northern Lights", category: "NATURALEZA", external: "https://explore.org/livecams/aurora-borealis/northern-lights-cam", source: "explore.org" },
  { id: "shark", label: "Shark Cam", category: "NATURALEZA", external: "https://explore.org/livecams/sharks/shark-cam", source: "explore.org" },
  { id: "yellow", label: "Yellowstone Old Faithful", category: "NATURALEZA", external: "https://explore.org/livecams/yellowstone/yellowstone-national-park-old-faithful-geysers", source: "explore.org" },

  { id: "popo", label: "Popocatépetl", category: "VOLCANES", external: "https://www.cenapred.unam.mx/camPopocatepetl/", source: "CENAPRED" },
  { id: "iceland", label: "Iceland Volcano", category: "VOLCANES", embed: "https://www.youtube.com/embed/9qZyqSfcNGU?autoplay=1&mute=1", external: "https://www.youtube.com/watch?v=9qZyqSfcNGU", source: "YouTube" },
  { id: "teide", label: "Teide", category: "VOLCANES", embed: "https://www.youtube.com/embed/live_stream?channel=UCkWGYwJFEcmfLDEpGkgZvqw&autoplay=1&mute=1", external: "https://www.youtube.com/@volcanesdecanarias/live", source: "YouTube" },

  { id: "monterey", label: "Monterey Aquarium", category: "OCÉANO", external: "https://www.montereybayaquarium.org/animals/live-cams", source: "MBA" },
];

const CATEGORY_ORDER: LiveCam["category"][] = ["ESPACIO", "NATURALEZA", "VOLCANES", "OCÉANO"];

function CredibilityBadge({ credibility }: { credibility: Credibility }) {
  if (credibility === "OFICIAL") {
    return (
      <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-[9px] gap-1">
        <ShieldCheck className="w-2.5 h-2.5" /> OFICIAL
      </Badge>
    );
  }
  return (
    <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px] gap-1">
      <Users className="w-2.5 h-2.5" /> CIVIL
    </Badge>
  );
}

function SourceBadge({ source }: { source: FeedSource }) {
  return (
    <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-border/40 text-foreground/70">
      {source.badge}
    </Badge>
  );
}

function LiveCamCard({ cam, active, onToggle }: { cam: LiveCam; active: boolean; onToggle: () => void }) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const canEmbed = !!cam.embed && !embedFailed;

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/30 bg-card/40 hover:border-primary/40 transition-colors group">
      {active && canEmbed ? (
        <iframe
          src={cam.embed}
          className="w-full aspect-video border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          allowFullScreen
          title={cam.label}
          onError={() => setEmbedFailed(true)}
        />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="w-full aspect-video flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-muted/30 to-background/60 hover:from-primary/10"
        >
          <Radio className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors" />
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
            {cam.embed ? "Click to load" : "Embed bloqueado"}
          </span>
          {!cam.embed && (
            <a
              href={cam.external}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              Ver en directo <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </button>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-background/95 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-heading text-foreground/85 uppercase tracking-wider truncate">
            {cam.label}
          </span>
          <a
            href={cam.external}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[8px] text-muted-foreground/60 hover:text-primary flex items-center gap-0.5 shrink-0"
          >
            <ExternalLink className="w-2 h-2" />
            {cam.source}
          </a>
        </div>
      </div>
      {active && canEmbed && (
        <div className="absolute top-1 right-1">
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/80 text-[8px] text-destructive-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive-foreground animate-pulse" />
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}

export function UFOMonitorTab() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCams, setActiveCams] = useState<Set<string>>(new Set());

  const toggleCam = (id: string) => {
    setActiveCams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        FEED_SOURCES.map(async (source) => {
          try {
            const { data, error } = await supabase.functions.invoke("firecrawl-search", {
              body: { query: source.query, options: { limit: 4, lang: "en" } },
            });
            if (error || !data?.success) return [] as FeedItem[];
            const raw = (data.data || data.web || []) as Array<{
              url?: string;
              title?: string;
              description?: string;
              markdown?: string;
            }>;
            return raw.slice(0, 4).map((r, i) => ({
              id: `${source.id}-${i}`,
              source,
              title: r.title || source.name,
              description: (r.description || r.markdown || "").slice(0, 260),
              url: r.url || source.url,
              date: null,
              location: null,
            }));
          } catch {
            return [] as FeedItem[];
          }
        }),
      );
      const merged = results.flat();
      if (merged.length === 0) {
        toast.error("Sin resultados del feed UAP — revisa Firecrawl");
      } else {
        toast.success(`UAP feed: ${merged.length} resultados`);
      }
      setItems(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    cams: LIVE_CAMS.filter((c) => c.category === cat),
  }));

  return (
    <div className="flex-1 flex flex-col gap-3 p-2 min-h-0 overflow-y-auto">
      {/* TOP: UAP FEED (full width) */}
      <section className="flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-xs font-heading text-primary uppercase tracking-wider">
            UAP Anomaly Feed
          </span>
          <span className="text-[9px] text-muted-foreground/50 ml-1">
            {items.length} reports · {FEED_SOURCES.length} sources
          </span>
          <div className="ml-auto flex items-center gap-2">
            {FEED_SOURCES.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-primary uppercase tracking-wider"
              >
                <ExternalLink className="w-2.5 h-2.5" /> {s.name}
              </a>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadFeed}
              disabled={loading}
              className="h-6 px-2 text-[9px] text-primary hover:text-primary/80"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              {loading ? "Scanning..." : "Refresh Feed"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 px-2">
          {loading && items.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            </div>
          ) : items.length === 0 ? (
            <div className="col-span-full text-center py-8 text-[11px] text-muted-foreground/60">
              No hay resultados. Pulsa Refresh para rescanear las fuentes oficiales y civiles.
            </div>
          ) : (
            items.map((it) => (
              <Card
                key={it.id}
                className="p-3 bg-card/60 border-border/30 hover:border-primary/30 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <SourceBadge source={it.source} />
                  <CredibilityBadge credibility={it.source.credibility} />
                </div>
                <h3 className="text-xs font-heading text-foreground/90 leading-snug line-clamp-2">
                  {it.title}
                </h3>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-3">
                  {it.description || "Sin descripción disponible."}
                </p>
                <div className="flex items-center justify-between mt-auto pt-1 text-[9px] text-muted-foreground/50">
                  <span className="flex items-center gap-1">
                    {it.location ? (
                      <>
                        <MapPin className="w-2.5 h-2.5" /> {it.location}
                      </>
                    ) : (
                      <>
                        <Clock className="w-2.5 h-2.5" /> {it.date || "Feed en vivo"}
                      </>
                    )}
                  </span>
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Ver fuente <ExternalLink className="w-2.5 h-2.5" /> →
                  </a>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* BOTTOM: LIVE CAMERAS grid by category */}
      <section className="flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2">
          <Radio className="w-4 h-4 text-destructive animate-pulse" />
          <span className="text-xs font-heading text-primary uppercase tracking-wider">
            Live Cameras
          </span>
          <span className="text-[9px] text-muted-foreground/50 ml-1">
            {LIVE_CAMS.length} feeds
          </span>
        </div>

        <div className="flex flex-col gap-3 px-2 pb-2">
          {grouped.map(({ cat, cams }) => (
            <div key={cat} className="flex flex-col gap-1.5">
              <div className="text-[9px] font-heading uppercase tracking-[0.3em] text-muted-foreground/60 px-1">
                {cat}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {cams.map((cam) => (
                  <LiveCamCard
                    key={cam.id}
                    cam={cam}
                    active={activeCams.has(cam.id)}
                    onToggle={() => toggleCam(cam.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}