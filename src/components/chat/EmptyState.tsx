import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Code2, Globe, Shield, Atom, Link2, Search, ArrowRight, Github, Radio } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import alienflowLogo from "@/assets/alienflow-logo.png";

const CAPABILITIES = [
  { icon: Search, title: "Búsqueda Web", desc: "Información en tiempo real con Firecrawl", prompt: "Busca en la web: últimas noticias sobre crypto y DeFi" },
  { icon: TrendingUp, title: "DeFi & Trading", desc: "Análisis de mercados y estrategias", prompt: "Analiza el mercado DeFi actual y dame oportunidades" },
  { icon: Shield, title: "Auditoría Smart Contracts", desc: "Seguridad y vulnerabilidades", prompt: "Audita un smart contract ERC-20 buscando vulnerabilidades" },
  { icon: Code2, title: "Código & Arquitectura", desc: "Genera, analiza y refactoriza", prompt: "Genera un smart contract en Solidity para un token ERC-20" },
  { icon: Github, title: "GitHub & Repos", desc: "Analiza y trabaja con repositorios", prompt: "Analiza el repositorio de GitHub: " },
  { icon: Link2, title: "Web3 & DAO", desc: "Gobernanza, NFTs y protocolos", prompt: "Diseña la arquitectura de una DAO con gobernanza on-chain" },
];

const SUGGESTIONS = [
  "Busca en la web: precio de Bitcoin hoy",
  "Genera un thread viral para RRSS",
  "Compara Bitcoin vs Ethereum",
  "Crea una estrategia de yield farming",
];

const TAGLINE = "El oráculo que ve más allá del mercado. Inteligencia que converge donde otros no miran.";
const TAGLINE_SHORT = "Inteligencia que converge donde otros no miran.";

const PROVIDERS = ["Gemini", "GPT-5", "Grok", "Claude", "ChainGPT", "Chainlink", "DeepSeek"];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

function TypingTagline({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 animate-pulse align-middle" />}
    </span>
  );
}

function Starfield() {
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-primary/20 animate-pulse"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < 500);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visibleCapabilities = isCompact ? CAPABILITIES.slice(0, 4) : CAPABILITIES;

  return (
<div className={`flex flex-1 flex-col items-center justify-center min-h-[60vh] relative w-full overflow-x-hidden ${isCompact ? "p-3" : "p-4 sm:p-6"}`}>      <Starfield />

      {/* Hero Branding */}
      <div className={`flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10 ${isCompact ? "mb-6" : "mb-10"}`}>
        <div className="relative">
          {!isCompact && (
            <>
              <div className="absolute inset-0 w-32 h-32 -m-6 rounded-full border border-primary/5 animate-ping" style={{ animationDuration: '4s' }} />
              <div className="absolute inset-0 w-28 h-28 -m-4 rounded-full border border-primary/8 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
              <div className="absolute inset-0 w-24 h-24 -m-2 rounded-full border border-primary/10 animate-[magnetic-pulse_4s_ease-in-out_infinite]" />
              <div className="absolute inset-0 w-28 h-28 -m-4 rounded-full bg-primary/5 blur-3xl animate-pulse" />
            </>
          )}
          <img
            src={alienflowLogo}
            alt="AlienFlow"
            className={`object-contain relative z-10 drop-shadow-[0_0_40px_hsl(var(--primary)/0.5)] ${isCompact ? "w-12 h-12" : "w-20 h-20"}`}
          />
        </div>
        <div className="text-center">
          <h1 className={`font-heading font-bold text-foreground tracking-wider neon-text-green ${isCompact ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
            AI Tor
          </h1>
          <p className={`text-muted-foreground/70 mt-1.5 max-w-md font-mono leading-relaxed ${isCompact ? "text-[11px]" : "text-sm sm:text-base mt-2"}`}>
            <TypingTagline text={isCompact ? TAGLINE_SHORT : TAGLINE} />
          </p>
          {/* Stats strip */}
          <div className={`flex items-center justify-center gap-4 ${isCompact ? "mt-2" : "mt-4"}`}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[9px] text-muted-foreground/50 font-mono">12 Oracles</span>
            </div>
            <div className="w-px h-3 bg-border/30" />
            <div className="flex items-center gap-1.5">
              <Radio className="w-2.5 h-2.5 text-primary/50" />
              <span className="text-[9px] text-muted-foreground/50 font-mono">3 Data Sources</span>
            </div>
            {!isCompact && (
              <>
                <div className="w-px h-3 bg-border/30" />
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] text-muted-foreground/50 font-mono">Real-time</span>
                </div>
              </>
            )}
          </div>
          {!isCompact && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-[10px] text-muted-foreground/40 font-heading tracking-[0.2em] uppercase">
                ΔlieπFlΦw DAO · Multi-Oracle System
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Capability Cards */}
      <div className={`grid gap-2.5 w-full mb-6 relative z-10 ${
        isCompact ? "grid-cols-1 max-w-sm" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mb-8"
      }`}>
        {visibleCapabilities.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <button
              key={cap.title}
              onClick={() => onPromptClick?.(cap.prompt)}
              className={`relative flex items-start gap-3 rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm hover:bg-card/60 hover:border-secondary/50 hover:shadow-[0_0_30px_hsl(var(--secondary)/0.12)] transition-all duration-300 text-left group animate-in fade-in slide-in-from-bottom-3 overflow-hidden ${
                isCompact ? "p-3 gap-2.5" : "p-4"
              }`}
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
            >
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
              <div className={`rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center shrink-0 group-hover:border-secondary/50 group-hover:bg-secondary/10 group-hover:shadow-[0_0_15px_hsl(var(--secondary)/0.15)] transition-all duration-300 relative z-10 ${
                isCompact ? "w-8 h-8" : "w-9 h-9"
              }`}>
                <Icon className="w-4 h-4 text-muted-foreground/60 group-hover:text-secondary transition-colors" />
              </div>
              <div className="flex flex-col min-w-0 relative z-10">
                <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">{cap.title}</span>
                {!isCompact && <span className="text-[10px] text-muted-foreground/50 leading-relaxed mt-0.5">{cap.desc}</span>}
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-secondary/60 group-hover:translate-x-0.5 shrink-0 mt-1 transition-all duration-300 relative z-10" />
            </button>
          );
        })}
      </div>

      {/* Quick Suggestions */}
      <div className={`flex gap-2 justify-center max-w-2xl animate-in fade-in duration-1000 mb-6 relative z-10 ${
        isCompact ? "overflow-x-auto no-scrollbar w-full" : "flex-wrap"
      }`} style={{ animationDelay: "600ms", animationFillMode: "both" }}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPromptClick?.(suggestion)}
            className="px-3.5 py-2 rounded-full border border-border/60 bg-card/20 hover:bg-card/50 hover:border-secondary/40 text-xs text-muted-foreground/60 hover:text-foreground/80 transition-all cursor-pointer hover:shadow-[0_0_20px_hsl(var(--secondary)/0.08)] whitespace-nowrap shrink-0"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Powered by marquee - hidden in compact */}
      {!isCompact && (
        <div className="w-full max-w-md overflow-hidden animate-in fade-in duration-1000 relative z-10" style={{ animationDelay: "800ms", animationFillMode: "both" }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[8px] font-heading tracking-[0.3em] text-muted-foreground/30 uppercase">Powered by</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>
          <div className="relative overflow-hidden h-5">
            <div className="flex gap-6 animate-ticker whitespace-nowrap">
              {[...PROVIDERS, ...PROVIDERS].map((name, i) => (
                <span key={i} className="text-[9px] font-mono text-muted-foreground/25 tracking-wider">{name}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
