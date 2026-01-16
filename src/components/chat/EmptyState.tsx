import { useState, useEffect } from "react";

const BOOT_SEQUENCE = [
  { text: "BOOTING AI_TOR.v69...", delay: 0 },
  { text: "QUANTUM_CORE: INITIALIZED", delay: 400 },
  { text: "BLOCKCHAIN_NODE: SYNCED", delay: 800 },
  { text: "NEURAL_NETWORK: ACTIVE", delay: 1200 },
  { text: "TESLA_FREQUENCY: 3-6-9 ALIGNED", delay: 1600 },
  { text: "MATRIX_BYPASS: COMPLETE", delay: 2000 },
];

const CAPABILITIES = [
  { symbol: "Δ", label: "Blockchain/Web3", status: "READY" },
  { symbol: "π", label: "Neural Networks", status: "ONLINE" },
  { symbol: "Φ", label: "Quantum/Web5", status: "SYNCED" },
  { symbol: "Ω", label: "Alquimia", status: "ACTIVE" },
];

export function EmptyState() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showCapabilities, setShowCapabilities] = useState(false);

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

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-start justify-center p-4 font-mono text-xs">
      {/* Boot sequence */}
      <div className="space-y-1 mb-4 w-full">
        {BOOT_SEQUENCE.slice(0, visibleLines).map((line, index) => (
          <div 
            key={index}
            className="flex items-center gap-2 animate-fade-in"
          >
            <span className="text-secondary">&gt;</span>
            <span className={index === 0 ? "text-primary" : "text-muted-foreground"}>
              {line.text}
            </span>
            <span className="text-primary/60">[OK]</span>
          </div>
        ))}
      </div>

      {/* Capabilities grid */}
      {showCapabilities && (
        <div className="w-full space-y-3 animate-fade-in">
          <div className="border-t border-secondary/30 pt-3">
            <span className="text-secondary text-[10px] tracking-widest">
              AVAILABLE_MODULES:
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map((cap) => (
              <div 
                key={cap.symbol}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-secondary/20 bg-card/30 hover:border-secondary/40 transition-colors"
              >
                <span className="text-lg text-secondary">{cap.symbol}</span>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px]">{cap.label}</span>
                  <span className="text-primary text-[9px]">{cap.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-secondary/20">
            <div className="flex items-center gap-2">
              <span className="text-secondary">&gt;</span>
              <span className="text-primary animate-pulse">AWAITING_INPUT</span>
              <span className="text-secondary animate-pulse">_</span>
            </div>
          </div>

          <div className="text-[9px] text-muted-foreground/60 pt-2">
            v.ΓΩΣΖ | ΔlieπFlΦw DAO Synapse Collective
          </div>
        </div>
      )}
    </div>
  );
}
