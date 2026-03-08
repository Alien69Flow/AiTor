import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
}

export function FeedTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

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
          description: (r.description || r.markdown || "").substring(0, 200),
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

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Real-Time Intel Feed</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchNews} disabled={loading} className="h-7 text-[10px]">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {news.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-8">No news yet. Click Refresh to load.</p>
        )}
        {loading && news.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}
        {news.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-lg bg-card/60 border border-border/20 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground/90 line-clamp-2">{item.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-0.5" />
            </div>
            <Badge variant="outline" className="text-[8px] mt-2 px-1.5 py-0 h-4">
              {item.source}
            </Badge>
          </a>
        ))}
      </div>
    </div>
  );
}
