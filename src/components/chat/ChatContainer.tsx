import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { AI_MODELS } from "@/lib/ai-models";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { AgentSidebar } from "./AgentSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const supportsVision = currentModel?.supportsVision ?? false;

  const handleSend = (content: string, imageData?: string) => {
    sendMessage(content, selectedModel, imageData);
  };

  const handleNewChat = () => {
    clearChat();
  };

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ChatHeader
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onClear={clearChat}
        onNewChat={handleNewChat}
        hasMessages={messages.length > 0}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        {messages.length === 0 ? (
          <EmptyState onPromptClick={(prompt) => handleSend(prompt)} />
        ) : (
          <div className="flex flex-col">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <ThinkingIndicator />}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border bg-background/80 backdrop-blur-sm">
        <ChatInput onSend={handleSend} isLoading={isLoading} supportsVision={supportsVision} />
      </div>
    </div>
  );
}
