import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat, type Conversation } from "@/hooks/useChat";
import { AI_MODELS } from "@/lib/ai-models";
import { readPreferredModel, writePreferredModel, type ChatWorkspace } from "@/lib/chat-prefs";
import { track } from "@/lib/analytics";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { AgentSidebar } from "./AgentSidebar";
import { DaoCity } from "./city/DaoCity";
import { NeuralCore } from "./neural/NeuralCore";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState(readPreferredModel);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspace, setWorkspace] = useState<ChatWorkspace>("chat");
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

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    writePreferredModel(model);
  }, []);

  // One toggle drives the header button and the panel's own close controls,
  // so the drawer can always be opened and closed from either side.
  const toggleSidebar = useCallback(() => setSidebarOpen(open => !open), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleWorkspaceChange = useCallback((next: ChatWorkspace) => {
    setWorkspace(next);
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, []);

  const scrollToLatest = useCallback(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, []);

  // The app keeps a single persisted thread, so the history list mirrors the
  // session that is actually live instead of showing an empty placeholder.
  const conversations = useMemo<Conversation[]>(() => {
    if (!messages.length) return [];
    const firstUser = messages.find(message => message.role === "user");
    const title = (firstUser?.content ?? messages[0].content).replace(/\s+/g, " ").trim().slice(0, 52);
    return [{
      id: "current-session",
      title: title || "Sesión actual",
      messages,
      createdAt: messages[0].timestamp,
      updatedAt: messages[messages.length - 1].timestamp.getTime(),
    }];
  }, [messages]);

  // Conversion: the chat is the core engagement surface.
  useEffect(() => {
    track("chat_opened");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, isLoading]);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-background">
      <AgentSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onClose={closeSidebar}
        conversations={conversations}
        currentConversationId={messages.length ? "current-session" : null}
        onSelectConversation={() => {
          scrollToLatest();
          if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
        }}
        onDeleteConversation={clearChat}
        onNewConversation={handleNewChat}
        workspace={workspace}
        onWorkspaceChange={handleWorkspaceChange}
        sessionStats={{
          queries: messages.filter(message => message.role === "user").length,
          replies: messages.filter(message => message.role === "assistant" && message.content).length,
          tokens: Math.ceil(messages.reduce((total, message) => total + message.content.length, 0) / 4),
          thinking: isLoading,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
      <ChatHeader
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        onClear={clearChat}
        onNewChat={handleNewChat}
        hasMessages={messages.length > 0}
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
        workspace={workspace}
        onWorkspaceChange={handleWorkspaceChange}
      />

      {workspace === "neural" ? (
        <NeuralCore
          messages={messages}
          isLoading={isLoading}
          modelId={selectedModel}
          onChat={() => handleWorkspaceChange("chat")}
          onCity={() => handleWorkspaceChange("city")}
        />
      ) : workspace === "city" ? (
        <DaoCity
          messages={messages}
          isLoading={isLoading}
          onSend={(prompt) => sendMessage(prompt, selectedModel)}
          onChat={() => handleWorkspaceChange("chat")}
        />
      ) : <>
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
      </>}
      </div>
    </div>
  );
}
