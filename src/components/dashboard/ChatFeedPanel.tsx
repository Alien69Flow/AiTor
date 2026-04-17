import { useState, useMemo } from "react";
import { Search, Grid3X3, Eye, Send, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const glass = "bg-black/60 backdrop-blur-[20px] border-l border-white/[0.06]";

interface EarthquakeData {
  id: string;
  magnitude: number;
  place: string;
  time: number | string;
  lat: number;
  lon: number;
  depth: number;
  url?: string;
}

interface NasaEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  lat?: number;
  lon?: number;
}

interface OsintEvent {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  summary?: string;
  timestamp: string;
}

interface ChatFeedPanelProps {
  earthquakes?: EarthquakeData[];
  nasaEvents?: NasaEvent[];
  osintEvents?: OsintEvent[];
}

interface FeedItem {
  avatar: string;
  source: string;
  timeAgo: string;
  badges: { label: string; color: string }[];
  text: string;
  type: "quake" | "nasa" | "alert" | "osint";
  url?: string;
}

export function ChatFeedPanel({ earthquakes = [], nasaEvents = [], osintEvents = [] }: ChatFeedPanelProps) {
  const [activeTab, setActiveTab] = useState<"feed" | "markets" | "flights">("feed");
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { key: "feed", label: "FEED" },
    { key: "markets", label: "MARKETS" },
    { key: "flights", label: "FLIGHTS" },
  ] as const;

  const filters = ["All", "OSINT", "Quakes", "NASA", "Alerts"];

  // Build real feed items from live data
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    // Earthquakes
    earthquakes.slice(0, 10).forEach(eq => {
      items.push({
        avatar: "🌍",
        source: "USGS",
        timeAgo: new Date(eq.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        badges: [
          { label: `M${eq.magnitude.toFixed(1)}`, color: eq.magnitude >= 6 ? "#FF4444" : eq.magnitude >= 5 ? "#FF8844" : "#FFD700" },
          { label: "Seismic", color: "#0088FF" },
        ],
        text: `${eq.place} — Depth: ${eq.depth}km. Coordinates: ${eq.lat.toFixed(2)}°, ${eq.lon.toFixed(2)}°`,
        type: "quake",
      });
    });

    // NASA events
    nasaEvents.slice(0, 8).forEach(ev => {
      items.push({
        avatar: "🛰️",
        source: "NASA EONET",
        timeAgo: new Date(ev.date).toLocaleDateString([], { month: "short", day: "numeric" }),
        badges: [
          { label: ev.category, color: "#00FF41" },
          { label: "NASA", color: "#0088FF" },
        ],
        text: ev.title,
        type: "nasa",
      });
    });

    // Sort by most recent
    return items.slice(0, 15);
  }, [earthquakes, nasaEvents]);

  const filteredItems = useMemo(() => {
    let items = feedItems;
    if (activeFilter === "Quakes") items = items.filter(i => i.type === "quake");
    if (activeFilter === "NASA") items = items.filter(i => i.type === "nasa");
    if (activeFilter === "Alerts") items = items.filter(i => i.badges.some(b => b.color === "#FF4444"));
    if (searchQuery) items = items.filter(i => i.text.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [feedItems, activeFilter, searchQuery]);

  return (
    <div className={`${glass} w-[280px] flex flex-col h-full`}>
      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider ${
              activeTab === t.key ? "text-[#00FF41] border-b border-[#00FF41]" : "text-white/25 hover:text-white/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-1">
          {[Grid3X3, Newspaper, Eye, Send].map((Icon, i) => (
            <button key={i} className={`p-1 rounded ${i === 0 ? "bg-white/5 text-white/50" : "text-white/20 hover:text-white/40"}`}>
              <Icon className="w-3 h-3" />
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-6 pl-7 text-[9px] bg-white/[0.03] border-white/[0.06] text-white/60 placeholder:text-white/15"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.04]">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-2 py-0.5 rounded text-[8px] font-mono ${
              activeFilter === f ? "bg-[#00FF41]/20 text-[#00FF41] border border-[#00FF41]/30" : "text-white/25 border border-white/[0.06] hover:text-white/40"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* OZONE LAYER badge */}
      <div className="px-3 py-1 text-center">
        <span className="text-[8px] font-mono text-white/30">OZONE LAYER: </span>
        <span className="text-[8px] font-mono text-[#00FF41] font-bold">[ONLINE]</span>
      </div>

      {/* Feed Posts */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 && (
          <div className="px-3 py-6 text-center text-[9px] font-mono text-white/20">
            No events matching filter
          </div>
        )}
        {filteredItems.map((post, i) => (
          <div key={i} className="px-3 py-3 border-b border-white/[0.04]">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-sm shrink-0">
                {post.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-white/90">{post.source}</span>
                  <span className="text-[8px] text-white/20">{post.timeAgo}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {post.badges.map((b, j) => (
                    <Badge key={j} variant="outline" className="text-[7px] px-1 py-0 h-3.5" style={{ color: b.color, borderColor: b.color + "44" }}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-[9px] text-white/60 leading-relaxed mt-1">{post.text}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Live count */}
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="text-base">📡</span>
          <span className="text-[9px] font-mono text-white/30">Live Events</span>
          <span className="text-[9px] font-mono text-white/15">{feedItems.length}</span>
        </div>
      </div>
    </div>
  );
}
