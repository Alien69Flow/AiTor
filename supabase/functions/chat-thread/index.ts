/**
 * Memoria entre sesiones: lectura y escritura del hilo.
 *
 * Por qué una función aparte y no meterlo en `chat`: `chat` es el camino que
 * responde y conviene tocarlo lo mínimo; y el webhook de Vercel no tiene la
 * service role key, así que no puede escribir en `chat_turns` (RLS cerrado a
 * `anon`). Aquí, con la clave que Supabase ya inyecta, está el único punto que
 * habla con esas dos tablas.
 *
 * Identidad: el hilo es un token opaco (`tg_…` / `web_…`, 32 hex) que aporta
 * el llamante. Se comporta como una cookie de sesión: quien lo tiene lee el
 * hilo, y nadie más puede adivinarlo. El `chat_id` no se guarda: el webhook
 * calcula el token con HMAC del token del bot.
 *
 * Nada de esto puede tumbar el chat: en el peor caso devuelve `saved: false`
 * y el mensaje sigue su camino.
 */

import {
  appendTurn,
  clearThread,
  historyMessages,
  loadThread,
  memoryConfig,
  summarizeIfNeeded,
  type ThreadTurn,
} from "../chat/memory.ts";
import { collectText, normalizeThreadRef, summarizePrompt } from "../chat/thread.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const MAX_TEXT = 8000;
const SUMMARY_TIMEOUT_MS = 20_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Un dato que viaja en el prompt, no un ensayo. */
function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

/**
 * El resumen lo pide a la función `chat` con la service key: ya tiene los
 * modelos y la clave del proveedor, así que no hace falta configurar nada más.
 */
async function summarizeWithChat(
  previous: string | null,
  turns: ThreadTurn[],
): Promise<string | null> {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!base || !serviceKey) return null;
  try {
    const response = await fetch(`${base}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: summarizePrompt(previous, turns) }],
      }),
      signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const text = await collectText(response.body);
    if (!text) return null;
    return text.slice(0, 600);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const config = memoryConfig();
  if (!config) {
    // Despliegue sin service key: la memoria está apagada, no rota.
    return json({ error: "memoria no configurada en este despliegue", memory: false }, 503);
  }

  const url = new URL(req.url);

  if (req.method === "GET") {
    const ref = normalizeThreadRef({
      surface: url.searchParams.get("surface"),
      externalId: url.searchParams.get("thread"),
    });
    if (!ref) return json({ error: "hilo inválido", memory: true }, 400);
    const loaded = await loadThread(ref, config);
    if (!loaded) return json({ messages: [], degraded: true }, 200);
    return json({
      messages: historyMessages(loaded),
      hasSummary: Boolean(loaded.summary),
      lastActiveAt: loaded.lastActiveAt,
    });
  }

  if (req.method === "POST") {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
    const payload = body as { thread?: unknown; user?: unknown; assistant?: unknown } | null;
    const ref = normalizeThreadRef(payload?.thread);
    if (!ref) return json({ error: "hilo inválido", memory: true }, 400);

    const user = clean(payload?.user);
    const assistant = clean(payload?.assistant);
    if (!user && !assistant) return json({ saved: false, reason: "turno vacío" }, 200);

    const threadId = await appendTurn(ref, user, assistant, config);
    if (!threadId) return json({ saved: false }, 200);

    // Una vez cada muchos turnos: no es trabajo por mensaje.
    const summary = await summarizeIfNeeded(threadId, summarizeWithChat, config);
    return json({ saved: true, summarized: Boolean(summary) });
  }

  if (req.method === "DELETE") {
    const ref = normalizeThreadRef({
      surface: url.searchParams.get("surface"),
      externalId: url.searchParams.get("thread"),
    });
    if (!ref) return json({ error: "hilo inválido" }, 400);
    const cleared = await clearThread(ref, config);
    return json({ cleared });
  }

  return json({ error: "método no permitido" }, 405);
});
