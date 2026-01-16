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
  }, [messages]);

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none z-10">
        <div className="pointer-events-auto flex flex-col w-full max-w-[450px] max-h-[70vh] 
                        bg-card/80 backdrop-blur-xl rounded-lg border border-secondary/50
                        shadow-[0_0_30px_rgba(180,160,100,0.2)] terminal-glow">
          {/* Terminal Header */}
          <div className="border-b border-secondary/30">
            <ChatHeader
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onClear={clearChat}
              hasMessages={messages.length > 0}
            />
          </div>
          
          {/* Messages Area */}
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="px-4">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <ThinkingIndicator />
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t border-secondary/30 p-2">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              supportsVision={supportsVision}
            />
          </div>
        </div>
      </div>
    </>
  );
}
