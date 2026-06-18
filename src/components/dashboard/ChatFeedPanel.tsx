import { useState, useMemo } from "react";
import { Search, Grid3x3, Eye, Send, Newspaper, Radio, Activity, Satellite, TriangleAlert as AlertTriangle, TrendingUp } from "lucide-react";
import {
  GlassPanel,
  FeedItemCard,
  StatusBadge,
  LedIndicator,
} from "./GlassPanels";

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
  icon: typeof Activity;
  iconColor: string;
  source: string;
  timestamp: string;
  title: string;
  badges: Array<{ label: string; color: string }>;
  type: "quake" | "nasa" | "osint";
}

const TABS = [
  { key: "feed", label: "Feed", icon: Radio },
  { key: "markets", label: "Markets", icon: TrendingUp },
  { key: "flights", label: "Flights", icon: Send },
] as const;

const FILTERS = ["All", "OSINT", "Quakes", "NASA", "Alerts"];

export function ChatFeedPanel({
  earthquakes = [],
  nasaEvents = [],
  osintEvents = [],
}: ChatFeedPanelProps) {
  const [activeTab, setActiveTab] = useState<"feed" | "markets" | "flights">("feed");
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    osintEvents.slice(0, 12).forEach((e) => {
      const sevColor =
        e.severity === "CRITICAL"
          ? "#f87171"
          : e.severity === "HIGH"
          ? "#fb923c"
          : e.severity === "MEDIUM"
          ? "#fbbf24"
          : "#94a3b8";
      items.push({
        icon: AlertTriangle,
        iconColor: sevColor,
        source: e.source.toUpperCase(),
        timestamp: new Date(e.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        badges: [{ label: e.severity, color: sevColor }],
        title: e.title + (e.summary ? ` - ${e.summary}` : ""),
        type: "osint",
      });
    });

    earthquakes.slice(0, 10).forEach((eq) => {
      items.push({
        icon: Activity,
        iconColor:
          eq.magnitude >= 6 ? "#f87171" : eq.magnitude >= 5 ? "#fb923c" : "#fbbf24",
        source: "USGS",
        timestamp: new Date(eq.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        badges: [{ label: `M${eq.magnitude.toFixed(1)}`, color: "#34d399" }],
        title: `${eq.place} - Depth: ${eq.depth}km`,
        type: "quake",
      });
    });

    nasaEvents.slice(0, 8).forEach((ev) => {
      items.push({
        icon: Satellite,
        iconColor: "#34d399",
        source: "NASA EONET",
        timestamp: new Date(ev.date).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),
        badges: [{ label: ev.category, color: "#60a5fa" }],
        title: ev.title,
        type: "nasa",
      });
    });

    return items.slice(0, 30);
  }, [earthquakes, nasaEvents, osintEvents]);

  const filteredItems = useMemo(() => {
    let items = feedItems;
    if (activeFilter === "OSINT") items = items.filter((i) => i.type === "osint");
    if (activeFilter === "Quakes") items = items.filter((i) => i.type === "quake");
    if (activeFilter === "NASA") items = items.filter((i) => i.type === "nasa");
    if (activeFilter === "Alerts")
      items = items.filter((i) =>
        i.badges.some((b) => b.color === "#f87171" || b.color === "#fb923c")
      );
    if (searchQuery)
      items = items.filter((i) =>
        i.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return items;
  }, [feedItems, activeFilter, searchQuery]);

  return (
    <GlassPanel
      title=""
      className="w-[280px] h-full rounded-none border-0"
      variant="secondary"
    >
      <div className="flex flex-col h-full -mt-4 -mx-4">
        {/* Tabs Header */}
        <div className="flex border-b border-slate-700/30">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-medium uppercase tracking-wider transition-all duration-200 ${
                activeTab === t.key
                  ? "text-white/90 border-b-2 border-cyan-400 bg-slate-800/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/20"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-slate-700/25">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {[Grid3x3, Newspaper, Eye, Send].map((Icon, i) => (
                <button
                  key={i}
                  className={`p-1.5 rounded-lg transition-colors ${
                    i === 0
                      ? "bg-slate-700/40 text-slate-300"
                      : "text-slate-600 hover:text-slate-400 hover:bg-slate-700/30"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-[10px] bg-slate-800/40 border border-slate-700/30 text-slate-300 placeholder:text-slate-600 rounded-lg focus:outline-none focus:border-slate-600/50 focus:ring-1 focus:ring-slate-600/30"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 flex items-center gap-1.5 border-b border-slate-700/25">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all duration-200 ${
                activeFilter === f
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-500 border border-slate-700/25 hover:text-slate-400 hover:border-slate-600/35"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Status Line */}
        <div className="px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <LedIndicator color="#34d399" active size="xs" />
            <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider">
              Live Feed
            </span>
          </div>
          <span className="text-[9px] text-slate-500">
            {filteredItems.length} events
          </span>
        </div>

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-slate-600 text-[10px] uppercase tracking-wider">
                No matching events
              </div>
            </div>
          )}
          {filteredItems.map((item, i) => (
            <FeedItemCard
              key={i}
              icon={item.icon}
              iconColor={item.iconColor}
              source={item.source}
              timestamp={item.timestamp}
              title={item.title}
              badges={item.badges}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-700/25 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">
              Data Sources
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant="success">ONLINE</StatusBadge>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
