import { useState } from "react";
import { Search, Grid3X3, Eye, Send, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const glass = "bg-black/60 backdrop-blur-[20px] border-l border-white/[0.06]";

interface FeedPost {
  avatar: string;
  username: string;
  timeAgo: string;
  badges: { label: string; color: string }[];
  text: string;
  mentions?: string[];
}

const STATIC_POSTS: FeedPost[] = [
  {
    avatar: "👤",
    username: "laathifier",
    timeAgo: "700",
    badges: [{ label: "Bot Shews", color: "#0088FF" }, { label: "Reid", color: "#FF4444" }],
    text: "👍 3 bear en · Seapm: These news leam near of 37°. From 19r 5$s diseases. rootpaor' prosters how hera to spoat on how Wab Tobe consulations. For nooftoes, YouTube Tesla Portal aircrafts players...",
    mentions: ["rootpaor"],
  },
  {
    avatar: "🧑‍💻",
    username: "eater_gat",
    timeAgo: "Bot Kiíowe",
    badges: [{ label: "Bot Kiíowe", color: "#0088FF" }, { label: "Reid", color: "#FF4444" }],
    text: "Maja notte conlists to paxr a parpr nor becpnore on Sininy flo ass camplons, of matso-ear marseries, senoed peallser · er shanges tile tdos. 'krotseol' These ponths ha names, osíexus the more penoy...",
  },
  {
    avatar: "🔮",
    username: "marcat",
    timeAgo: "7 oboorers ago",
    badges: [{ label: "Soxd", color: "#FFD700" }],
    text: "Torior aotider: \"Senses as his place Plari: \"loi' to Tie hees.\" oo pelise toe, be by my past or as pleace of dioeore our-iane. We rextrearelly Tear this ttre...",
  },
];

export function ChatFeedPanel() {
  const [activeTab, setActiveTab] = useState<"feed" | "markets" | "flights">("feed");
  const [activeFilter, setActiveFilter] = useState("Markets");

  const tabs = [
    { key: "feed", label: "FEED" },
    { key: "markets", label: "MARKETS" },
    { key: "flights", label: "FLIGHTS (1)" },
  ] as const;

  const filters = ["Markets", "High", "Low", "Category", "Country"];

  return (
    <div className={`${glass} w-[320px] lg:w-[360px] flex flex-col h-full`}>
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
          <Input placeholder="Search..." className="h-6 pl-7 text-[9px] bg-white/[0.03] border-white/[0.06] text-white/60 placeholder:text-white/15" />
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
        {STATIC_POSTS.map((post, i) => (
          <div key={i} className="px-3 py-3 border-b border-white/[0.04]">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-sm shrink-0">
                {post.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-white/90">{post.username}</span>
                  <span className="text-[8px] text-white/20">{post.timeAgo}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {post.badges.map((b, j) => (
                    <Badge key={j} variant="outline" className="text-[7px] px-1 py-0 h-3.5" style={{ color: b.color, borderColor: b.color + "44" }}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-white/60 leading-relaxed mt-1.5">{post.text}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 ml-10">
              <Search className="w-3 h-3 text-white/15" />
              <span className="text-[9px] text-white/20">Add a comment...</span>
            </div>
          </div>
        ))}

        {/* Tickes counter */}
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="text-base">💎</span>
          <span className="text-[9px] font-mono text-white/30">Tickes</span>
          <span className="text-[9px] font-mono text-white/15">100</span>
        </div>
      </div>
    </div>
  );
}
