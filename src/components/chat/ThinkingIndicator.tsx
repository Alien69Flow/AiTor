import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const THINKING_MESSAGES = [
  "Sincronizando con el nodo de Neutrinos",
  "Aplicando lógica Tesla 3-6-9",
  "Decodificando señal desde el Portal",
  "Estabilizando entropía de respuesta",
  "Bypass de la Matrix completado",
  "Analizando flujos magnéticos",
  "Decodificando secuencia Φπ",
  "Calibrando frecuencia cuántica",
  "Accediendo al campo unificado",
  "Triangulando coordenadas dimensionales",
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

  const currentMessage = THINKING_MESSAGES[messageIndex];

  // Spinner animation
  useEffect(() => {
    const spinInterval = setInterval(() => {
      setSpinnerIndex(prev => (prev + 1) % SPINNER_CHARS.length);
    }, 100);
    return () => clearInterval(spinInterval);
  }, []);

  // Fake bytes counter
  useEffect(() => {
    const byteInterval = setInterval(() => {
      setBytes(prev => prev + Math.floor(Math.random() * 1024));
    }, 150);
    return () => clearInterval(byteInterval);
  }, []);

  // Typing effect
  useEffect(() => {
    setDisplayedText("");
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentMessage.length) {
        setDisplayedText(currentMessage.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 25);

    return () => clearInterval(typeInterval);
  }, [currentMessage]);

  // Change message every 2.5 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => {
        setMessageIndex(prev => (prev + 1) % THINKING_MESSAGES.length);
        setIsGlitching(false);
      }, 150);
    }, 2500);

    return () => clearInterval(messageInterval);
  }, []);

  return (
    <div className="px-3 py-2 font-mono text-xs border-t border-secondary/20 bg-card/40">
      <div className="flex items-center gap-2">
        {/* Spinner */}
        <span className="text-secondary text-sm">
          {SPINNER_CHARS[spinnerIndex]}
        </span>
        
        {/* Thinking text */}
        <span 
          className={cn(
            "text-secondary/80 transition-all duration-100",
            isGlitching && "thinking-glitch opacity-60"
          )}
        >
          <span className="text-primary/60 mr-1">&gt;</span>
          {displayedText}
          <span className="animate-pulse">...</span>
        </span>
      </div>
      
      {/* Bytes processed */}
      <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/50">
        <span>PROCESSING: {bytes.toLocaleString()} bytes</span>
        <div className="flex-1 h-px bg-secondary/20 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-secondary/40 via-primary/40 to-secondary/40 animate-[shimmer_1s_ease-in-out_infinite]"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
