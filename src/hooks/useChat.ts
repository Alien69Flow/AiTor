import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { parseUsage, type TokenUsage } from "@/lib/neural-core-model";
import { routeSkills } from "@/lib/ai-skills";
import { AI_MODELS } from "@/lib/ai-models";
import { peekChatHealth, resolveOracles } from "@/lib/ai-health";
import { buildSkillContext, runSkills, type SkillRunResult } from "@/services/skills-runner";
import { runAgentTurn, type AgentTurnFailure } from "@/services/agent-turn";

export interface MessageSkill {
  label: string;
  ok: boolean;
  error?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageData?: string;
  /**
   * Razonamiento del modelo antes de la respuesta, tal cual lo publicó.
   * Se guarda aparte del contenido a propósito: es un panel plegable, no texto
   * de la respuesta, y no debe acabar en el markdown ni en el portapapeles.
   */
  reasoning?: string;
  /** Imágenes generadas en el turno, ya como data URLs. */
  images?: { url: string; alt: string }[];
  /** Música o voz generada en el turno, ya como data URLs. */
  audios?: { url: string; alt: string }[];
  /** Sources this turn consulted, so the transcript shows what the answer rests on. */
  skills?: MessageSkill[];
  /** Present only when the backend stream reports real provider usage. */
  usage?: TokenUsage;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: number;
}

const STORAGE_KEY = "aitor_chat_memory";

// URL and key come from the shared client so a project migration is one change
// in one file, not five: this hook, the globe and the diagnostics panel used to
// each carry their own copy of the project URL and anon JWT.
if (import.meta.env.DEV) {
  console.log("[useChat] env loaded:", {
    url: SUPABASE_URL,
    keyPrefix: SUPABASE_PUBLISHABLE_KEY.slice(0, 8),
  });
}
const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const PENDING_KEY = "aitor_chat_pending";
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un aviso por carga: el fallo del agente se explica una vez, no en cada mensaje. */
let agentWarningShown = false;

/**
 * Bloque de contexto para el oráculo sin herramientas.
 *
 * La función `chat` desplegada no tiene bucle de herramientas y, al pedirle el
 * repositorio, se inventaba `INTERFACE_NOT_BOUND`, que parece un error del
 * sistema. Se le dice en el mismo turno que no hay herramientas y qué hacer en
 * su lugar: decirlo con claridad es más útil que un código inventado.
 */
/** Frase corta y accionable para el aviso que queda en el chat. */
function describeNotice(failure: AgentTurnFailure): string {
  if (failure.kind === "no-session") {
    return "Sin sesión responde el oráculo general: no puede leer el repositorio ni la telemetría. Inicia sesión para que AI Tor use sus herramientas.";
  }
  if (failure.kind === "no-key") {
    return "El agente con herramientas no tiene clave en el despliegue (falta GEMINI_API_KEY). Se responde sin datos en vivo; GET /api/mcp muestra el estado.";
  }
  return `El agente con herramientas no respondió (${failure.detail || "sin detalle"}). Se responde sin datos en vivo.`;
}

