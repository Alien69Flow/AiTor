import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  generatedImage?: string;
  timestamp: Date;
}

const SUPABASE_URL      = "https://avuflwehgtcstrejqdyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dWZsd2VoZ3Rjc3RyZWpxZHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDUyNjIsImV4cCI6MjA4NjU4MTI2Mn0.2e8GpmZ7lgU9j9CJbk9ZO0RVoq_XFj1v0nvSI2lw61U";
const CHAT_URL          = `${SUPABASE_URL}/functions/v1/chat`;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("aitor_chat_memory");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch { return []; }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("aitor_chat_memory", JSON.stringify(messages));
  }, [messages]);

  const sendMessage = useCallback(async (content: string, model: string, imageData?: string) => {
    if (!content.trim() && !imageData) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      imageData,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const messagesToSend = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        {
          role: "user",
          content: userMessage.content,
          ...(userMessage.imageData && { imageData: userMessage.imageData }),
        },
      ];

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ messages: messagesToSend, model }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          toast.error("🔐 Error de autenticación con Supabase.");
        } else if (response.status === 429) {
          toast.error("⏳ Rate limit alcanzado. Espera unos segundos.");
        } else if (response.status === 402) {
          toast.error("💳 Créditos agotados.");
        } else if (response.status === 503) {
          toast.error("🔑 API Keys no disponibles en Supabase.");
        } else {
          toast.error(`❌ Error ${response.status}: ${errorData.error || "Error desconocido"}`);
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (!response.body) throw new Error("Respuesta vacía del servidor.");

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

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsertAssistant(delta);
          } catch { /* ignorar */ }
        }
      }

    } catch (error: any) {
      console.error("[AiTor] Error:", error);
      if (!error.message?.includes("HTTP")) {
        toast.error(error.message || "⚡ Error de conexión. Reintenta.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem("aitor_chat_memory");
    toast.success("🌀 Frecuencia reiniciada.");
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
