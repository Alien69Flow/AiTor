import { Brain, Atom, Code2, Link2, Zap, Sparkles } from "lucide-react";
import alienflowLogo from "@/assets/alienflow-logo.png";

const CAPABILITIES = [
  { 
    icon: Link2,
    label: "Blockchain & Web3", 
    description: "DeFi, Smart Contracts, Tokenomics",
    color: "border-primary/20 hover:border-primary/40" 
  },
  { 
    icon: Brain,
    label: "Neural Networks", 
    description: "ML, Deep Learning, Transformers",
    color: "border-secondary/20 hover:border-secondary/40" 
  },
  { 
    icon: Atom,
    label: "Quantum Computing", 
    description: "Post-Quantum Crypto, Qubits",
    color: "border-primary/20 hover:border-primary/40" 
  },
  { 
    icon: Code2,
    label: "Código & Arquitectura", 
    description: "Software, DevOps, Optimización",
    color: "border-secondary/20 hover:border-secondary/40" 
  },
];

const QUICK_PROMPTS = [
  "¿Qué es DeFi y cómo funciona?",
  "Explica los Smart Contracts",
  "Analiza este código por vulnerabilidades",
  "¿Cómo funciona la computación cuántica?",
  "Genera una arquitectura Web3",
  "Optimiza mi algoritmo",
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8 min-h-[60vh]">
      {/* Logo + Brand */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <img 
            src={alienflowLogo} 
            alt="AlienFlow" 
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]"
          />
          <div className="absolute -inset-3 rounded-full bg-primary/5 blur-xl animate-pulse pointer-events-none" />
        </div>
        
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-heading text-primary neon-text-gold tracking-wider">
            AI Tor
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-1 font-mono">
            Oráculo de Inteligencia Artificial Multimodal
          </p>
          <p className="text-[10px] text-secondary/50 font-mono tracking-widest uppercase mt-1">
            ΔlieπFlΦw DAO Synapse Collective
          </p>
        </div>
      </div>

      {/* Capability cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-8">
        {CAPABILITIES.map((cap) => {
          const IconComp = cap.icon;
          return (
            <div 
              key={cap.label}
              className={`flex items-start gap-3 p-3 rounded-xl border bg-card/30 backdrop-blur-sm ${cap.color} transition-all duration-300 cursor-default hover:bg-card/50 group`}
            >
              <div className="p-2 rounded-lg bg-card/60 border border-secondary/10 group-hover:border-secondary/30 transition-colors">
                <IconComp className="w-4 h-4 text-secondary/70 group-hover:text-secondary transition-colors" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-heading text-foreground/80 tracking-wide">{cap.label}</span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">{cap.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick prompts */}
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 justify-center mb-3">
          <Sparkles className="w-3 h-3 text-primary/50" />
          <span className="text-[10px] font-heading text-muted-foreground/50 tracking-widest uppercase">
            Sugerencias rápidas
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onPromptClick?.(prompt)}
              className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground/70 bg-card/40 border border-secondary/15 rounded-full hover:border-primary/30 hover:text-foreground/80 hover:bg-card/60 transition-all duration-200 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