function noToolsBlock(failure: AgentTurnFailure): string {
  const why =
    failure.kind === "no-session"
      ? "hace falta iniciar sesión para que el agente con herramientas atienda la petición"
      : failure.kind === "no-key"
        ? "el agente con herramientas no tiene clave configurada en el despliegue"
        : "el agente con herramientas no respondió";

  return [
    "### Herramientas",
    `En este turno NO hay herramientas conectadas: ${why}.`,
    "No puedes leer el repositorio, la base de datos ni la telemetría en vivo, así que no finjas que lo has hecho.",
    "Si te lo piden, dilo con una frase normal y ofrece lo que sí puedes responder.",
    "Prohibido inventar identificadores de error: nada de INTERFACE_NOT_BOUND, REPOSITORY_CONTEXT_NULL, " +
      "bloques [ERROR: ...] ni códigos por el estilo. Son frases que parecen fallos del sistema y no existen.",
  ].join("\n");
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Array<Omit<Message, "timestamp"> & { timestamp: string | number }>;
        return parsed.map((message) => ({ ...message, timestamp: new Date(message.timestamp) }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  /**
   * Por qué el turno va sin herramientas. Se queda a la vista en el chat: un
   * aviso que desaparece a los cuatro segundos deja al usuario con una respuesta
   * sin datos y ninguna pista de qué arreglar.
   */
  const [agentNotice, setAgentNotice] = useState<string | null>(null);

  useEffect(() => {
    // Las imágenes van como data URLs de uno o dos megas: guardarlas llena el
    // almacenamiento del navegador y la siguiente carga revienta al parsear un
    // JSON a medias. Se conservan en la sesión viva y no en disco.
    const persistable = messages.map(({ images: _images, ...rest }) => rest);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      // Cuota llena: se conserva el historial en memoria antes que romper el chat.
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string, model: string, imageData?: string) => {
      if (!content.trim()) return;

      // A stored choice can outlive its key (rotated, removed). If the last
      // health report says this oracle cannot answer, send with one that can
      // instead of spending the turn on a 500. Only a cached report is used, so
      // the first message never waits on the health probe.
      const health = peekChatHealth();
      let effectiveModel = model;
      if (health) {
        const oracles = resolveOracles(AI_MODELS, health);
        const requested = oracles.find((oracle) => oracle.model.id === model);
        if (requested && !requested.available) {
          const replacement = oracles.find((oracle) => oracle.available);
          if (replacement) {
            effectiveModel = replacement.model.id;
            toast.warning(`${requested.model.name} no tiene clave configurada. Respondiendo con ${replacement.model.name}.`);
          }
        }
      }

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
          JSON.stringify({ content, model: effectiveModel, imageData, ts: Date.now() })
        );
      } catch {
        // Storage can be unavailable in private mode; the request still runs.
      }

      // El agente con herramientas va primero. Es la única vía que puede leer
      // el repositorio, la telemetría o la base de datos: la función `chat` de
      // Supabase no tiene bucle de herramientas, así que cuando le pedías el
      // árbol del repo contestaba `INTERFACE_NOT_BOUND`. Si no hay sesión, hay
      // imagen (el agente no acepta adjuntos) o el endpoint falla, se sigue con
      // el chat de siempre en vez de dejar al usuario sin respuesta.
      // El mensaje se crea vacío en cuanto llega el primer trozo: antes se
      // esperaba a la respuesta completa y el chat parecía colgado hasta soltar
      // el texto de golpe.
      const agentId = crypto.randomUUID();
      let agentText = "";
      let agentReasoning = "";
      const agentImages: { url: string; alt: string }[] = [];
      const agentAudios: { url: string; alt: string }[] = [];
      /** Ya hay burbuja creada: puede ser por razonamiento, antes que el texto. */
      let agentCreated = false;
      /** Rellenado por el agente cuando no puede contestar. */
      let agentFailure: AgentTurnFailure | null = null;

      /**
       * Añade texto o razonamiento al mismo mensaje, creándolo en el primer
       * trozo de cualquiera de los dos. El razonamiento llega antes, así que la
       * burbuja aparece con el panel plegable y el texto se rellena debajo.
       */
      const patchAgent = (chunk: {
        text?: string;
        thought?: string;
        image?: { url: string; alt: string };
        audio?: { url: string; alt: string };
      }) => {
        if (chunk.text) agentText += chunk.text;
        if (chunk.thought) agentReasoning += chunk.thought;
        if (chunk.image) agentImages.push(chunk.image);
        if (chunk.audio) agentAudios.push(chunk.audio);
        const snapshot = {
          content: agentText,
          ...(agentReasoning && { reasoning: agentReasoning }),
          ...(agentImages.length > 0 && { images: [...agentImages] }),
          ...(agentAudios.length > 0 && { audios: [...agentAudios] }),
        };
        if (!agentCreated) {
          agentCreated = true;
          setMessages((prev) => [
            ...prev,
            { id: agentId, role: "assistant" as const, ...snapshot, timestamp: new Date() },
          ]);
          return;
        }
        setMessages((prev) =>
          prev.map((message) => (message.id === agentId ? { ...message, ...snapshot } : message)),
        );
      };

      const agentTurn = await runAgentTurn(
        messages.map((message) => ({ role: message.role, content: message.content })),
        content,
        {
          hasImage: Boolean(imageData),
          onDelta: (delta) => patchAgent({ text: delta }),
          onThought: (thought) => patchAgent({ thought }),
          onImage: (image) => patchAgent({ image }),
          onAudio: (audio) => patchAgent({ audio }),
          onFailure: (failure) => {
            agentFailure = failure;
          },
        },
      );
      if (agentTurn) {
        // El agente volvió a atender: el aviso de «sin herramientas» ya no aplica.
        setAgentNotice(null);
        const chips: MessageSkill[] = agentTurn.tools.map((name) => ({
          label: name,
          ok: !agentTurn.failed.includes(name),
        }));
        if (agentCreated) {
          // El texto ya está en pantalla: sólo se cierran las fichas de
          // herramientas, sin reescribir lo que el usuario está leyendo. El
          // razonamiento final sólo sustituye al parcial si trae más.
          setMessages((prev) =>
            prev.map((message) =>
              message.id === agentId
                ? {
                    ...message,
                    content: agentTurn.content.length >= agentText.length ? agentTurn.content : message.content,
                    ...(agentTurn.reasoning.length >= agentReasoning.length &&
                      agentTurn.reasoning && { reasoning: agentTurn.reasoning }),
                    ...(agentTurn.images.length > agentImages.length && { images: agentTurn.images }),
                    ...(agentTurn.audios.length > agentAudios.length && { audios: agentTurn.audios }),
                    ...(chips.length > 0 && { skills: chips }),
                  }
                : message,
            ),
          );
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: agentId,
              role: "assistant",
              content: agentTurn.content,
              timestamp: new Date(),
              ...(agentTurn.reasoning && { reasoning: agentTurn.reasoning }),
              ...(agentTurn.images.length > 0 && { images: agentTurn.images }),
              ...(agentTurn.audios.length > 0 && { audios: agentTurn.audios }),
              ...(chips.length > 0 && { skills: chips }),
            },
          ]);
        }
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          // Storage bloqueado: no hay nada que limpiar.
        }
        setIsLoading(false);
        return;
      }

      // Sin agente: se explica una vez por carga. Antes esto era silencioso y el
      // usuario sólo veía una respuesta sin datos que decía cosas como
      // «INTERFACE_NOT_BOUND», sin pista de qué faltaba.
      if (agentFailure) {
        setAgentNotice(describeNotice(agentFailure));
        if (!agentWarningShown) {
          agentWarningShown = true;
          toast.warning("AI Tor responde sin herramientas", { description: describeNotice(agentFailure) });
        }
      }

      // El flujo se cortó después de empezar: lo leído es real, no se borra ni
      // se pide otra respuesta encima (eso duplicaba el mensaje).
      if (agentCreated) {
        toast.warning("El agente se cortó a mitad de la respuesta; lo mostrado sí llegó del modelo.");
        setIsLoading(false);
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          // Storage bloqueado: no hay nada que limpiar.
        }
        return;
      }

      // Sólo cuando el agente no contesta se pagan las skills: el agente ya
      // tiene sus propias herramientas, así que consultarlas antes era gastar
      // hasta nueve segundos de espera para que el modelo las ignorara.
      const skillIds = routeSkills(content);
      let skillResults: SkillRunResult[] = [];
      if (skillIds.length > 0) {
        skillResults = await runSkills(skillIds, content);
        const skillChips: MessageSkill[] = skillResults.map((result) => ({
          label: result.label,
          ok: result.ok,
          ...(result.error && { error: result.error }),
        }));
        setMessages((prev) =>
          prev.map((message) =>
            message.id === userMessage.id ? { ...message, skills: skillChips } : message,
          ),
        );
      }
      const skillContext = buildSkillContext(skillResults);
      if (agentFailure) skillContext.push(noToolsBlock(agentFailure));

      const assistantId = crypto.randomUUID();
      let assistantText = "";
      let assistantStarted = false;
      let usage: TokenUsage | null = null;

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
            // The gateway expects a JWT in Authorization. The publishable key
            // (`sb_publishable_*`) is not a JWT, so only use a real session token
            // or the anon JWT. Keep the publishable key in `apikey`.
            // The chat function is public (verify_jwt=false) and does not need
            // to know who is asking, so the session token is deliberately NOT
            // sent: it is signed by the identity project and this call goes to
            // the data project, where its gateway would reject it.
            const bearer = SUPABASE_PUBLISHABLE_KEY;

            const resp = await fetch(CHAT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${bearer}`,
                apikey: SUPABASE_PUBLISHABLE_KEY,
              },
              signal: controller.signal,
              body: JSON.stringify({
                model: effectiveModel,
                ...(skillContext.length > 0 && { context: skillContext }),
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
              // Un «error al conectar» a secas no dice si fue el proyecto
              // pausado, una clave ausente o un fallo del proveedor, y no deja
              // nada que hacer. El cuerpo de la función sí lo dice: se enseña.
              const body = await resp.text().catch(() => "");
              let reason: string | undefined;
              try {
                const parsed = JSON.parse(body) as { error?: unknown };
                if (typeof parsed?.error === "string") reason = parsed.error;
              } catch {
                // Respuesta no JSON (HTML de proxy, texto plano): se usa tal cual.
              }
              toast.error(`Error al conectar con el oráculo (${resp.status})`, {
                description: (reason || body).slice(0, 200) || "El backend no devolvió detalle.",
              });
              return null;
            }
            dismissWaiting();
            return resp;
          } catch (err: unknown) {
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
              // Real usage arrives in a final chunk when the provider is asked
              // for it; nothing is inferred from it if the field is absent.
              const reportedUsage = parseUsage(parsed.usage);
              if (reportedUsage) usage = reportedUsage;
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) upsertAssistant(delta);
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        const finalUsage = usage;
        if (finalUsage && assistantStarted) {
          setMessages((prev) =>
            prev.map((message) => (message.id === assistantId ? { ...message, usage: finalUsage } : message))
          );
        }

        if (!assistantStarted) {
          toast.error("Sin respuesta del oráculo");
        }
      } catch (error: unknown) {
        console.warn("Chat error after retries:", error instanceof Error ? error.message : String(error));
        toast.error("Oráculo en espera — backend pausado. Reintenta en unos segundos.");
      } finally {
        dismissWaiting();
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          // Nothing to clean up if storage is blocked.
        }
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setAgentNotice(null);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Chat limpiado");
  }, []);

  return {
    messages,
    isLoading,
    agentNotice,
    sendMessage,
    clearChat,
  };
}
