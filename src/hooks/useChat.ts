import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

const CHAT_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat`;
const SEARCH_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/firecrawl-search`;
const STORAGE_KEY = "aitor_chat_memory";
const CONVERSATIONS_KEY = "aitor_conversations";
const SEARCH_PREFIX = "Busca en la web: ";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadFromStorage(CONVERSATIONS_KEY, []));
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Persist conversations list
  useEffect(() => { saveToStorage(CONVERSATIONS_KEY, conversations); }, [conversations]);

  // Persist messages for current conversation
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      saveToStorage(`${STORAGE_KEY}_${currentConversationId}`, messages);
      setConversations(prev => prev.map(c =>
        c.id === currentConversationId ? { ...c, updatedAt: Date.now() } : c
      ));
    }
  }, [messages, currentConversationId]);

  const startNewConversation = useCallback(() => {
    const id = crypto.randomUUID();
    setCurrentConversationId(id);
    setMessages([]);
    return id;
  }, []);

  const loadConversation = useCallback((id: string) => {
    const saved = loadFromStorage<Message[]>(`${STORAGE_KEY}_${id}`, []);
    setCurrentConversationId(id);
    setMessages(saved.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    try { localStorage.removeItem(`${STORAGE_KEY}_${id}`); } catch {}
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [currentConversationId]);

  const performWebSearch = async (query: string): Promise<string | null> => {
    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, options: { limit: 5, lang: "es" } }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const results = data?.data || [];

      if (results.length === 0) return null;

      return results.map((r: any, i: number) =>
        `[${i + 1}] ${r.title || "Sin título"}\nURL: ${r.url || ""}\n${r.description || ""}\n${r.markdown ? r.markdown.slice(0, 500) : ""}`
      ).join("\n\n---\n\n");
    } catch (e) {
      console.error("Web search error:", e);
      return null;
    }
  };

  const sendMessage = useCallback(async (content: string, model: string, imageData?: string) => {
    // Ensure conversation exists
    let convId = currentConversationId;
    if (!convId) {
      convId = crypto.randomUUID();
      setCurrentConversationId(convId);
      const title = content.replace(/^\[DEEP THINK\]\s*/, "").replace(/^Busca en la web:\s*/i, "").slice(0, 50) || "Nueva conversación";
      setConversations(prev => [{ id: convId!, title, updatedAt: Date.now() }, ...prev]);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      imageData,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = "";
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        }];
      });
    };

    try {
      // Check for web search prefix
      let finalContent = content;
      const isSearch = content.toLowerCase().startsWith(SEARCH_PREFIX.toLowerCase());

      if (isSearch) {
        const searchQuery = content.slice(SEARCH_PREFIX.length).trim();
        setIsSearching(true);
        const searchResults = await performWebSearch(searchQuery);
        setIsSearching(false);

        if (searchResults) {
          finalContent = `El usuario quiere buscar en la web: "${searchQuery}"\n\nResultados de búsqueda web en tiempo real:\n\n${searchResults}\n\nBasándote en estos resultados de búsqueda reales y actualizados, proporciona una respuesta completa, bien estructurada y con las fuentes citadas.`;
        }
      }

      const messagesToSend = [...messages, { ...userMessage, content: finalContent }].map(m => ({
        role: m.role,
        content: m.content,
        ...(m.imageData && { imageData: m.imageData }),
      }));

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: messagesToSend, model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast.error("Límite de solicitudes excedido. Intenta de nuevo más tarde.");
        } else if (response.status === 402) {
          toast.error("Se requieren créditos adicionales.");
        } else {
          toast.error(errorData.error || "Error al procesar la solicitud");
        }
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsertAssistant(delta);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Error de conexión. Verifica tu conexión a internet.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [messages, currentConversationId]);

  const clearChat = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isSearching,
    sendMessage,
    clearChat,
    conversations,
    currentConversationId,
    startNewConversation,
    loadConversation,
    deleteConversation,
  };
}
