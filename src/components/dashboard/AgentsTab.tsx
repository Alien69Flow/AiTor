import { Bot, Plus, Sparkles, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AGENTS = [
  { name: "AI Tor", role: "Oráculo General", status: "active", model: "Gemini 2.5 Flash", icon: "⚡" },
  { name: "AlienFlow Pro", role: "Razonamiento Avanzado", status: "active", model: "Gemini 2.5 Pro", icon: "👽" },
  { name: "DeFi Sentinel", role: "Monitor de Protocolos", status: "coming", model: "ChainGPT", icon: "🔗" },
  { name: "Code Auditor", role: "Seguridad de Contratos", status: "coming", model: "GPT-5", icon: "🛡️" },
];

export function AgentsTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-auto">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-heading font-bold text-foreground tracking-wider">AI Agents</h2>
            <Badge variant="outline" className="text-[8px] font-heading tracking-widest border-primary/30 text-primary bg-primary/5">BETA</Badge>
          </div>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 bg-card/30 text-xs text-muted-foreground/60 hover:text-foreground hover:border-primary/30 transition-all">
            <Plus className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">Crear Agente</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground/60 mb-6">Agentes de IA especializados con personalidades y habilidades únicas.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AGENTS.map((agent, i) => (
            <div key={i} className={`p-5 rounded-xl border bg-card/30 backdrop-blur-sm transition-all ${
              agent.status === "active" ? "border-border/60 hover:border-secondary/40 hover:bg-card/50" : "border-border/30 opacity-60"
            }`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center text-lg">
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-foreground">{agent.name}</span>
                    {agent.status === "active" ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    ) : (
                      <Badge variant="outline" className="text-[7px] font-mono border-border text-muted-foreground/40">Soon</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{agent.role}</p>
                  <p className="text-[9px] text-muted-foreground/30 mt-1 font-mono">Modelo: {agent.model}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-xl border border-border/40 bg-card/20 text-center">
          <Sparkles className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50">Agentes personalizados con herramientas, memoria y workflows — próximamente</p>
        </div>
      </div>
    </div>
  );
}
