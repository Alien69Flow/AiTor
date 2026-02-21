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
import { Maximize2, Minimize2, AlertTriangle, ShieldAlert } from "lucide-react";
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
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages, isLoading]);

  // CONTAINER DEFINITIVO: Máxima optimización de espacio para dApp
  const containerClasses = isFullscreen
    ? "fixed inset-2 sm:inset-4 flex flex-col z-50"
    : "relative flex flex-col w-full max-w-[850px] h-[85vh] shadow-[0_0_60px_-15px_rgba(var(--primary-rgb),0.3)]";

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-6 pointer-events-none z-10">
        <div className={`pointer-events-auto ${containerClasses} glass-dark rounded-xl border border-secondary/30 overflow-hidden terminal-glow scanlines transition-all duration-500`}>
          
          {/* HUD Decorative Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-primary/30 rounded-tl-xl z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-primary/30 rounded-tr-xl z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-secondary/30 rounded-bl-xl z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-secondary/30 rounded-br-xl z-20 pointer-events-none" />
          
          {/* Corner Metadata Symbols */}
          <div className="absolute top-2 left-3 text-primary/40 font-heading text-[10px] z-20 select-none hidden sm:block">SYNP_v69</div>
          <div className="absolute bottom-12 right-3 text-secondary/30 font-heading text-[10px] z-20 select-none rotate-90 origin-right">ΔLIEπFLΦW</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-2.5 right-12 h-6 w-6 text-muted-foreground/40 hover:text-primary transition-colors z-30"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          
          <ChatHeader
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onClear={clearChat}
            hasMessages={messages.length > 0}
          />
          
          <ScrollArea className="flex-1 min-h-0 relative z-0 bg-black/5" ref={scrollRef}>
            <div className="max-w-3xl mx-auto w-full">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex flex-col py-6 px-4 gap-1">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                </div>
              )}
              {isLoading && (
                <div className="px-6 py-4">
                  <ThinkingIndicator />
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="bg-card/40 backdrop-blur-xl border-t border-secondary/20 relative z-10">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              supportsVision={supportsVision}
            />

            {/* --- DISCLAIMER FOOTER ACTUALIZADO Y MEJORADO --- */}
            <div className="px-4 py-2 border-t border-secondary/10 bg-black/40">
              <div className="flex items-start gap-2 max-w-2xl mx-auto">
                <ShieldAlert className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0 animate-pulse" />
                <p className="text-[8px] leading-relaxed text-muted-foreground/50 font-mono uppercase tracking-wider">
                  <span className="text-primary/70 font-bold">Protocolo de Seguridad:</span> AI Tor puede cometer errores. Verifica la información de forma independiente. Para consultas <span className="text-secondary/70">financieras, legales o médicas</span>, consulta siempre con profesionales cualificados. Datos encriptados y protegidos por ΔlieπFlΦw DAO.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
