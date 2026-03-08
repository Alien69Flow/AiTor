import { TrendingUp, Code2, Globe, Brain, Zap, Shield } from "lucide-react";
import alienflowLogo from "@/assets/alienflow-logo.png";

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: "Analiza el mercado DeFi actual y dame las tendencias principales", color: "border-primary/20 hover:border-primary/40" },
  { icon: Globe, text: "Busca las últimas noticias sobre Bitcoin y criptomonedas", color: "border-secondary/20 hover:border-secondary/40" },
  { icon: Shield, text: "Audita este smart contract y busca vulnerabilidades de seguridad", color: "border-primary/20 hover:border-primary/40" },
  { icon: Brain, text: "Genera un thread viral para X/Twitter sobre tendencias crypto", color: "border-secondary/20 hover:border-secondary/40" },
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="relative">
          <img
            src={alienflowLogo}
            alt="AlienFlow"
            className="w-20 h-20 object-contain drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-secondary border-2 border-background animate-pulse" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-primary tracking-wider">AI Tor</h1>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">
            Sistema Operativo de IA Soberana
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Zap className="w-3 h-3 text-secondary" />
            <p className="text-[9px] text-muted-foreground/40 font-mono tracking-widest uppercase">
              ΔlieπFlΦw DAO · Versión ΓΩΣΖ v69
            </p>
            <Zap className="w-3 h-3 text-secondary" />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/50 font-mono mb-4">¿En qué puedo ayudarte hoy?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
        {QUICK_PROMPTS.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button
              key={prompt.text}
              onClick={() => onPromptClick?.(prompt.text)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border bg-card/20 backdrop-blur-sm ${prompt.color} transition-all duration-200 cursor-pointer hover:bg-card/40 hover:scale-[1.02] text-left group`}
            >
              <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center shrink-0 group-hover:border-secondary/40 transition-colors">
                <Icon className="w-4 h-4 text-muted-foreground/50 group-hover:text-secondary transition-colors" />
              </div>
              <span className="text-xs font-mono text-muted-foreground/70 group-hover:text-foreground/80 transition-colors leading-relaxed">
                {prompt.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
