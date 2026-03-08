import { Brain, Atom, Code2, Link2, Zap, Sparkles, Globe, FileSearch } from "lucide-react";
import aitorLogo from "@/assets/aitor-brain-logo.png";

const QUICK_PROMPTS = [
  { icon: Link2, text: "Analiza el mercado DeFi actual", color: "border-primary/20 hover:border-primary/40" },
  { icon: Code2, text: "Revisa este código por vulnerabilidades", color: "border-secondary/20 hover:border-secondary/40" },
  { icon: Globe, text: "Busca las últimas noticias sobre Bitcoin", color: "border-primary/20 hover:border-primary/40" },
  { icon: Brain, text: "Explica redes neuronales transformers", color: "border-secondary/20 hover:border-secondary/40" },
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 mb-8">
        <img
          src={aitorLogo}
          alt="AI Tor"
          className="w-16 h-16 object-contain drop-shadow-[0_0_15px_hsl(var(--secondary)/0.4)]"
        />
        <div className="text-center">
          <h1 className="text-xl font-mono font-bold text-primary tracking-wider">AI Tor</h1>
          <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">
            Sistema Operativo de IA Soberana
          </p>
          <p className="text-[9px] text-muted-foreground/30 font-mono tracking-widest uppercase mt-1">
            ΔlieπFlΦw DAO · Versión ΓΩΣΖ v69
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {QUICK_PROMPTS.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button
              key={prompt.text}
              onClick={() => onPromptClick?.(prompt.text)}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-card/20 backdrop-blur-sm ${prompt.color} transition-all duration-200 cursor-pointer hover:bg-card/40 text-left group`}
            >
              <Icon className="w-4 h-4 text-muted-foreground/50 group-hover:text-secondary transition-colors shrink-0" />
              <span className="text-xs font-mono text-muted-foreground/70 group-hover:text-foreground/80 transition-colors">
                {prompt.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
