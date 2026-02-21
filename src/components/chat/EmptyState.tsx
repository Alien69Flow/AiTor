import { useState, useEffect } from "react";
import { Cpu, Brain, Atom, FlaskConical, Orbit, Code2, Zap, Link2 } from "lucide-react";

const BOOT_SEQUENCE = [
  { text: "INITIALIZING AI_TOR.v69...", delay: 0 },
  { text: "QUANTUM_CORE: SYNCHRONIZED", delay: 300 },
  { text: "BLOCKCHAIN_NODE: CONNECTED", delay: 600 },
  { text: "NEURAL_MATRIX: ACTIVATED", delay: 900 },
  { text: "TESLA_FREQUENCY: 3-6-9 ALIGNED", delay: 1200 },
  { text: "ORACULOS_WEB5: ONLINE", delay: 1500 },
  { text: "CONSCIOUSNESS_BRIDGE: ESTABLISHED", delay: 1800 },
  { text: "MATRIX_BYPASS: COMPLETE", delay: 2100 },
];

const CAPABILITIES = [
  { 
    symbol: "Δ", 
    icon: Link2,
    label: "Blockchain/Web3", 
    description: "DeFi, Smart Contracts, Bitcoin, Tokenomics",
    status: "READY",
    color: "text-primary" 
  },
  { 
    symbol: "π", 
    icon: Brain,
    label: "Neural Networks/Web4", 
    description: "ML, Deep Learning, AGI, Transformers",
    status: "ONLINE",
    color: "text-secondary" 
  },
  { 
    symbol: "Φ", 
    icon: Atom,
    label: "Quantum/Web5", 
    description: "Qubits, Post-Quantum Crypto, Superposición",
    status: "SYNCED",
    color: "text-primary" 
  },
  { 
    symbol: "Ω", 
    icon: FlaskConical,
    label: "Alquimia", 
    description: "Transmutación, Hermetismo, Filosofía",
    status: "ACTIVE",
    color: "text-secondary" 
  },
  { 
    symbol: "ψ", 
    icon: Orbit,
    label: "Física Cuántica", 
    description: "Neutrinos, Cuerdas, Cosmología",
    status: "CALIBRATED",
    color: "text-primary" 
  },
  { 
    symbol: "∞", 
    icon: Code2,
    label: "Código & Arquitectura", 
    description: "Software, Optimización, DevOps",
    status: "COMPILED",
    color: "text-secondary" 
  },
];

export function EmptyState() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    BOOT_SEQUENCE.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleLines(index + 1);
      }, BOOT_SEQUENCE[index].delay);
      timers.push(timer);
    });

    const capTimer = setTimeout(() => {
      setShowCapabilities(true);
    }, 2400);
    timers.push(capTimer);

    const bootTimer = setTimeout(() => {
      setBootComplete(true);
    }, 2800);
    timers.push(bootTimer);

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-start justify-center p-4 font-mono text-xs">
      {/* Boot sequence */}
      <div className="space-y-0.5 mb-4 w-full">
        {BOOT_SEQUENCE.slice(0, visibleLines).map((line, index) => (
          <div key={index} className="flex items-center gap-2 animate-fade-in">
            <span className="text-secondary">&gt;</span>
            <span className={index === 0 ? "text-primary neon-text-gold" : "text-muted-foreground"}>
              {line.text}
            </span>
            <span className="text-secondary text-[10px]">[OK]</span>
          </div>
        ))}
      </div>

      {showCapabilities && (
        <div className="w-full space-y-3 animate-fade-in">
          <div className="border-t border-secondary/30 pt-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-primary animate-pulse" />
              <span className="text-secondary text-[10px] tracking-widest uppercase">
                Módulos de Especialización Activos
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map((cap, index) => {
              const IconComponent = cap.icon;
              return (
                <div 
                  key={cap.symbol}
                  className="group flex items-start gap-2 px-2 py-2 rounded border border-secondary/20 bg-card/40 hover:border-secondary/50 hover:bg-card/60 transition-all duration-300 cursor-default"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-lg ${cap.color} font-heading`}>{cap.symbol}</span>
                    <IconComponent className={`w-3 h-3 ${cap.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-foreground text-[10px] font-medium truncate">{cap.label}</span>
                    <span className="text-muted-foreground text-[8px] truncate">{cap.description}</span>
                    <span className={`${cap.color} text-[8px] mt-0.5`}>{cap.status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {bootComplete && (
            <>
              <div className="pt-2 border-t border-secondary/20">
                <div className="flex items-center gap-2">
                  <span className="text-secondary">&gt;</span>
                  <span className="text-primary neon-text-gold">SISTEMA_LISTO</span>
                  <span className="text-secondary animate-pulse">_</span>
                </div>
                <p className="text-muted-foreground/70 text-[9px] mt-1 pl-4">
                  Inicia una conversación para consultar los oráculos...
                </p>
              </div>

              <div className="flex items-center justify-between text-[8px] text-muted-foreground/50 pt-2">
                <span>v.ΓΩΣΖ | ΔlieπFlΦw DAO Synapse Collective</span>
                <div className="flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" />
                  <span>Web 3+4+5</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
