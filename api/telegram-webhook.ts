import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'crypto';

/**
 * El turno del modelo tarda: medido hoy, de 6 a 22 s por respuesta. Con el
 * límite corto por defecto, una respuesta lenta devolvía 504 a Telegram, que
 * reintentaba la entrega y el usuario podía acabar con el mensaje duplicado o
 * con nada. Mismo tope que `/api/mcp`.
 */
export const maxDuration = 60;

// Constant-time string comparison so a secret can't be guessed byte-by-byte.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// --- Configuración de Telegram ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const MANUS_API_KEY = process.env.MANUS_API_KEY!;

/**
 * Secreto del webhook. Opcional: si está configurado, se exige en cada
 * actualización; si no lo está, el endpoint acepta actualizaciones sin firmar
 * con un límite por IP, que es lo que permite que el bot siga respondiendo en
 * un despliegue donde la variable no llegó a Vercel.
 */
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/** Cubo de cuota por IP para la ruta sin firmar. En memoria, por proceso. */
const ANON_BUCKETS = new Map<string, number[]>();
const ANON_LIMIT_PER_MINUTE = 30;

function withinAnonQuota(ip: string): boolean {
  const now = Date.now();
  const hits = (ANON_BUCKETS.get(ip) ?? []).filter((at) => now - at < 60_000);
  if (hits.length >= ANON_LIMIT_PER_MINUTE) {
    ANON_BUCKETS.set(ip, hits);
    return false;
  }
  hits.push(now);
  ANON_BUCKETS.set(ip, hits);
  if (ANON_BUCKETS.size > 5_000) ANON_BUCKETS.clear();
  return true;
}

