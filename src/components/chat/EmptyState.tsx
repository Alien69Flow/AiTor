import { TrendingUp, Code2, Globe, Shield, Atom, Link2, Search, ArrowRight } from "lucide-react";
import alienflowLogo from "@/assets/alienflow-logo.png";

const CAPABILITIES = [
  { icon: Search, title: "Búsqueda Web", desc: "Busca y analiza información en tiempo real", prompt: "Busca en la web: últimas noticias sobre crypto y DeFi" },
  { icon: TrendingUp, title: "DeFi & Trading", desc: "Análisis de mercados y estrategias", prompt: "Analiza el mercado DeFi actual y dame oportunidades" },
  { icon: Shield, title: "Auditoría Smart Contracts", desc: "Seguridad y detección de vulnerabilidades", prompt: "Audita un smart contract ERC-20 buscando vulnerabilidades" },
  { icon: Code2, title: "Código & Arquitectura", desc: "Genera, analiza y refactoriza código", prompt: "Genera un smart contract en Solidity para un token ERC-20" },
  { icon: Atom, title: "Quantum Computing", desc: "Criptografía post-cuántica y optimización", prompt: "Explica la computación cuántica aplicada a criptografía" },
  { icon: Link2, title: "Web3 & DAO", desc: "Gobernanza, NFTs y protocolos DeFi", prompt: "Diseña la arquitectura de una DAO con gobernanza on-chain" },
];

const SUGGESTIONS = [
  "Busca en la web: precio de Bitcoin hoy",
  "Genera un thread viral para X",
  "Compara Ethereum vs Solana",
  "Crea una estrategia de yield farming",
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 min-h-[60vh]">
      {/* Hero Branding */}
      <div className="flex flex-col items-center gap-3 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative">
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-primary/10 blur-2xl animate-pulse" />
          <img
            src={alienflowLogo}
            alt="AlienFlow"
            className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
          />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-wider">
            AI Tor
          </h1>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Tu oráculo de inteligencia artificial soberana
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <p className="text-[10px] text-muted-foreground/40 font-heading tracking-[0.2em] uppercase">
              ΔlieπFlΦw DAO · Multi-Oracle System
            </p>
          </div>
        </div>
      </div>

      {/* Capability Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl mb-8">
        {CAPABILITIES.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <button
              key={cap.title}
              onClick={() => onPromptClick?.(cap.prompt)}
              className="flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card/30 hover:bg-card/60 hover:border-secondary/40 hover:shadow-[0_0_25px_hsl(var(--secondary)/0.08)] transition-all duration-300 text-left group animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <div className="w-9 h-9 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center shrink-0 group-hover:border-secondary/40 group-hover:bg-secondary/5 transition-all">
                <Icon className="w-4 h-4 text-muted-foreground/60 group-hover:text-secondary transition-colors" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">{cap.title}</span>
                <span className="text-[10px] text-muted-foreground/50 leading-relaxed mt-0.5">{cap.desc}</span>
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-secondary/60 shrink-0 mt-1 transition-colors" />
            </button>
          );
        })}
      </div>

      {/* Quick Suggestions */}
      <div className="flex flex-wrap gap-2 justify-center max-w-2xl animate-in fade-in duration-1000" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPromptClick?.(suggestion)}
            className="px-3.5 py-2 rounded-full border border-border/60 bg-card/20 hover:bg-card/50 hover:border-secondary/30 text-xs text-muted-foreground/60 hover:text-foreground/80 transition-all cursor-pointer hover:shadow-[0_0_15px_hsl(var(--secondary)/0.06)]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
