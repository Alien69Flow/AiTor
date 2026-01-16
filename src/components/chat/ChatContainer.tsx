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

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
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

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none z-10">
        <div className="pointer-events-auto relative flex flex-col w-full max-w-[450px] max-h-[70vh] bg-card/85 backdrop-blur-xl rounded-lg border border-secondary/40 shadow-[0_0_40px_rgba(0,200,100,0.15)] overflow-hidden terminal-glow">
          
          {/* Scanlines overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(142_70%_45%/0.1)_2px,hsl(142_70%_45%/0.1)_4px)] z-10" />
          
          {/* Corner symbols */}
          <div className="absolute top-1 left-2 text-secondary/20 font-mono text-[10px] z-20">Δ</div>
          <div className="absolute top-1 right-2 text-secondary/20 font-mono text-[10px] z-20">Ω</div>
          <div className="absolute bottom-1 left-2 text-secondary/20 font-mono text-[10px] z-20">Φ</div>
          <div className="absolute bottom-1 right-2 text-secondary/20 font-mono text-[10px] z-20">π</div>
          
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
        </div>
      </div>
    </>
  );
}
