import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Atom, Brain, Link2, Zap } from "lucide-react";

const THINKING_MESSAGES = [
  { text: "Sincronizando con el flujo de neutrinos...", icon: Atom },
  { text: "Transmutando bloques de datos en conocimiento...", icon: Link2 },
  { text: "Consultando el Oráculo de Chainlink para la verdad on-chain...", icon: Link2 },
  { text: "Alineando bobinas de Tesla para la transmisión de datos...", icon: Zap },
  { text: "Decodificando la frecuencia Φπ del campo unificado...", icon: Atom },
  { text: "Triangulando coordenadas en el tejido espacio-temporal...", icon: Brain },
  { text: "Accediendo a los registros akáshicos de la blockchain...", icon: Link2 },
  { text: "Calibrando resonancia Schumann para respuesta óptima...", icon: Zap },
  { text: "Procesando información a través del vórtice cuántico...", icon: Atom },
  { text: "Sincronizando con la matriz de consciencia colectiva...", icon: Brain },
  { text: "Aplicando transformación hermética de datos...", icon: Zap },
  { text: "Estabilizando flujo de entropía neural...", icon: Brain },
  { text: "Convergiendo redes de conocimiento distribuido...", icon: Link2 },
  { text: "Activando protocolo de transmutación alquímica...", icon: Atom },
];

const SPINNER_CHARS = ["◐", "◓", "◑", "◒"];

export function ThinkingIndicator() {
  const [messageIndex, setMessageIndex] = useState(() => 
    Math.floor(Math.random() * THINKING_MESSAGES.length)
  );
  const [displayedText, setDisplayedText] = useState("");
  const [isGlitching, setIsGlitching] = useState(false);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [quantumState, setQuantumState] = useState(0);

  const currentMessage = THINKING_MESSAGES[messageIndex];
  const IconComponent = currentMessage.icon;

  // Spinner animation
  useEffect(() => {
    const spinInterval = setInterval(() => {
      setSpinnerIndex(prev => (prev + 1) % SPINNER_CHARS.length);
    }, 80);
    return () => clearInterval(spinInterval);
  }, []);

  // Fake bytes counter
  useEffect(() => {
    const byteInterval = setInterval(() => {
      setBytes(prev => prev + Math.floor(Math.random() * 2048));
    }, 120);
    return () => clearInterval(byteInterval);
  }, []);

  // Quantum state fluctuation
  useEffect(() => {
    const quantumInterval = setInterval(() => {
      setQuantumState(Math.random() * 100);
    }, 500);
    return () => clearInterval(quantumInterval);
  }, []);

  // Typing effect
  useEffect(() => {
    setDisplayedText("");
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentMessage.text.length) {
        setDisplayedText(currentMessage.text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 20);

    return () => clearInterval(typeInterval);
  }, [currentMessage.text]);

  // Change message every 3 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => {
        setMessageIndex(prev => (prev + 1) % THINKING_MESSAGES.length);
        setIsGlitching(false);
      }, 150);
    }, 3000);

    return () => clearInterval(messageInterval);
  }, []);

  return (
    <div className="px-3 py-2 font-mono text-xs border-t border-secondary/30 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        {/* Spinner with icon */}
        <div className="flex items-center gap-1.5">
          <span className="text-primary text-sm">
            {SPINNER_CHARS[spinnerIndex]}
          </span>
          <IconComponent className="w-3 h-3 text-secondary animate-pulse" />
        </div>
        
        {/* Thinking text */}
        <span 
          className={cn(
            "text-secondary/90 transition-all duration-100 flex-1",
            isGlitching && "thinking-glitch opacity-60"
          )}
        >
          <span className="text-primary/70 mr-1">&gt;</span>
          {displayedText}
          <span className="animate-pulse text-primary">...</span>
        </span>
      </div>
      
      {/* Processing stats */}
      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="text-secondary">BYTES:</span>
          <span>{bytes.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-primary">QUANTUM:</span>
          <span>{quantumState.toFixed(1)}%</span>
        </span>
        <div className="flex-1 h-px bg-secondary/20 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-secondary/50 via-primary/50 to-secondary/50 animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
