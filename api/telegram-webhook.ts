import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { chatFailureMessage, classifyChatFailure } from "./_shared/chat-failure.js";
import { pickSupabaseKey, supabaseAuthHeaders } from "./_shared/supabase-key.js";
import { retrieveKnowledge } from "./_shared/knowledge.js";
import {
  addAlert,
  buildAlert,
  formatCreated,
  MAX_ALERTS_PER_CHAT,
  parseAlertCommand,
  SYMBOL_IDS,
} from "./_shared/alerts.js";
import { claimUpdate } from "./_shared/update-dedupe.js";

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

/**
 * Qué clave se usa para hablar con el gateway y con la función de chat.
 *
 * El orden importa y era el bug: antes ganaba `VITE_SUPABASE_PUBLISHABLE_KEY`,
 * donde este despliegue tiene una `sb_publishable_…` que el gateway contesta
 * con 401. `pickSupabaseKey` prefiere una JWT anon y, si no hay ninguna, la
 * JWT pública del repositorio. La clave nunca se imprime: sólo su procedencia.
 */
const SUPABASE_KEY = pickSupabaseKey(
  process.env,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8',
);
const SUPABASE_ANON_KEY = SUPABASE_KEY.key;

if (SUPABASE_KEY.kind !== 'jwt') {
  console.warn(
    `[telegram] la clave de Supabase viene de ${SUPABASE_KEY.source} (${SUPABASE_KEY.kind}); el gateway puede rechazarla. Define VITE_SUPABASE_ANON_KEY con la JWT anon.`,
  );
}

const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const THREAD_URL = `${SUPABASE_URL}/functions/v1/chat-thread`;
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

// --- Memoria del hilo ---
//
// El webhook no puede escribir en `chat_turns` (RLS cerrado a `anon`), así que
// la memoria vive en la función `chat-thread`, que sí tiene la service key.
// Aquí sólo se pide y se guarda, con un tope de tiempo corto: si la memoria
// tarda o falla, el mensaje sigue su camino como si no existiera.
type ThreadRef = { surface: "telegram"; externalId: string };
type HistoryMessage = { role: "user" | "assistant"; content: string };
const THREAD_TIMEOUT_MS = 4_000;

/**
 * Token opaco del hilo: HMAC(token del bot, chat_id) en 16 bytes.
 *
 * Así el `chat_id` no se guarda en la base y nadie sin el token del bot puede
 * adivinar el hilo de otra persona. Es estable entre reinicios, que es justo lo
 * que el `Map` en RAM no hacía.
 */
function telegramThread(chatId: number): ThreadRef | null {
  if (!TELEGRAM_BOT_TOKEN) return null;
  const signature = createHmac("sha256", TELEGRAM_BOT_TOKEN)
    .update(`aitor-thread:${chatId}`)
    .digest("hex")
    .slice(0, 32);
  return { surface: "telegram", externalId: `tg_${signature}` };
}

async function loadThreadHistory(thread: ThreadRef): Promise<HistoryMessage[]> {
  try {
    const url = `${THREAD_URL}?surface=${thread.surface}&thread=${encodeURIComponent(thread.externalId)}`;
    const response = await fetch(url, {
      headers: supabaseAuthHeaders(SUPABASE_ANON_KEY),
      signal: AbortSignal.timeout(THREAD_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const data = (await response.json().catch(() => null)) as { messages?: unknown } | null;
    if (!Array.isArray(data?.messages)) return [];
    return data.messages
      .filter((item): item is HistoryMessage => {
        const msg = item as { role?: unknown; content?: unknown };
        return (
          (msg.role === "user" || msg.role === "assistant") &&
          typeof msg.content === "string" &&
          msg.content.length > 0
        );
      })
      // La ventana ya viene recortada; el tope de aquí es sólo una red de
      // seguridad por si la función devolviera más de lo que debe.
      .slice(-9);
  } catch {
    return [];
  }
}

async function saveTurn(thread: ThreadRef, user: string, assistant: string): Promise<void> {
  try {
    await fetch(THREAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...supabaseAuthHeaders(SUPABASE_ANON_KEY) },
      body: JSON.stringify({ thread, user, assistant }),
      signal: AbortSignal.timeout(THREAD_TIMEOUT_MS),
    });
  } catch {
    // La memoria es un extra: se pierde el turno, no la conversación.
  }
}

// --- Puente web <-> Telegram ---
// La web abre la Mini App con `?startapp=web` y el terminal vuelve a la web con
// `?source=telegram`; estos botones inline son la salida hacia la web desde el bot.
type TelegramInlineButton = { text: string; url: string };
type TelegramUpdate = { update_id?: number; message?: { chat?: { id: number }; text?: string } };
type TelegramReplyMarkup = { inline_keyboard: TelegramInlineButton[][] };

const BRIDGE_KEYBOARD: TelegramReplyMarkup = {
  inline_keyboard: [
    [
      { text: "🌐 Continuar en la web", url: "https://aitor.alienflow.space/?source=telegram" },
      { text: "🎮 Mini App", url: "https://t.me/Alien69Bot/app" },
    ],
  ],
};