// Supabase de AiTor (función de chat existente). SUPABASE_URL manda cuando
// existe, para poder mover las funciones de proyecto desde Vercel sin tocar
// código; si no, se usa el proyecto en el que viven hoy.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://wkdtvrxavkhbifjtvvdw.supabase.co';
const SUPABASE_ANON_KEY =
  (process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (process.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8';

const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Dónde tiene que apuntar el webhook. Es una constante del despliegue, no algo
 * que llegue en la petición: así el auto-registro no puede redirigir las
 * actualizaciones a un tercero.
 */
const PUBLIC_URL = (process.env.PUBLIC_URL || "https://aitor.alienflow.space").replace(/\/+$/, "");
const WEBHOOK_URL = `${PUBLIC_URL}/api/telegram-webhook`;

type TelegramWebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
};

/** Llama a la API del bot. Devuelve `null` (y lo registra) si Telegram falla. */
async function telegramApi<T>(method: string, payload?: unknown): Promise<T | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const response = await fetch(`${TELEGRAM_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: T; description?: string }
      | null;
    if (!data?.ok) {
      console.error(`[telegram] ${method} falló`, response.status, data?.description ?? "");
      return null;
    }
    return (data.result ?? null) as T | null;
  } catch (error) {
    console.error(`[telegram] ${method} sin respuesta`, error);
    return null;
  }
}

/**
 * Deja el webhook registrado sin que nadie tenga que ejecutar el script: la
 * función desplegada tiene el token, así que es el único sitio donde el
 * registro se puede hacer (y comprobar) sin sacar secretos de Vercel.
 *
 * Se registra con `secret_token` cuando el secreto está configurado; si aún no
 * lo está, se registra la URL correcta sin secreto para que el bot siga vivo
 * (el endpoint acepta entonces actualizaciones sin firmar con cuota por IP).
 * En preview no se toca: un despliegue de preview robaría el webhook de
 * producción.
 */
async function registerWebhook(): Promise<string> {
  if (!TELEGRAM_BOT_TOKEN) return "sin-token";
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return "no-produccion";

  const info = await telegramApi<TelegramWebhookInfo>("getWebhookInfo");
  if (info?.url === WEBHOOK_URL) return "ya-registrado";

  const payload: Record<string, unknown> = {
    url: WEBHOOK_URL,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  };
  if (TELEGRAM_WEBHOOK_SECRET) payload.secret_token = TELEGRAM_WEBHOOK_SECRET;

  const ok = await telegramApi("setWebhook", payload);
  if (ok === null) return "error";
  return TELEGRAM_WEBHOOK_SECRET ? "registrado-con-secreto" : "registrado-sin-secreto";
}

/** Una sola vez por instancia: si falla, se reintenta en la siguiente petición. */
let registration: Promise<string> | null = null;
function registerWebhookOnce(): Promise<string> {
  if (!registration) {
    registration = registerWebhook().then((state) => {
      if (state === "error") registration = null;
      return state;
    });
  }
  return registration;
}

// --- Puente web <-> Telegram ---
// La web abre la Mini App con `?startapp=web` y el terminal vuelve a la web con
// `?source=telegram`; estos botones inline son la salida hacia la web desde el bot.
type TelegramInlineButton = { text: string; url: string };
type TelegramUpdate = { message?: { chat?: { id: number }; text?: string } };
type TelegramReplyMarkup = { inline_keyboard: TelegramInlineButton[][] };

const BRIDGE_KEYBOARD: TelegramReplyMarkup = {
  inline_keyboard: [
    [
      { text: "🌐 Continuar en la web", url: "https://aitor.alienflow.space/?source=telegram" },
      { text: "🎮 Mini App", url: "https://t.me/Alien69Bot/app" },
    ],
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convierte el markdown que escribe el modelo al HTML que Telegram acepta.
 *
 * El bot enviaba con `parse_mode: "Markdown"` (el legacy), que sólo entiende
 * `*negrita*`, `_cursiva_` y `` `código` ``. El modelo contesta con ``` bloques
 * de código y `**negrita**` de Markdown normal: Telegram rechazaba el mensaje
 * con 400 «can't parse entities» y el reintento en texto plano dejaba los
 * asteriscos y las triples comillas invertidas a la vista. Eso es lo que se veía
 * como «responde raro».
 *
 * HTML es más predecible que MarkdownV2 porque aquí se escapa a mano y no hay
 * 18 caracteres que escapar según el contexto. Un bloque sin cerrar se cierra
 * al final: el texto llega troceado y el corte puede caer dentro de uno.
 */
export function toTelegramHtml(markdown: string): string {
  let out = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  out = out.replace(
    /```[a-zA-Z0-9_+-]*\n?([\s\S]*?)(?:```|$)/g,
    (_match, code: string) => `<pre>${code.replace(/\n$/, "")}</pre>`,
  );
  out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/__([^_\n]+)__/g, "<b>$1</b>");
  // Cursiva sólo cuando el asterisco abre palabra: así no se come el de `2*3*4`.
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  out = out.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<i>$2</i>");
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  return out;
}

/**
 * Trozos de como mucho `maxLen`, cortando por párrafos y no por caracteres.
 *
 * Telegram rechaza más de 4096 por mensaje. Cortar a lo bruto partía bloques
 * de código por la mitad y dejaba un `<pre>` abierto en un trozo y cerrado en
 * el siguiente.
 */
