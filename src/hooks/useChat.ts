iimport { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export function useChat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("aitor_chat_memory");
    return saved ? JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) : [];
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("aitor_chat_memory", JSON.stringify(messages));
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMsg = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // URL LIMPIA, SIN RAREZAS DE STREAMING QUE DAN 404
      const key = "AIzaSyBRxqMw64TP8rurqfhSzchppr7NgeM1tvM";
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: content }] }]
        })
      });

      if (!response.ok) throw new Error(`Google respondió con error ${response.status}`);

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No hay respuesta de la red.";

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error("DEBUG:", error);
      toast.error("Error de conexión. Mira F12.");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return { messages, isLoading, sendMessage, clearChat: () => {
    setMessages([]);
    localStorage.removeItem("aitor_chat_memory");
  }};
}
