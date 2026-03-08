import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Server, Zap, Database, Radio, Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SystemStatus {
  name: string;
  endpoint: string;
  action: string;
  status: "online" | "degraded" | "offline" | "checking";
  latency: number | null;
  lastCheck: string | null;
  icon: React.ElementType;
}

const INITIAL_SYSTEMS: SystemStatus[] = [
  { name: "AI Nexus (Chat)", endpoint: "chat", action: '{"message":"ping","model":"google/gemini-2.5-flash-lite"}', status: "checking", latency: null, lastCheck: null, icon: Zap },
  { name: "Crypto Feed (CoinGecko)", endpoint: "crypto-feed", action: '{"action":"movers"}', status: "checking", latency: null, lastCheck: null, icon: Database },
  { name: "Crypto Signals (Polymarket)", endpoint: "crypto-signals", action: '{"action":"all"}', status: "checking", latency: null, lastCheck: null, icon: Radio },
  { name: "News Feed (Firecrawl)", endpoint: "firecrawl-search", action: '{"query":"crypto","limit":1}', status: "checking", latency: null, lastCheck: null, icon: Server },
  { name: "UAP Feed", endpoint: "ufo-feed", action: '{"action":"fetch"}', status: "checking", latency: null, lastCheck: null, icon: Eye },
];

export function MonitorTab() {
  const [systems, setSystems] = useState<SystemStatus[]>(INITIAL_SYSTEMS);
  const [pinging, setPinging] = useState(false);

  const pingAll = useCallback(async () => {
    setPinging(true);
    const results = await Promise.all(
      systems.map(async (sys) => {
        const start = Date.now();
        try {
          const { error } = await supabase.functions.invoke(sys.endpoint, {
            body: JSON.parse(sys.action),
          });
          const latency = Date.now() - start;
          const status: "online" | "degraded" | "offline" = error ? "degraded" : latency > 3000 ? "degraded" : "online";
          return { ...sys, status, latency, lastCheck: new Date().toLocaleTimeString() };
        } catch {
          return { ...sys, status: "offline" as const, latency: Date.now() - start, lastCheck: new Date().toLocaleTimeString() };
        }
      })
    );
    setSystems(results);
    setPinging(false);
  }, [systems]);

  useEffect(() => { pingAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onlineCount = systems.filter(s => s.status === "online").length;
  const avgLatency = systems.filter(s => s.latency !== null).reduce((a, s) => a + (s.latency || 0), 0) / (systems.filter(s => s.latency !== null).length || 1);

  const statusColor = { online: "bg-secondary", degraded: "bg-primary", offline: "bg-destructive", checking: "bg-muted-foreground animate-pulse" };
  const statusText = { online: "text-secondary", degraded: "text-primary", offline: "text-destructive", checking: "text-muted-foreground" };
  const allOk = onlineCount === systems.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-heading text-primary uppercase tracking-wider">System Monitor</h2>
        <Badge variant="outline" className={`text-[8px] px-1.5 py-0 h-4 ml-auto ${allOk ? "text-secondary border-secondary/30" : "text-primary border-primary/30"}`}>
          {allOk ? "ALL SYSTEMS OPERATIONAL" : `${onlineCount}/${systems.length} ONLINE`}
        </Badge>
        <Button variant="outline" size="sm" onClick={pingAll} disabled={pinging} className="h-7 text-[10px] ml-1">
          <RefreshCw className={`w-3 h-3 mr-1 ${pinging ? "animate-spin" : ""}`} />
          Ping All
        </Button>
      </div>

      {/* Metrics summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Active Systems", value: `${onlineCount}/${systems.length}`, color: onlineCount === systems.length ? "text-secondary" : "text-primary" },
          { label: "Avg Latency", value: avgLatency > 0 ? `${Math.round(avgLatency)}ms` : "—", color: "text-primary" },
          { label: "Edge Functions", value: `${systems.length}`, color: "text-foreground" },
          { label: "Last Check", value: systems[0]?.lastCheck || "—", color: "text-foreground" },
        ].map((m) => (
          <div key={m.label} className="bg-card/60 border border-border/20 rounded-lg p-3">
            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block">{m.label}</span>
            <span className={`text-lg font-mono font-bold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Systems grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {systems.map((sys) => {
            const Icon = sys.icon;
            return (
              <div key={sys.name} className="bg-card/60 border border-border/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary/60" />
                    <span className="text-xs font-bold text-foreground/90">{sys.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusColor[sys.status]}`} />
                    <span className={`text-[9px] font-heading uppercase ${statusText[sys.status]}`}>{sys.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
                  <span>Latency: <span className="text-foreground/70 font-mono">{sys.latency !== null ? `${sys.latency}ms` : "—"}</span></span>
                  <span>Endpoint: <span className="text-foreground/70 font-mono">{sys.endpoint}</span></span>
                </div>
                {/* Latency bar */}
                {sys.latency !== null && (
                  <div className="mt-2 h-1 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${sys.status === "online" ? "bg-secondary" : sys.status === "degraded" ? "bg-primary" : "bg-destructive"}`}
                      style={{ width: `${Math.min(100, (sys.latency / 5000) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
