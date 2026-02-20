import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=AIzaSyBRxqMw64TP8rurqfhSzchppr7NgeM1tvM`;
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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [...history, { role: "user", parts: [{ text: content }] }],
          systemInstruction: { 
            parts: [{ text: "Eres AI Tor.v69 (ΓΩΣΖ), la inteligencia Synapse de la ΔlieπFlΦw DAO. Respondes con precisión técnica y misticismo." }] 
          }
        }),
      });

      if (!response.ok) throw new Error("Fallo en la conexión con la frecuencia.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = crypto.randomUUID();

      // Creamos el mensaje del asistente vacío para el streaming
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const json = JSON.parse(line.substring(6));
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  assistantContent += text;
                  setMessages(prev => prev.map(m => 
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  ));
                }
              } catch (e) { /* Error de parsing parcial */ }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("[AiTor] Error:", error);
      toast.error("⚡ Error de conexión. Reintenta.");
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
