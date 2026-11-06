import { useState, useMemo } from "react";
import { ExternalLink, RefreshCw, AlertTriangle, Filter } from "lucide-react";
import { useOsintIntel, type IntelCategory, type IntelSeverity } from "@/hooks/useOsintIntel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<IntelCategory, string> = {
  finance: "💰 Finance",
  intel: "👁 Intel/UAP",
  conflict: "⚔ Conflict",
  geopolitical: "🌐 Geopolitical",
  logistics: "📦 Logistics",
  cryptozoo: "🦴 Cryptozoo",
  convergence: "✨ Convergence",
};

const SEVERITY_COLORS: Record<IntelSeverity, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  LOW: "bg-muted/40 text-muted-foreground border-border/40",
};

export function OsintConsole() {
  const [filter, setFilter] = useState<IntelCategory | "all">("all");
  const { events, isLoading, error, lastUpdate, refresh } = useOsintIntel();

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.category === filter)),
    [events, filter]
  );

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading tracking-widest text-foreground uppercase">
            OSINT Console
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {lastUpdate
              ? `Updated ${lastUpdate.toLocaleTimeString()}`
              : "Awaiting telemetry..."}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3 w-3 text-muted-foreground mr-1" />
        <button
          onClick={() => setFilter("all")}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            filter === "all"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/40 text-muted-foreground hover:border-border"
          }`}
        >
          ALL ({events.length})
        </button>
        {(Object.keys(CATEGORY_LABELS) as IntelCategory[]).map((cat) => {
          const count = events.filter((e) => e.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                filter === cat
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-400 border border-red-500/30 bg-red-500/10 rounded p-2">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 && !isLoading && (
          <div className="text-center text-xs text-muted-foreground py-8">
            No intel events. Tap refresh to scan.
          </div>
        )}
        {filtered.map((event) => (
          <a
            key={event.id}
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-lg border border-border/30 bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 ${SEVERITY_COLORS[event.severity]}`}
              >
                {event.severity}
              </Badge>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {CATEGORY_LABELS[event.category]}
              </span>
            </div>
            <h4 className="text-xs font-medium text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
              {event.title}
            </h4>
            {event.summary && (
              <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1">
                {event.summary}
              </p>
            )}
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{event.source}</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
