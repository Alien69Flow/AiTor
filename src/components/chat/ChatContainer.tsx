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
import { Maximize2, Minimize2, AlertTriangle } from "lucide-react";
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // AJUSTE DE DISEÑO: La versión "mini" ahora es más seria (600px y 85vh)
  const containerClasses = isFullscreen
    ? "fixed inset-4 sm:inset-8 flex flex-col"
    : "relative flex flex-col w-full max-w-[650px] h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.5)]";

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 pointer-events-none z-10">
        <div className={`pointer-events-auto ${containerClasses} glass-dark rounded-none border border-primary/20 overflow-hidden terminal-glow scanlines transition-all duration-300`}>
          
          {/* HUD Corners - Estilo Tesla */}
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-primary/40 z-20" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-primary/40 z-20" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-secondary/40 z-20" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-secondary/40 z-20" />
          
          {/* Corner symbols */}
          <div className="absolute top-1.5 left-2 text-primary/40 font-heading text-[10px] z-20">Δ</div>
          <div className="absolute top-1.5 right-2 text-primary/40 font-heading text-[10px] z-20">Ω</div>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-2 right-10 h-6 w-6 text-muted-foreground/50 hover:text-primary z-30"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          
          <div className="bg-black/40 border-b border-white/5">
            <ChatHeader
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onClear={clearChat}
              hasMessages={messages.length > 0}
            />
          </div>
          
          <ScrollArea className="flex-1 min-h-0 relative z-0" ref={scrollRef}>
            <div className="p-4">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="divide-y divide-secondary/5">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                </div>
              )}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <ThinkingIndicator />
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-black/60 border-t border-white/5">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              supportsVision={supportsVision}
            />
            {/* Tesla Freq Indicator */}
            <div className="mt-2 flex justify-center text-[7px] text-primary/30 tracking-[0.5em] font-mono">
              CORE_V.69 // 3-6-9_SINC
            </div>
          </div>

          {/* Disclaimer footer */}
          <div className="px-2 py-1 bg-card/50 z-10 border-t border-white/5">
            <div className="flex items-start gap-1.5 text-[7px] text-muted-foreground/40 font-mono">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
              <span>AI TOR.v69: VERIFICA_DATOS_CUÁNTICOS.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
