import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Radio, Eye, MapPin, Clock, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const FALLBACK_SIGHTINGS: Omit<Sighting, 'id'>[] = [
  { location: "Phoenix, AZ, USA", date_reported: "2026-03-07", type: "Triangle Formation", severity: "confirmed", description: "Multiple witnesses report triangular craft with 3 lights hovering silently over Camelback Mountain.", source: "NUFORC", source_url: null, lat: 33.5, lon: -112.0 },
  { location: "Hessdalen, Norway", date_reported: "2026-03-06", type: "Luminous Orb", severity: "investigating", description: "Recurring light phenomenon detected by automated sensors. Spectral analysis shows unusual emission lines.", source: "Hessdalen Project", source_url: null, lat: 62.8, lon: 11.2 },
  { location: "Colares, Brazil", date_reported: "2026-03-05", type: "Bright Beam", severity: "signal", description: "Fishermen report bright beams of light scanning the river surface at 03:00 local time.", source: "Local Report", source_url: null, lat: -0.9, lon: -48.5 },
  { location: "Skinwalker Ranch, UT, USA", date_reported: "2026-03-07", type: "Anomalous Signal", severity: "confirmed", description: "UAPX sensors detected 1.6GHz signal burst with no identified source. Duration: 4.2 seconds.", source: "UAPX", source_url: null, lat: 40.2, lon: -109.9 },
  { location: "Fukuoka, Japan", date_reported: "2026-03-04", type: "Disc-shaped Object", severity: "investigating", description: "JASDF radar tracked unidentified object at 40,000ft moving at Mach 3. No flight plan filed.", source: "JASDF", source_url: null, lat: 33.6, lon: 130.4 },
  { location: "Rendlesham Forest, UK", date_reported: "2026-03-06", type: "Ground Trace", severity: "signal", description: "Unusual ground markings found with elevated radiation readings. Triangular pattern, 3m each side.", source: "UK MOD", source_url: null, lat: 52.1, lon: 1.4 },
];

const LIVE_CAMS = [
  { id: "iss", label: "ISS Live Feed", url: "https://www.youtube.com/embed/P9C25Un7xaM?autoplay=1&mute=1", source: "NASA" },
  { id: "iss-earth", label: "ISS HD Earth View", url: "https://www.youtube.com/embed/KG6SV1dluXA?autoplay=1&mute=1", source: "NASA" },
  { id: "bears", label: "Brown Bears - Katmai", url: "https://www.youtube.com/embed/HKj2HHSgYFo?autoplay=1&mute=1", source: "explore.org" },
  { id: "africam", label: "African Waterhole", url: "https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1", source: "explore.org" },
  { id: "volcano", label: "Iceland Volcano", url: "https://www.youtube.com/embed/BA-9QzIcr3c?autoplay=1&mute=1", source: "RÚV" },
  { id: "popocatepetl", label: "Popocatépetl Volcano", url: "https://www.youtube.com/embed/Do9x2p2bTjc?autoplay=1&mute=1", source: "SkylineWebcams" },
  { id: "northern-lights", label: "Northern Lights - Norway", url: "https://www.youtube.com/embed/z-gYMjGYOCk?autoplay=1&mute=1", source: "NorwayLights" },
  { id: "milkyway", label: "Milky Way Galaxy", url: "https://www.youtube.com/embed/kKfRELpFSBQ?autoplay=1&mute=1", source: "NASA" },
];

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "confirmed":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[9px]">🛸 UAP Confirmed</Badge>;
    case "investigating":
      return <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px]">⚠️ Under Investigation</Badge>;
    case "signal":
      return <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-[9px]">📡 Signal Detected</Badge>;
    default:
      return null;
  }
}

export function UFOMonitorTab() {
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSightings = async () => {
    try {
      const { data, error } = await supabase
        .from('uap_sightings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        setSightings(data as Sighting[]);
      } else {
        // Use fallback data if DB is empty
        setSightings(FALLBACK_SIGHTINGS.map((s, i) => ({ ...s, id: `fallback-${i}` })));
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
      setSightings(FALLBACK_SIGHTINGS.map((s, i) => ({ ...s, id: `fallback-${i}` })));
    } finally {
      setLoading(false);
    }
  };

  const refreshFeed = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ufo-feed');
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Feed actualizado: ${data.count} reportes encontrados`);
        await fetchSightings();
      } else {
        toast.error(data?.error || 'Error actualizando feed');
      }
    } catch (err) {
      console.error('Error refreshing feed:', err);
      toast.error('Error conectando con fuentes de datos');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSightings();
  }, []);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0 overflow-hidden">
      {/* Left: Sightings Feed */}
      <div className="flex-1 flex flex-col min-h-0 lg:max-w-[55%]">
        <div className="flex items-center gap-2 px-3 py-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-xs font-heading text-primary uppercase tracking-wider">UAP Anomaly Feed</span>
          <span className="text-[9px] text-muted-foreground/50 ml-1">{sightings.length} reports</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshFeed}
            disabled={refreshing}
            className="ml-auto h-6 px-2 text-[9px] text-primary hover:text-primary/80"
          >
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            {refreshing ? "Scanning..." : "Refresh Feed"}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
            </div>
          ) : (
            sightings.map((s) => (
              <Card key={s.id} className="p-3 bg-card/60 border-border/30 hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-primary/70" />
                    <span className="text-xs font-heading text-foreground/90">{s.location}</span>
                  </div>
                  <SeverityBadge severity={s.severity || 'signal'} />
                </div>
                <p className="text-[11px] text-muted-foreground/70 mb-2 leading-relaxed">{s.description}</p>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground/40">
                  <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{s.date_reported}</span>
                  <span className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />{s.type}</span>
                  {s.source && <span className="flex items-center gap-1">📡 {s.source}</span>}
                  {s.source_url && (
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:text-primary">
                      <ExternalLink className="w-2.5 h-2.5" />Source
                    </a>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Right: Live Cameras */}
      <div className="flex-1 flex flex-col min-h-0 lg:max-w-[45%]">
        <div className="flex items-center gap-2 px-3 py-2">
          <Radio className="w-4 h-4 text-destructive animate-pulse" />
          <span className="text-xs font-heading text-primary uppercase tracking-wider">Live Cameras</span>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2 px-2 pb-2 overflow-y-auto">
          {LIVE_CAMS.map((cam) => (
            <div
              key={cam.id}
              className="relative rounded-lg overflow-hidden border border-border/30 bg-card/40 hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => setSelectedCam(selectedCam === cam.id ? null : cam.id)}
            >
              {selectedCam === cam.id ? (
                <iframe
                  src={cam.url}
                  className="w-full aspect-video border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                  allowFullScreen
                  title={cam.label}
                />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-muted/20">
                  <div className="flex flex-col items-center gap-1">
                    <Radio className="w-5 h-5 text-primary/50" />
                    <span className="text-[10px] text-muted-foreground/60">Click to load</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-background/90 to-transparent">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-heading text-foreground/80 uppercase tracking-wider">{cam.label}</span>
                  <span className="text-[8px] text-muted-foreground/40 flex items-center gap-0.5">
                    <ExternalLink className="w-2 h-2" />
                    {cam.source}
                  </span>
                </div>
              </div>
              {selectedCam === cam.id && (
                <div className="absolute top-1 right-1">
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/80 text-[8px] text-destructive-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive-foreground animate-pulse" />
                    LIVE
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
