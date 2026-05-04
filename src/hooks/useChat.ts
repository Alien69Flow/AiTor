import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  updatedAt: number;
}

const STORAGE_KEY = "aitor_chat_memory";
// Build the chat URL from the supabase client to avoid `undefined` env vars at runtime.
// `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are not always present in the
// deployed bundle, but the auto-generated client always carries the correct values.
const SUPABASE_URL = (supabase as any)?.supabaseUrl
  || (import.meta.env.VITE_SUPABASE_URL as string)
  || (import.meta.env.VITE_SUPABASE_PROJECT_ID
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : "");
const SUPABASE_KEY = (supabase as any)?.supabaseKey
  || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
  || "";
const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const PENDING_KEY = "aitor_chat_pending";
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    async (content: string, model: string, imageData?: string) => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        ...(imageData && { imageData }),
      };

      const baseMessages = [...messages, userMessage];
      setMessages(baseMessages);
      setIsLoading(true);
      // Persist pending so we can recover if the page reloads mid-request
      try {
        localStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ content, model, imageData, ts: Date.now() })
        );
      } catch {}

      const assistantId = crypto.randomUUID();
      let assistantText = "";
      let assistantStarted = false;

      const upsertAssistant = (chunk: string) => {
        assistantText += chunk;
        setMessages((prev) => {
          if (!assistantStarted) {
            assistantStarted = true;
            return [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: assistantText,
                timestamp: new Date(),
              },
            ];
          }
          return prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantText } : m
          );
        });
      };

      let waitingToastId: string | number | undefined;
      const showWaiting = () => {
        if (waitingToastId === undefined) {
          waitingToastId = toast.loading("Oráculo en espera — reconectando...");
        }
      };
      const dismissWaiting = () => {
        if (waitingToastId !== undefined) {
          toast.dismiss(waitingToastId);
          waitingToastId = undefined;
        }
      };

      const requestWithRetry = async (): Promise<Response | null> => {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const resp = await fetch(CHAT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_KEY}`,
                apikey: SUPABASE_KEY,
              },
              signal: controller.signal,
              body: JSON.stringify({
                model,
                messages: baseMessages.map((m) => ({
                  role: m.role,
                  content: m.content,
                  ...(m.imageData && { imageData: m.imageData }),
                })),
              }),
            });
            clearTimeout(timeoutId);

            // 429/402 = no retry, surface immediately
            if (resp.status === 429) {
              toast.error("Límite de peticiones alcanzado. Intenta de nuevo en unos segundos.");
              return null;
            }
            if (resp.status === 402) {
              toast.error("Créditos agotados. Añade saldo en tu workspace.");
              return null;
            }
            // 5xx / 503 (paused backend) → retry with backoff
            if (!resp.ok || !resp.body) {
              if (resp.status >= 500 && attempt < MAX_RETRIES - 1) {
                showWaiting();
                await sleep(1500 * (attempt + 1));
                continue;
              }
              toast.error("Error al conectar con el oráculo");
              return null;
            }
            dismissWaiting();
            return resp;
          } catch (err: any) {
            // network / timeout / supabase paused — retry
            if (attempt < MAX_RETRIES - 1) {
              showWaiting();
              await sleep(1500 * (attempt + 1));
              continue;
            }
            throw err;
          }
        }
        return null;
      };

      try {
        const resp = await requestWithRetry();
        if (!resp) {
          setIsLoading(false);
          dismissWaiting();
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line || line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;

            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) upsertAssistant(delta);
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        if (!assistantStarted) {
          toast.error("Sin respuesta del oráculo");
        }
      } catch (error: any) {
        console.warn("Chat error after retries:", error?.message);
        toast.error("Oráculo en espera — backend pausado. Reintenta en unos segundos.");
      } finally {
        dismissWaiting();
        try { localStorage.removeItem(PENDING_KEY); } catch {}
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
