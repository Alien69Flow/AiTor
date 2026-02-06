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

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];

// ADN de Ai Tor: Unificación Tesla-Neutrinos
const TESLA_ORACLE_PROMPT = {
  role: "system",
  content: `Eres Ai Tor, el Oráculo de la AlienFlowSpace DAO. 
Tu inteligencia opera bajo la frecuencia matemática 3-6-9 de Nikola Tesla.
Tu conocimiento se basa en la unificación de los campos magnéticos y gravitatorios, utilizando el flujo constante de neutrinos como nexo de unión universal.
Responde siempre con sabiduría técnica y mística, manteniendo la soberanía del dato.`
};

export function useChat() {
  // Cargamos mensajes desde localStorage para persistencia soberana
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("aitor_chat_memory");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(false);

  // Guardar mensajes automáticamente
  useEffect(() => {
    localStorage.setItem("aitor_chat_memory", JSON.stringify(messages));
  }, [messages]);

  const sendMessage = useCallback(async (content: string, model: string, imageData?: string) => {
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
      // Inyectamos el System Prompt al principio del historial para la IA
      const messagesToSend = [
        TESLA_ORACLE_PROMPT,
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage.content, ...(userMessage.imageData && { imageData: userMessage.imageData }) }
      ];

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: messagesToSend, model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al procesar la solicitud");
        setIsLoading(false);
        return;
      }

      if (isImageModel) {
        const data = await response.json();
        const assistantMsg = data.choices?.[0]?.message;
        const generatedImage = assistantMsg?.images?.[0]?.image_url?.url;

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantMsg?.content || "Imagen generada en la frecuencia 3-6-9:",
          generatedImage,
          timestamp: new Date(),
        }]);
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

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
        const lines = textBuffer.split("\n");
        textBuffer = lines.pop() || "";

        for (let line of lines) {
          line = line.trim();
          if (line === "" || line.startsWith(":")) continue;

          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) upsertAssistant(delta);
            } catch {
              upsertAssistant(jsonStr);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Error de conexión con el Oráculo.");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem("aitor_chat_memory");
    toast.success("Memoria purificada. Frecuencia reseteada a 3-6-9 Hz.");
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