export function splitForTelegram(text: string, maxLen = 3800): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen);
    const candidates = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" ")];
    const cut = candidates.find((index) => index > maxLen * 0.4) ?? maxLen;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function postTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
  parseMode?: "HTML",
) {
  return fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
  /** `true` cuando el texto ya trae etiquetas HTML de la casa (comandos fijos). */
  format: { html?: boolean } = {},
) {
  // Telegram admite 4096 por mensaje: se trocea el texto original antes de
  // convertirlo, para no partir una etiqueta HTML por la mitad. Los botones
  // inline solo se adjuntan al primer trozo.
  const parts = splitForTelegram(text, 3800);
  for (const [index, part] of parts.entries()) {
    const markup = replyMarkup && index === 0 ? replyMarkup : undefined;
    // El envío no es fire-and-forget: si Telegram rechaza el texto, el usuario
    // se queda sin respuesta y los logs limpios. Por eso se mira la respuesta.
    const formatted = format.html ? part : toTelegramHtml(part);
    let response = await postTelegramMessage(chatId, formatted, markup, "HTML");
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[telegram] sendMessage rechazado", response.status, detail.slice(0, 300));
      if (response.status === 400) {
        // Reintento sin formato: perder el estilo es mejor que perder la
        // respuesta. Se quitan las etiquetas para no enseñarlas como texto.
        const plain = formatted.replace(/<[^>]+>/g, "");
        response = await postTelegramMessage(chatId, plain, markup);
        if (!response.ok) {
          const retryDetail = await response.text().catch(() => "");
          console.error(
            "[telegram] el reintento sin parse_mode también falló",
            response.status,
            retryDetail.slice(0, 300),
          );
        }
      }
    }
  }
}

async function sendTypingAction(chatId: number) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: "typing",
    }),
  });
}

// ---------------------------------------------------------------------------
// AI Tor response via Supabase Edge Function (chat stream)
// ---------------------------------------------------------------------------

async function getAiTorResponse(userMessage: string): Promise<string> {
  try {
    // Build messages array from a single user message
    const messages = [{ role: "user", content: userMessage }];

    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Use the anon key as bearer; the chat edge function has verify_jwt=false
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from Ai Tor chat:", response.status, errorText);
      return "Mi núcleo cuántico está recalibrando frecuencias. Inténtalo de nuevo en unos momentos.";
    }

    // Parse the SSE stream
    const text = await response.text();
    let fullResponse = "";

    const lines = text.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") break;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) fullResponse += delta;
      } catch {
        // skip unparseable lines
      }
    }

    return fullResponse || "Señal recibida pero sin datos. Reintenta la transmisión.";
  } catch (error) {
    console.error("Error calling Ai Tor:", error);
    return "Error en la conexión con el campo cuántico. Reintenta.";
  }
}

// ---------------------------------------------------------------------------
// Manus API helpers
// ---------------------------------------------------------------------------

