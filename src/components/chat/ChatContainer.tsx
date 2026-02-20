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

  const containerClasses = isFullscreen
    ? "fixed inset-4 sm:inset-8 flex flex-col"
    : "relative flex flex-col w-full max-w-[480px] max-h-[75vh]";

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 pointer-events-none z-10">
        <div className={`pointer-events-auto ${containerClasses} glass-dark rounded-lg border border-secondary/40 overflow-hidden terminal-glow scanlines`}>
          
          {/* HUD Corners */}
          <div className="absolute top-0 left-0 w-5 h-5 border-l-2 border-t-2 border-secondary/50 rounded-tl-lg z-20" />
          <div className="absolute top-0 right-0 w-5 h-5 border-r-2 border-t-2 border-secondary/50 rounded-tr-lg z-20" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-l-2 border-b-2 border-secondary/50 rounded-bl-lg z-20" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-r-2 border-b-2 border-secondary/50 rounded-br-lg z-20" />
          
          {/* Corner symbols */}
          <div className="absolute top-2 left-3 text-primary/30 font-heading text-[10px] z-20">Δ</div>
          <div className="absolute top-2 right-3 text-primary/30 font-heading text-[10px] z-20">Ω</div>
          <div className="absolute bottom-7 left-3 text-secondary/30 font-heading text-[10px] z-20">Φ</div>
          <div className="absolute bottom-7 right-3 text-secondary/30 font-heading text-[10px] z-20">π</div>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-2 right-10 h-6 w-6 text-muted-foreground/50 hover:text-primary z-30"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          
          <ChatHeader
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onClear={clearChat}
            hasMessages={messages.length > 0}
          />
          
          <ScrollArea className="flex-1 min-h-0 relative z-0" ref={scrollRef}>
            <div>
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="divide-y divide-secondary/10">
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
          
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            supportsVision={supportsVision}
          />

          {/* Disclaimer footer */}
          <div className="px-2 py-1 border-t border-secondary/20 bg-card/30 z-10">
            <div className="flex items-start gap-1.5 text-[7px] text-muted-foreground/40">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
              <span>
                AI Tor puede cometer errores. Verifica la información. Para consultas médicas o financieras, consulta con profesionales cualificados.
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
