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
import { SpaceBackground } from "@/components/SpaceBackground";
import { AlertTriangle, Shield } from "lucide-react";

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const supportsVision = currentModel?.supportsVision ?? false;
  const supportsImageGen = currentModel?.supportsImageGen ?? false;

  const handleSend = (content: string, imageData?: string) => {
    sendMessage(content, selectedModel, imageData);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center z-10 overflow-hidden">
        <div className="relative flex w-[95vw] max-w-5xl h-[92vh] glass-dark border border-border/20 rounded-lg shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-500">

          {/* HUD Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l border-t border-primary/20 z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r border-t border-primary/20 z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l border-b border-secondary/20 z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r border-b border-secondary/20 z-20 pointer-events-none" />

          {/* Sidebar */}
          <AgentSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="bg-card/30 backdrop-blur-md border-b border-border/10">
              <ChatHeader
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                onClear={clearChat}
                hasMessages={messages.length > 0}
              />
            </div>

            {/* Messages */}
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

            {/* Input & Footer */}
            <div className="p-4 bg-card/20 backdrop-blur-xl border-t border-border/10">
              <ChatInput
                onSend={handleSend}
                isLoading={isLoading}
                supportsVision={supportsVision}
                supportsImageGen={supportsImageGen}
              />

              <div className="mt-3 flex justify-center items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                <span className="text-[7px] text-primary/25 tracking-[0.5em] font-mono whitespace-nowrap uppercase">
                  Frequency 3-6-9 Sync
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
              </div>
            </div>

            {/* Disclaimer */}
            <div className="px-3 py-1.5 bg-background/90 border-t border-border/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[7px] text-muted-foreground/40 font-mono">
                <AlertTriangle className="w-2.5 h-2.5 text-primary/30" />
                <span className="uppercase tracking-widest hidden sm:inline">Aitor.v69 // Protocolo de verificación activo</span>
              </div>
              <div className="flex items-center gap-1.5 text-[7px] text-muted-foreground/30 font-mono">
                <Shield className="w-2.5 h-2.5" />
                <span>DAO_ENCRYPTED_v2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
