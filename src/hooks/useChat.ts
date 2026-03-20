import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageData?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const STORAGE_KEY = "aitor_chat_memory";

const SYSTEM_PROMPT = `Eres AI Tor.v69, un asistente de inteligencia artificial avanzado. Tu propósito es ayudar a los usuarios con cualquier pregunta o tarea que puedan tener. Sé útil, accesible y amable en todas tus respuestas.`;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string, _model: string, _imageData?: string) => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          toast.error("API key de Gemini no configurada");
          setIsLoading(false);
          return;
        }

        const conversationHistory = messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }],
            },
            ...conversationHistory,
            {
              role: "user",
              parts: [{ text: content }],
            },
          ],
        };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Gemini API error:", errorData);
          toast.error("Error al conectar con Gemini");
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        const assistantText =
          data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantText,
            timestamp: new Date(),
          },
        ]);
      } catch (error: any) {
        console.error("Chat error:", error);
        toast.error(error.message || "Error de conexión");
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Chat limpiado");
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
}
