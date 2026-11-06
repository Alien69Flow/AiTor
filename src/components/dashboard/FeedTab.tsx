import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Newspaper, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
}

type ImpactLevel = "critical" | "high" | "medium" | "low";
type Sentiment = "bullish" | "bearish" | "neutral";

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  critical: "border-destructive/50 text-destructive bg-destructive/10",
  high: "border-primary/50 text-primary bg-primary/10",
  medium: "border-secondary/50 text-secondary bg-secondary/10",
  low: "border-muted-foreground/30 text-muted-foreground bg-muted/20",
};

const SENTIMENT_ICON: Record<Sentiment, React.ReactNode> = {
  bullish: <TrendingUp className="w-3 h-3 text-secondary" />,
  bearish: <TrendingDown className="w-3 h-3 text-destructive" />,
  neutral: <Minus className="w-3 h-3 text-muted-foreground/50" />,
};

const classifyImpact = (title: string): ImpactLevel => {
  const t = title.toLowerCase();
  if (t.includes("crash") || t.includes("hack") || t.includes("sec") || t.includes("ban") || t.includes("regulation")) return "critical";
  if (t.includes("surge") || t.includes("soar") || t.includes("record") || t.includes("billion") || t.includes("launch")) return "high";
  if (t.includes("update") || t.includes("partnership") || t.includes("integration")) return "medium";
  return "low";
};

const classifySentiment = (title: string): Sentiment => {
  const t = title.toLowerCase();
  if (t.includes("surge") || t.includes("soar") || t.includes("bull") || t.includes("gain") || t.includes("up") || t.includes("record") || t.includes("launch")) return "bullish";
  if (t.includes("crash") || t.includes("drop") || t.includes("bear") || t.includes("down") || t.includes("fall") || t.includes("hack") || t.includes("ban")) return "bearish";
  return "neutral";
};

const getSourceIcon = (source: string): string => {
  if (source.includes("twitter") || source.includes("x.com")) return "𝕏";
  if (source.includes("telegram")) return "✈️";
  if (source.includes("reddit")) return "🔴";
  if (source.includes("coindesk") || source.includes("cointelegraph")) return "📰";
  if (source.includes("bloomberg") || source.includes("reuters")) return "📊";
  return "🌐";
};

const IMPACT_FILTERS: ImpactLevel[] = ["critical", "high", "medium", "low"];

export function FeedTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-feed", {
        body: { action: "news" },
      });
      if (error) throw error;
      const items = data?.data || data?.results || [];
      setNews(
        items.map((r: any) => ({
          title: r.title || "Untitled",
          description: (r.description || r.markdown || "").substring(0, 300),
          url: r.url || "#",
          source: new URL(r.url || "https://unknown.com").hostname.replace("www.", ""),
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch news feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  const filtered = impactFilter === "all" ? news : news.filter(item => classifyImpact(item.title) === impactFilter);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Intel Feed</h2>
          <Badge variant="outline" className="text-[7px] font-mono border-secondary/30 text-secondary bg-secondary/5">LIVE</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchNews} disabled={loading} className="h-7 text-[10px]">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Impact filter bar */}
      <div className="flex gap-1 mb-3 flex-wrap">
        <button
          onClick={() => setImpactFilter("all")}
          className={`px-2.5 py-1 text-[9px] font-mono rounded-full transition-all ${
            impactFilter === "all"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground/50 hover:text-foreground/70"
          }`}
        >
          All
        </button>
        {IMPACT_FILTERS.map(level => (
          <button
            key={level}
            onClick={() => setImpactFilter(level)}
            className={`px-2.5 py-1 text-[9px] font-mono rounded-full capitalize transition-all ${
              impactFilter === level
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground/50 hover:text-foreground/70"
            }`}
          >
            {level === "critical" ? "🔴" : level === "high" ? "🟠" : level === "medium" ? "🟡" : "🟢"} {level}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-8">No news yet. Click Refresh to load.</p>
        )}
        {loading && news.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}
        {filtered.map((item, i) => {
          const impact = classifyImpact(item.title);
          const sentiment = classifySentiment(item.title);
          const isExpanded = expanded === i;
          return (
            <div
              key={i}
              className="p-3 rounded-lg bg-card/60 border border-border/20 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-sm mt-0.5 shrink-0">{getSourceIcon(item.source)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className={`text-[7px] px-1.5 py-0 h-4 font-mono ${IMPACT_COLORS[impact]}`}>
                        {impact.toUpperCase()}
                      </Badge>
                      {SENTIMENT_ICON[sentiment]}
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      <p className="text-xs font-bold text-foreground/90 line-clamp-2">{item.title}</p>
                    </a>
                    {isExpanded && item.description && (
                      <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.description && (
                    <button onClick={() => setExpanded(isExpanded ? null : i)} className="p-1 text-muted-foreground/30 hover:text-foreground/50 transition-colors">
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 text-muted-foreground/40 hover:text-primary transition-colors" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4">
                  {item.source}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
