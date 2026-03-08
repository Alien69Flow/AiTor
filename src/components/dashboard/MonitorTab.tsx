import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, Zap, Database, Radio, Eye } from "lucide-react";

interface SystemStatus {
  name: string;
  status: "online" | "degraded" | "offline";
  latency: string;
  uptime: string;
  icon: React.ElementType;
}

export function MonitorTab() {
  const [systems, setSystems] = useState<SystemStatus[]>([
    { name: "AI Terminal (Chat)", status: "online", latency: "120ms", uptime: "99.9%", icon: Zap },
    { name: "Globe 3D Engine", status: "online", latency: "16ms", uptime: "99.8%", icon: Eye },
    { name: "UAP Feed (NUFORC)", status: "online", latency: "850ms", uptime: "97.2%", icon: Radio },
    { name: "Crypto Feed (CoinGecko)", status: "online", latency: "340ms", uptime: "99.5%", icon: Database },
    { name: "News Feed (Firecrawl)", status: "online", latency: "620ms", uptime: "98.8%", icon: Server },
    { name: "Live Cameras", status: "online", latency: "N/A", uptime: "95.1%", icon: Eye },
  ]);

  // Simulate minor fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setSystems((prev) =>
        prev.map((s) => ({
          ...s,
          latency: s.latency === "N/A" ? "N/A" : `${Math.max(10, parseInt(s.latency) + Math.floor((Math.random() - 0.5) * 40))}ms`,
        }))
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = { online: "bg-secondary", degraded: "bg-primary", offline: "bg-destructive" };
  const statusText = { online: "text-secondary", degraded: "text-primary", offline: "text-destructive" };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-heading text-primary uppercase tracking-wider">System Monitor</h2>
        <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 text-secondary border-secondary/30 ml-auto">
          ALL SYSTEMS OPERATIONAL
        </Badge>
      </div>

      {/* Metrics summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Active Systems", value: `${systems.filter((s) => s.status === "online").length}/${systems.length}`, color: "text-secondary" },
          { label: "Avg Latency", value: `${Math.round(systems.filter(s => s.latency !== "N/A").reduce((a, s) => a + parseInt(s.latency), 0) / systems.filter(s => s.latency !== "N/A").length)}ms`, color: "text-primary" },
          { label: "Data Processed", value: "2.4 GB", color: "text-foreground" },
          { label: "Requests/min", value: "847", color: "text-foreground" },
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
                    <span className={`w-2 h-2 rounded-full ${statusColor[sys.status]} animate-pulse`} />
                    <span className={`text-[9px] font-heading uppercase ${statusText[sys.status]}`}>{sys.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
                  <span>Latency: <span className="text-foreground/70 font-mono">{sys.latency}</span></span>
                  <span>Uptime: <span className="text-foreground/70 font-mono">{sys.uptime}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
