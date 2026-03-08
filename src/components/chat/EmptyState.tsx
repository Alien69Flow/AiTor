import { TrendingUp, Code2, Globe, Brain, Zap, Shield, Atom, Link2 } from "lucide-react";
import alienflowLogo from "@/assets/alienflow-logo.png";

const CAPABILITIES = [
  { icon: TrendingUp, title: "DeFi & Trading", desc: "Análisis de mercados, tokens y tendencias en tiempo real", color: "border-primary/20 hover:border-primary/40" },
  { icon: Globe, title: "Búsqueda Web", desc: "Búsqueda inteligente con web scraping avanzado", color: "border-secondary/20 hover:border-secondary/40" },
  { icon: Shield, title: "Seguridad & Auditoría", desc: "Auditoría de smart contracts y detección de vulnerabilidades", color: "border-primary/20 hover:border-primary/40" },
  { icon: Atom, title: "Quantum Computing", desc: "Computación cuántica aplicada a criptografía y optimización", color: "border-secondary/20 hover:border-secondary/40" },
  { icon: Code2, title: "Código & Arquitectura", desc: "Generación, análisis y refactorización de código", color: "border-primary/20 hover:border-primary/40" },
  { icon: Link2, title: "Web3 & DAO", desc: "Gobernanza descentralizada, NFTs y protocolos DeFi", color: "border-secondary/20 hover:border-secondary/40" },
];

const QUICK_SUGGESTIONS = [
  "Analiza el mercado DeFi actual",
  "Busca las últimas noticias crypto",
  "Audita un smart contract ERC-20",
  "Genera un thread viral para X",
  "Explica la computación cuántica post-quantum",
  "Crea una estrategia de yield farming",
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 min-h-[60vh]">
      {/* Logo & Branding */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <img
            src={alienflowLogo}
            alt="AlienFlow"
            className="w-20 h-20 object-contain drop-shadow-[0_0_25px_hsl(var(--primary)/0.5)]"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-secondary border-2 border-background animate-pulse" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold text-primary tracking-wider">⚡ AI Tor</h1>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">
            Sistema Operativo de IA Soberana
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Zap className="w-3 h-3 text-secondary" />
            <p className="text-[9px] text-muted-foreground/40 font-heading tracking-widest uppercase">
              ΔlieπFlΦw DAO · Versión ΓΩΣΖ v69
            </p>
            <Zap className="w-3 h-3 text-secondary" />
          </div>
        </div>
      </div>

      {/* Capability Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full max-w-2xl mb-8">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.title}
              className={`flex flex-col gap-2 p-3.5 rounded-xl border bg-card/20 backdrop-blur-sm ${cap.color} transition-all duration-200 group`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center shrink-0 group-hover:border-secondary/40 transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground/50 group-hover:text-secondary transition-colors" />
                </div>
                <span className="text-xs font-heading text-foreground/80 tracking-wide">{cap.title}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 leading-relaxed">{cap.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Quick Suggestions */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3 h-3 text-secondary/70" />
          <span className="text-[10px] font-heading text-muted-foreground/60 tracking-widest uppercase">Sugerencias Rápidas</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onPromptClick?.(suggestion)}
              className="px-3 py-1.5 rounded-full border border-border bg-card/30 hover:bg-card/60 hover:border-secondary/30 text-[10px] font-mono text-muted-foreground/60 hover:text-foreground/80 transition-all cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/30 border border-secondary/15">
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <span className="text-[9px] font-mono text-muted-foreground/50">Oráculo activo · Multi-modelo disponible</span>
      </div>
    </div>
  );
}
