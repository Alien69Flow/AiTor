import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Grid3X3, Eye, Send, Newspaper } from "lucide-react";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";

interface FeedItem {
  source: string;
  handle: string;
  reputation: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "LOW";
  category: string;
  categoryIcon: string;
  text: string;
  time: string;
}

const severityColor = {
  CRITICAL: "bg-destructive/20 text-destructive border-destructive/30",
  HIGH: "bg-primary/20 text-primary border-primary/30",
  LOW: "bg-muted/50 text-muted-foreground border-border/30",
};

interface FeedPanelProps {
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
}

export function FeedPanel({ earthquakes = [], nasaEvents = [] }: FeedPanelProps) {
  const [activeTab, setActiveTab] = useState<"feed" | "quakes" | "nasa">("feed");

  // Build real feed items from earthquakes
  const quakeItems: FeedItem[] = [...earthquakes]
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 15)
    .map(q => ({
      source: "USGS",
      handle: "@uslogsgs",
      reputation: "GOV",
      type: "SEISMIC",
      severity: q.magnitude >= 5 ? "CRITICAL" : q.magnitude >= 4 ? "HIGH" : "LOW",
      category: "EARTHQUAKE",
      categoryIcon: "💥",
      text: `M${q.magnitude.toFixed(1)} — ${q.place} (depth: ${q.depth.toFixed(0)}km)`,
      time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));

  const nasaItems: FeedItem[] = nasaEvents.slice(0, 15).map(evt => ({
    source: "NASA EONET",
    handle: "@nasa",
    reputation: "GOV",
    type: "ALERT",
    severity: "HIGH",
    category: evt.category.toUpperCase(),
    categoryIcon: evt.category.toLowerCase().includes("fire") ? "🔥" : "⚠️",
    text: evt.title,
    time: evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "Active",
  }));

  const STATIC_FEED: FeedItem[] = [
    { source: "CryptoQuant", handle: "@cryptoquant_com", reputation: "HIGH REP", type: "TWEET", severity: "HIGH", category: "CRYPTO", categoryIcon: "₿", text: "Bitcoin whale addresses accumulate 50K BTC in the last 48 hours.", time: "now" },
    { source: "DeFi Pulse", handle: "@defipulse", reputation: "AGGREGATOR", type: "QUOTE", severity: "CRITICAL", category: "DEFI", categoryIcon: "🔗", text: "Total Value Locked across all DeFi protocols surpasses $200B.", time: "now" },
  ];

  const displayItems = activeTab === "quakes" ? quakeItems : activeTab === "nasa" ? nasaItems : [...quakeItems.slice(0, 3), ...nasaItems.slice(0, 2), ...STATIC_FEED];

  return (
    <div className="w-[380px] lg:w-[420px] border-l border-border/20 bg-card/40 backdrop-blur-sm flex flex-col shrink-0 hidden md:flex">
      <div className="flex items-center border-b border-border/20">
        {(["feed", "quakes", "nasa"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 text-[11px] font-heading tracking-wider uppercase transition-colors ${
              activeTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground/50 hover:text-foreground/70"
            }`}>
            {tab === "feed" ? "Feed" : tab === "quakes" ? `Quakes (${earthquakes.length})` : `NASA (${nasaEvents.length})`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[Grid3X3, Newspaper, Eye, Send].map((Icon, i) => (
              <button key={i} className={`p-1.5 rounded ${i === 0 ? "bg-muted/30 text-foreground/80" : "text-muted-foreground/40 hover:text-foreground/60"} transition-colors`}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
            <Input placeholder="Search..." className="h-7 pl-7 text-[10px] bg-muted/20 border-border/20" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["Critical", "High", "Low"].map((sev) => (
            <Badge key={sev} variant="outline" className="text-[9px] px-2 py-0 h-5 cursor-pointer hover:bg-muted/30">{sev}</Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {displayItems.map((item, i) => (
          <div key={i} className="px-3 py-3 border-b border-border/10 hover:bg-muted/10 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center text-sm">{item.categoryIcon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground/90">{item.source}</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-secondary/10 text-secondary border-secondary/30">{item.reputation}</Badge>
                  <span className="text-[9px] text-muted-foreground/40">· {item.time}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">{item.type}</Badge>
                  <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${severityColor[item.severity]}`}>{item.severity}</Badge>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-secondary/10 text-secondary border-secondary/30">{item.categoryIcon} {item.category}</Badge>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed pl-10">{item.text}</p>
          </div>
        ))}

        {displayItems.length === 0 && (
          <div className="p-6 text-center text-muted-foreground/40 text-xs font-mono">
            Waiting for data...
          </div>
        )}
      </div>
    </div>
  );
}
