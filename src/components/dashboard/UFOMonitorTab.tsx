import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Radio, Eye, MapPin, Clock, ExternalLink } from "lucide-react";

const MOCK_SIGHTINGS = [
  { id: 1, location: "Phoenix, AZ, USA", date: "2026-03-07", type: "Triangle Formation", severity: "confirmed", description: "Multiple witnesses report triangular craft with 3 lights hovering silently over Camelback Mountain.", lat: 33.5, lon: -112.0 },
  { id: 2, location: "Hessdalen, Norway", date: "2026-03-06", type: "Luminous Orb", severity: "investigating", description: "Recurring light phenomenon detected by automated sensors. Spectral analysis shows unusual emission lines.", lat: 62.8, lon: 11.2 },
  { id: 3, location: "Colares, Brazil", date: "2026-03-05", type: "Bright Beam", severity: "signal", description: "Fishermen report bright beams of light scanning the river surface at 03:00 local time.", lat: -0.9, lon: -48.5 },
  { id: 4, location: "Skinwalker Ranch, UT, USA", date: "2026-03-07", type: "Anomalous Signal", severity: "confirmed", description: "UAPX sensors detected 1.6GHz signal burst with no identified source. Duration: 4.2 seconds.", lat: 40.2, lon: -109.9 },
  { id: 5, location: "Fukuoka, Japan", date: "2026-03-04", type: "Disc-shaped Object", severity: "investigating", description: "JASDF radar tracked unidentified object at 40,000ft moving at Mach 3. No flight plan filed.", lat: 33.6, lon: 130.4 },
  { id: 6, location: "Rendlesham Forest, UK", date: "2026-03-06", type: "Ground Trace", severity: "signal", description: "Unusual ground markings found with elevated radiation readings. Triangular pattern, 3m each side.", lat: 52.1, lon: 1.4 },
];

const LIVE_CAMS = [
  { id: "iss", label: "ISS Live Feed", url: "https://www.youtube.com/embed/P9C25Un7xaM?autoplay=1&mute=1", source: "NASA" },
  { id: "bears", label: "Brown Bears - Katmai", url: "https://www.youtube.com/embed/HKj2HHSgYFo?autoplay=1&mute=1", source: "explore.org" },
  { id: "africam", label: "African Waterhole", url: "https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1", source: "explore.org" },
  { id: "volcano", label: "Iceland Volcano", url: "https://www.youtube.com/embed/BA-9QzIcr3c?autoplay=1&mute=1", source: "RÚV" },
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

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0 overflow-hidden">
      {/* Left: Sightings Feed */}
      <div className="flex-1 flex flex-col min-h-0 lg:max-w-[55%]">
        <div className="flex items-center gap-2 px-3 py-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-xs font-heading text-primary uppercase tracking-wider">Anomaly Feed</span>
          <span className="text-[9px] text-muted-foreground/50 ml-auto">{MOCK_SIGHTINGS.length} active reports</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 px-2 pb-2">
          {MOCK_SIGHTINGS.map((s) => (
            <Card key={s.id} className="p-3 bg-card/60 border-border/30 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-primary/70" />
                  <span className="text-xs font-heading text-foreground/90">{s.location}</span>
                </div>
                <SeverityBadge severity={s.severity} />
              </div>
              <p className="text-[11px] text-muted-foreground/70 mb-2 leading-relaxed">{s.description}</p>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground/40">
                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{s.date}</span>
                <span className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />{s.type}</span>
              </div>
            </Card>
          ))}
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
