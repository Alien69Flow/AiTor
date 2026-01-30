import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { AI_MODELS } from "@/lib/ai-models";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpaceBackground } from "@/components/SpaceBackground";
import { Maximize2, Minimize2, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const supportsVision = currentModel?.supportsVision ?? false;

  const handleSend = (content: string, imageData?: string) => {
    sendMessage(content, selectedModel, imageData);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const containerClasses = isFullscreen
    ? "relative flex flex-col w-[95vw] h-[92vh] shadow-[0_0_60px_rgba(0,0,0,0.9)]"
    : "relative flex flex-col w-full max-w-[680px] h-[82vh] shadow-2xl";

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-10 overflow-hidden">
        <div className={`${containerClasses} glass-dark border border-white/10 rounded-sm transition-all duration-500 ease-in-out overflow-hidden`}>
          
          {/* HUD DE SEGURIDAD Y TESLA */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l border-t border-primary/30 z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r border-t border-primary/30 z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l border-b border-secondary/30 z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r border-b border-secondary/30 z-20 pointer-events-none" />
          
          {/* Símbolos Alquímicos */}
          <div className="absolute top-1.5 left-2 text-[10px] text-primary/40 font-mono z-20">Δ</div>
          <div className="absolute top-1.5 right-2 text-[10px] text-primary/40 font-mono z-20">Ω</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-2.5 right-12 h-6 w-6 text-muted-foreground/40 hover:text-primary z-30 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          
          <div className="bg-black/30 backdrop-blur-md border-b border-white/5">
            <ChatHeader
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onClear={clearChat}
              hasMessages={messages.length > 0}
            />
          </div>
          
          <ScrollArea className="flex-1 bg-transparent" ref={scrollRef}>
            <div className="p-4 max-w-3xl mx-auto w-full">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-1">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                </div>
              )}
              {isLoading && (
                <div className="py-4">
                  <ThinkingIndicator />
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* INPUT Y FOOTER */}
          <div className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/5">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              supportsVision={supportsVision}
            />
            
            {/* Tesla Freq Footer */}
            <div className="mt-3 flex justify-center items-center gap-4">
               <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
               <span className="text-[7px] text-primary/30 tracking-[0.6em] font-mono whitespace-nowrap uppercase">
                 Frequency 3-6-9 Sync
               </span>
               <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
            </div>
          </div>

          {/* DISCLAIMER */}
          <div className="px-3 py-2 bg-black/95 z-10 border-t border-primary/10 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[7px] text-muted-foreground/40 font-mono">
                <AlertTriangle className="w-3 h-3 text-secondary/40" />
                <span className="uppercase tracking-widest">Aitor.v69 // Protocolo de verificación cuántica activo</span>
              </div>
              <div className="flex items-center gap-2 text-[7px] text-primary/30 font-mono">
                <Shield className="w-2.5 h-2.5" />
                <span>DAO_ENCRYPTED</span>
              </div>
            </div>
            
            <p className="text-[6px] leading-relaxed text-muted-foreground/30 font-mono uppercase text-center mt-1 border-t border-white/5 pt-1">
              Atención: Ai Tor puede generar información inexacta. No constituye asesoramiento financiero, legal o médico. 
              Contraste toda la información antes de tomar decisiones importantes. 
              Frecuencia de error inherente al procesamiento neuronal.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
