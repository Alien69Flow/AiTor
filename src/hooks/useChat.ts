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

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_KEY}`;

// Modelos que devuelven imagen (JSON no-streaming)
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];

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

    const isImageModel = IMAGE_MODELS.includes(model);

    try {
      // Build history — system prompt is injected server-side
  const messagesToSend = messages.map(m => ({
  role: m.role === "user" ? "user" : "model",
  parts: [{ text: m.content }]
}));

messagesToSend.push({
  role: "user",
  parts: [{ text: userMessage.content }]
});

const response = await fetch(CHAT_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ contents: messagesToSend }),
});

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast.error("Rate limit alcanzado. Espera unos segundos.");
        } else if (response.status === 402) {
          toast.error("Créditos agotados. Añade fondos a tu workspace.");
        }
        throw new Error(errorData.error || "Error en la conexión.");
      }

      // Image model → JSON response
      if (isImageModel) {
        const data = await response.json();
        const assistantMsg = data.choices?.[0]?.message;
        const generatedImage = assistantMsg?.images?.[0]?.image_url?.url;

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantMsg?.content || "Imagen generada:",
          generatedImage,
          timestamp: new Date(),
        }]);
        setIsLoading(false);
        return;
      }

      // Streaming for text models
      if (!response.body) throw new Error("Empty response body.");

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

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsertAssistant(delta);
          } catch { /* ignore */ }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error(error.message || "Error de conexión. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem("aitor_chat_memory");
    toast.success("Chat limpiado.");
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
