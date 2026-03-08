import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Grid3X3, Eye, Send, Newspaper } from "lucide-react";

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

const FEED_ITEMS: FeedItem[] = [
  {
    source: "CryptoQuant",
    handle: "@cryptoquant_com",
    reputation: "HIGH REP",
    type: "TWEET",
    severity: "HIGH",
    category: "CRYPTO",
    categoryIcon: "₿",
    text: "Bitcoin whale addresses accumulate 50K BTC in the last 48 hours. On-chain metrics suggest strong conviction from institutional players.",
    time: "now",
  },
  {
    source: "DeFi Pulse",
    handle: "@defipulse",
    reputation: "AGGREGATOR",
    type: "QUOTE",
    severity: "CRITICAL",
    category: "DEFI",
    categoryIcon: "🔗",
    text: "Total Value Locked across all DeFi protocols surpasses $200B. Ethereum L2s lead the growth with 40% increase month-over-month.",
    time: "now",
  },
  {
    source: "Vitalik.eth",
    handle: "@VitalikButerin",
    reputation: "HIGH REP",
    type: "TWEET",
    severity: "HIGH",
    category: "TECH",
    categoryIcon: "⚙️",
    text: "The future of Ethereum scaling is not just about rollups. We need to think about data availability, statelessness, and account abstraction as a unified stack.",
    time: "2m",
  },
  {
    source: "Chainlink",
    handle: "@chainlink",
    reputation: "HIGH REP",
    type: "REPOST",
    severity: "LOW",
    category: "ORACLE",
    categoryIcon: "⛓️",
    text: "Chainlink CCIP now supports 15+ blockchain networks. Cross-chain interoperability entering production phase for enterprise adoption.",
    time: "5m",
  },
];

const severityColor = {
  CRITICAL: "bg-destructive/20 text-destructive border-destructive/30",
  HIGH: "bg-primary/20 text-primary border-primary/30",
  LOW: "bg-muted/50 text-muted-foreground border-border/30",
};

export function FeedPanel() {
  const [activeTab, setActiveTab] = useState<"feed" | "whale" | "flights">("feed");

  return (
    <div className="w-[380px] lg:w-[420px] border-l border-border/20 bg-card/40 backdrop-blur-sm flex flex-col shrink-0 hidden md:flex">
      {/* Panel tabs */}
      <div className="flex items-center border-b border-border/20">
        {(["feed", "whale", "flights"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 text-[11px] font-heading tracking-wider uppercase transition-colors ${
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground/50 hover:text-foreground/70"
            }`}
          >
            {tab === "feed" ? "Feed" : tab === "whale" ? "Whale Tracker" : "Flights (1)"}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[Grid3X3, Newspaper, Eye, Send].map((Icon, i) => (
              <button
                key={i}
                className={`p-1.5 rounded ${i === 0 ? "bg-muted/30 text-foreground/80" : "text-muted-foreground/40 hover:text-foreground/60"} transition-colors`}
              >
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
            <Badge key={sev} variant="outline" className="text-[9px] px-2 py-0 h-5 cursor-pointer hover:bg-muted/30">
              {sev}
            </Badge>
          ))}
          <Badge variant="outline" className="text-[9px] px-2 py-0 h-5 cursor-pointer hover:bg-muted/30">
            + Topic
          </Badge>
          <Badge variant="outline" className="text-[9px] px-2 py-0 h-5 cursor-pointer hover:bg-muted/30">
            + Category
          </Badge>
          <Badge variant="outline" className="text-[9px] px-2 py-0 h-5 cursor-pointer hover:bg-muted/30">
            + Country
          </Badge>
        </div>
      </div>

      {/* Feed items */}
      <div className="flex-1 overflow-y-auto">
        {FEED_ITEMS.map((item, i) => (
          <div key={i} className="px-3 py-3 border-b border-border/10 hover:bg-muted/10 transition-colors">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center text-sm">
                {item.source[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground/90">{item.source}</span>
                  <span className="text-[9px] text-muted-foreground/50">{item.handle}</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-secondary/10 text-secondary border-secondary/30">
                    {item.reputation}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground/40">· {item.time}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                    {item.type}
                  </Badge>
                  <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${severityColor[item.severity]}`}>
                    {item.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-secondary/10 text-secondary border-secondary/30">
                    {item.categoryIcon} {item.category}
                  </Badge>
                </div>
              </div>
            </div>
            {/* Content */}
            <p className="text-[11px] text-foreground/80 leading-relaxed pl-10">{item.text}</p>
          </div>
        ))}

        {/* CTA */}
        <div className="p-3">
          <button className="w-full py-2 text-[10px] font-heading tracking-wider uppercase text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors">
            Share Intel Brief
          </button>
        </div>
      </div>
    </div>
  );
}
