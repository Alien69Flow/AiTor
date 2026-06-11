import { useState, useMemo } from "react";
import { Search, Grid3x3 as Grid3X3, Eye, Send, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const glass = "bg-slate-900/40 backdrop-blur-xl border-l border-slate-700/40";

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

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    osintEvents.slice(0, 12).forEach((e) => {
      const sevColor =
        e.severity === "CRITICAL" ? "#f87171" :
        e.severity === "HIGH" ? "#fb923c" :
        e.severity === "MEDIUM" ? "#fbbf24" : "#94a3b8";
      items.push({
        avatar: "📡",
        source: e.source.toUpperCase(),
        timeAgo: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        badges: [
          { label: e.severity, color: sevColor },
          { label: e.category.toUpperCase(), color: "#34d399" },
        ],
        text: e.title + (e.summary ? ` — ${e.summary}` : ""),
        type: "osint",
        url: e.url,
      });
    });

    earthquakes.slice(0, 10).forEach(eq => {
      items.push({
        avatar: "🌍",
        source: "USGS",
        timeAgo: new Date(eq.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        badges: [
          { label: `M${eq.magnitude.toFixed(1)}`, color: eq.magnitude >= 6 ? "#f87171" : eq.magnitude >= 5 ? "#fb923c" : "#fbbf24" },
          { label: "Seismic", color: "#60a5fa" },
        ],
        text: `${eq.place} — Depth: ${eq.depth}km. Coordinates: ${eq.lat.toFixed(2)}°, ${eq.lon.toFixed(2)}°`,
        type: "quake",
      });
    });

    nasaEvents.slice(0, 8).forEach(ev => {
      items.push({
        avatar: "🛰️",
        source: "NASA EONET",
        timeAgo: new Date(ev.date).toLocaleDateString([], { month: "short", day: "numeric" }),
        badges: [
          { label: ev.category, color: "#34d399" },
          { label: "NASA", color: "#60a5fa" },
        ],
        text: ev.title,
        type: "nasa",
      });
    });

    return items.slice(0, 30);
  }, [earthquakes, nasaEvents, osintEvents]);

  const filteredItems = useMemo(() => {
    let items = feedItems;
    if (activeFilter === "OSINT") items = items.filter(i => i.type === "osint");
    if (activeFilter === "Quakes") items = items.filter(i => i.type === "quake");
    if (activeFilter === "NASA") items = items.filter(i => i.type === "nasa");
    if (activeFilter === "Alerts") items = items.filter(i => i.badges.some(b => b.color === "#f87171"));
    if (searchQuery) items = items.filter(i => i.text.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [feedItems, activeFilter, searchQuery]);

  return (
    <div className={`${glass} w-[280px] flex flex-col h-full`}>
      {/* Tabs */}
      <div className="flex border-b border-slate-700/25">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              activeTab === t.key ? "text-white/90 border-b-2 border-sky-400" : "text-slate-500 hover:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/20">
        <div className="flex items-center gap-1">
          {[Grid3X3, Newspaper, Eye, Send].map((Icon, i) => (
            <button key={i} className={`p-1 rounded-lg ${i === 0 ? "bg-slate-700/30 text-slate-400" : "text-slate-600 hover:text-slate-400"}`}>
              <Icon className="w-3 h-3" />
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-6 pl-7 text-[9px] bg-slate-800/30 border-slate-700/30 text-slate-300 placeholder:text-slate-600 rounded-lg"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-700/20">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-2 py-0.5 rounded-lg text-[8px] font-mono transition-colors ${
              activeFilter === f ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-slate-500 border border-slate-700/25 hover:text-slate-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      <div className="px-3 py-1.5 text-center">
        <span className="text-[8px] font-mono text-slate-500">STATUS: </span>
        <span className="text-[8px] font-mono text-emerald-400 font-bold">ONLINE</span>
      </div>

      {/* Feed Posts */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 && (
          <div className="px-3 py-6 text-center text-[9px] font-mono text-slate-600">
            No events matching filter
          </div>
        )}
        {filteredItems.map((post, i) => (
          <div key={i} className="px-3 py-3 border-b border-slate-700/15 hover:bg-slate-800/20 transition-colors">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-slate-800/40 flex items-center justify-center text-sm shrink-0">
                {post.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-white/90">{post.source}</span>
                  <span className="text-[8px] text-slate-500">{post.timeAgo}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {post.badges.map((b, j) => (
                    <Badge key={j} variant="outline" className="text-[7px] px-1 py-0 h-3.5 rounded-md" style={{ color: b.color, borderColor: b.color + "33" }}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 leading-relaxed mt-1">{post.text}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Live count */}
        <div className="px-3 py-2.5 flex items-center gap-2">
          <span className="text-base">📡</span>
          <span className="text-[9px] font-mono text-slate-500">Live Events</span>
          <span className="text-[9px] font-mono text-slate-600">{feedItems.length}</span>
        </div>
      </div>
    </div>
  );
}
