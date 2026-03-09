import { useState, useEffect } from "react";
import { Globe, GitBranch } from "lucide-react";
import alienflowLogo from "@/assets/alienflow-logo.png";

const THINKING_PHASES = [
  "Procesando consulta...",
  "Analizando contexto...",
  "Generando respuesta...",
  "Sintetizando datos...",
];

interface ThinkingIndicatorProps {
  isSearching?: boolean;
  isAnalyzingRepo?: boolean;
}

export function ThinkingIndicator({ isSearching, isAnalyzingRepo }: ThinkingIndicatorProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => (prev + 1) % THINKING_PHASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full py-5 px-4 md:px-6 bg-card/30">
      <div className="max-w-3xl mx-auto flex gap-4">
        <div className="w-7 h-7 rounded-lg border border-secondary/30 overflow-hidden bg-card/60 flex items-center justify-center shrink-0 mt-1">
          <img src={alienflowLogo} alt="AI Tor" className="w-6 h-6 object-contain animate-pulse" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-mono font-bold text-foreground/80">AI Tor</span>
          <div className="flex items-center gap-2">
            {isSearching ? (
              <>
                <Globe className="w-3.5 h-3.5 text-secondary animate-spin" />
                <span className="text-[10px] font-mono text-muted-foreground/50">Buscando en la web...</span>
              </>
            ) : (
              <>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/50">{THINKING_PHASES[phase]}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