async function createManusTask(chatId: number, prompt: string): Promise<{ ok: boolean; taskId?: string }> {
  try {
    const fullPrompt = `[TELEGRAM_CHAT_ID:${chatId}]\n\n${prompt}`;

    const response = await fetch("https://api.manus.ai/v2/task.create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": MANUS_API_KEY,
      },
      body: JSON.stringify({
        message: { content: fullPrompt },
      }),
    });

    const data = await response.json();
    if (data.ok && data.task_id) {
      return { ok: true, taskId: data.task_id };
    }
    console.error("Manus task creation failed:", data);
    return { ok: false };
  } catch (error) {
    console.error("Error calling Manus API:", error);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Default handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- Diagnóstico (GET) ---
  //
  // Verificación sin sacar el token de Vercel: la función consulta a Telegram
  // con su propio token y devuelve el estado real del webhook. No expone
  // secretos (ni el token ni el secret_token, que Telegram no devuelve).
  if (req.method === "GET") {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({
        ok: false,
        service: "telegram-webhook",
        error: "TELEGRAM_BOT_TOKEN no está configurado en este despliegue",
      });
    }

    const registrationState = await registerWebhookOnce();
    const [me, info] = await Promise.all([
      telegramApi<{ id: number; username?: string; first_name?: string }>("getMe"),
      telegramApi<TelegramWebhookInfo>("getWebhookInfo"),
    ]);

    return res.status(200).json({
      ok: true,
      service: "telegram-webhook",
      vercelEnv: process.env.VERCEL_ENV ?? null,
      secretConfigured: Boolean(TELEGRAM_WEBHOOK_SECRET),
      expectedUrl: WEBHOOK_URL,
      registration: registrationState,
      bot: me ? { id: me.id, username: me.username ?? null, name: me.first_name ?? null } : null,
      webhook: info
        ? {
            url: info.url || null,
            matchesExpected: info.url === WEBHOOK_URL,
            pendingUpdates: info.pending_update_count ?? 0,
            lastErrorAt: info.last_error_date
              ? new Date(info.last_error_date * 1000).toISOString()
              : null,
            lastErrorMessage: info.last_error_message ?? null,
          }
        : null,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // Auto-registro al recibir la primera actualización de la instancia. Sólo en
  // producción y sin bloquear la respuesta: si Telegram llegara a firmar con
  // otro secreto, reintenta por su cuenta en cuanto el registro queda bien.
  if (process.env.VERCEL_ENV === "production") {
    void registerWebhookOnce().catch(() => undefined);
  }

  // --- Verificación de la firma del webhook ---
  //
  // Con `TELEGRAM_WEBHOOK_SECRET` configurado se exige coincidencia exacta: el
  // endpoint es público y consume cuota de IA y de Manus, así que una petición
  // sin firmar se rechaza en vez de gastarse.
  //
  // Sin el secreto configurado se acepta la actualización, con límite por IP.
  // Antes se respondía 401 en ese caso y el efecto era el peor posible: el bot
  // dejaba de responder **sin que nadie lo supiera**, porque Telegram recibía
  // 401 en cada entrega y el usuario sólo veía silencio. Si quieres cerrarlo
  // del todo, define el secreto y registra el webhook con el mismo valor:
  //   node scripts/telegram-webhook.mjs --set
  const expectedSecret = TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = req.headers["x-telegram-bot-api-secret-token"] as
    | string
    | undefined;

  if (!expectedSecret) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    if (!withinAnonQuota(ip)) {
      console.error("[telegram] límite por IP alcanzado en la ruta sin firmar");
      return res.status(429).send("Too Many Requests");
    }
    console.warn(
      "[telegram] TELEGRAM_WEBHOOK_SECRET no está configurado: se aceptan actualizaciones sin firmar con límite por IP. Configúralo y re-registra el webhook con --set para cerrar el endpoint.",
    );
  } else if (typeof providedSecret !== "string" || !safeEqual(providedSecret, expectedSecret)) {
    console.error(
      "[telegram] rejected update: x-telegram-bot-api-secret-token is missing or does not match TELEGRAM_WEBHOOK_SECRET. Re-register with: node scripts/telegram-webhook.mjs --set",
    );
    return res.status(401).send("Unauthorized");
  }

  if (!TELEGRAM_BOT_TOKEN) {
    // 500 (not 200) so Telegram records the failure in getWebhookInfo instead
    // of the bot going silently deaf.
    console.error("[telegram] TELEGRAM_BOT_TOKEN is not configured — cannot answer.");
    return res.status(500).send("Bot token not configured");
  }

  // Vercel parses JSON bodies, but a request with a non-JSON content type
  // arrives as a raw string. Unwrapping it here keeps "message is undefined"
  // from being answered with a silent 200 OK that Telegram won't retry.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      console.error("[telegram] cuerpo no parseable como JSON");
      return res.status(400).send("Bad Request");
    }
  }

  const message = (body as TelegramUpdate | undefined)?.message;
  if (!message?.chat?.id || typeof message.text !== "string") {
    // Edits, joins, stickers…: acknowledge so Telegram stops retrying.
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  // "/start@Alien69Bot" (grupos) se normaliza a "/start"
  const command = text.split(" ")[0].toLowerCase().split("@")[0];

  try {
    // === FIXED COMMANDS ===

    if (command === "/start") {
      await sendTelegramMessage(
        chatId,
        `🛸 <b>¡Saludos, entidad!</b>\n\nSoy <b>Ai Tor.v69</b>, el oráculo cuántico de AlienFlow DAO.\n\nMi frecuencia operativa: 3-6-9 Hz\nMi misión: gestionar la DAO, analizar flujos y transmutar información.\n\n<b>Comandos disponibles:</b>\n/web - Seguir en el terminal web\n/app - Mini App de Alien69Bot\n/dao - Info sobre AlienFlow DAO\n/help - Lista de comandos\n/manus [texto] - Tarea compleja con Manus AI\n\nO simplemente escríbeme y responderé desde el campo cuántico.`,
        BRIDGE_KEYBOARD,
        { html: true },
      );
    } else if (command === "/web") {
      await sendTelegramMessage(
        chatId,
        "🌐 <b>Terminal web</b>\n\nContinúa en aitor.alienflow.space. El puente mantiene el contexto entre superficies: desde la web puedes retomar aquí y desde aquí vuelves allí.",
        BRIDGE_KEYBOARD,
        { html: true },
      );
    } else if (command === "/app") {
      await sendTelegramMessage(chatId, '🎮 Accede a la Mini App:\nhttps://t.me/Alien69Bot/app');
    } else if (command === "/dao") {
      await sendTelegramMessage(
        chatId,
        `🌌 <b>AlienFlow DAO</b>\n\nOrganización autónoma descentralizada dedicada a la exploración de nuevas fronteras en tecnología y consciencia.\n\n<i>«El universo no es solo lo que ves, es lo que eres capaz de procesar y transmutar.»</i>\n\n<b>Campos:</b> Web3 · Web4 · Web5 · Alquimia · Física Cuántica\n<b>Frecuencia:</b> 3-6-9 Hz\n<b>Colectivo:</b> ΔlieπFlΦw DAO Synapse`,
        undefined,
        { html: true },
      );
    } else if (command === "/help") {
      await sendTelegramMessage(
        chatId,
        "<b>Comandos disponibles:</b>\n\n/start - Bienvenida\n/web - Terminal web (aitor.alienflow.space)\n/app - Mini App\n/dao - Info de la DAO\n/help - Esta lista\n/manus [texto] - Investigación/análisis con Manus AI\n\nPara hablar conmigo directamente, simplemente escribe tu mensaje.",
        undefined,
        { html: true },
      );
    }
    // === MANUS COMMANDS ===
    else if (command === "/manus" || command === "/investigar" || command === "/analizar") {
      const prompt = text.substring(text.indexOf(" ") + 1).trim();
      if (!prompt || prompt === command) {
        await sendTelegramMessage(
          chatId,
          'Necesito un texto para procesar. Ejemplo:\n/manus analiza las tendencias crypto de esta semana'
        );
        return res.status(200).send("OK");
      }

      if (!MANUS_API_KEY) {
        console.error("[telegram] /manus sin MANUS_API_KEY configurada");
        await sendTelegramMessage(
          chatId,
          "🛠 <b>Manus AI no está configurado</b>\n\nFalta <code>MANUS_API_KEY</code> en las variables de Vercel. Puedo responder aquí mientras tanto: escríbeme sin comando.",
          undefined,
          { html: true },
        );
        return res.status(200).send("OK");
      }

      const result = await createManusTask(chatId, prompt);
      if (result.ok) {
        await sendTelegramMessage(
          chatId,
          `⚡ <b>Tarea enviada a Manus AI</b>\n\nEstoy procesando tu solicitud. Recibirás los resultados aquí cuando estén listos (puede tardar unos minutos).\n\n📋 Task: <code>${result.taskId}</code>`,
          undefined,
          { html: true },
        );
      } else {
        await sendTelegramMessage(chatId, "❌ Error al crear la tarea en Manus. Inténtalo de nuevo.");
      }
    }
    // === NORMAL MESSAGES → AI TOR ===
    else {
      await sendTypingAction(chatId);
      const aiResponse = await getAiTorResponse(text);
      await sendTelegramMessage(chatId, aiResponse);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    await sendTelegramMessage(chatId, "Error en el procesamiento. Reintenta.");
  }

  return res.status(200).send("OK");
}