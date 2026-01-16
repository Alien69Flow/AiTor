import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const THINKING_MESSAGES = [
  "Sincronizando con el nodo de Neutrinos...",
  "Aplicando lógica Tesla 3-6-9 a la consulta...",
  "Decodificando señal desde el Portal...",
  "Estabilizando entropía de la respuesta...",
  "Bypass de la Matrix completado. Generando realidad...",
  "Analizando flujos magnéticos...",
  "Decodificando secuencia Φπ...",
  "Conectando con la consciencia colectiva...",
  "Calibrando frecuencia de respuesta...",
  "Accediendo al campo cuántico...",
  "Triangulando coordenadas dimensionales...",
  "Procesando ondas de probabilidad...",
];

export function ThinkingIndicator() {
  const [messageIndex, setMessageIndex] = useState(() => 
    Math.floor(Math.random() * THINKING_MESSAGES.length)
  );
  const [displayedText, setDisplayedText] = useState("");
  const [isGlitching, setIsGlitching] = useState(false);

  const currentMessage = THINKING_MESSAGES[messageIndex];

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
    }, 30);

    return () => clearInterval(typeInterval);
  }, [currentMessage]);

  // Change message every 3 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => {
        setMessageIndex(prev => (prev + 1) % THINKING_MESSAGES.length);
        setIsGlitching(false);
      }, 200);
    }, 3000);

    return () => clearInterval(messageInterval);
  }, []);

  return (
    <div className="flex gap-3 py-4">
      <div className="bg-card/60 backdrop-blur-sm rounded-lg px-4 py-3 border border-secondary/30">
        <div className="flex items-center gap-3">
          {/* Pulsing orb */}
          <div className="relative">
            <div className="h-3 w-3 rounded-full bg-secondary animate-pulse" />
            <div className="absolute inset-0 h-3 w-3 rounded-full bg-secondary/50 animate-ping" />
          </div>
          
          {/* Thinking text */}
          <span 
            className={cn(
              "font-mono text-sm text-secondary transition-all duration-200",
              isGlitching && "opacity-50 translate-x-0.5"
            )}
          >
            <span className="text-primary mr-1">&gt;</span>
            {displayedText}
            <span className="animate-pulse">_</span>
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-secondary via-primary to-secondary animate-[shimmer_2s_ease-in-out_infinite]"
            style={{ width: '60%' }}
          />
        </div>
      </div>
    </div>
  );
}
