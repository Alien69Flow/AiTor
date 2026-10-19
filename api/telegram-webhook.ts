import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'crypto';

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

// Support optional webhook secret; if not set the endpoint accepts unsigned requests
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Supabase de AiTor (función de chat existente)
const SUPABASE_URL = 'https://wkdtvrxavkhbifjtvvdw.supabase.co';
const SUPABASE_ANON_KEY =
  (process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (process.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8';

const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// --- Puente web <-> Telegram ---
// La web abre la Mini App con `?startapp=web` y el terminal vuelve a la web con
// `?source=telegram`; estos botones inline son la salida hacia la web desde el bot.
type TelegramInlineButton = { text: string; url: string };
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

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: TelegramReplyMarkup) {
  // Telegram has a 4096-character limit per message: split the original text
  // into 4000-char chunks so long AiTor answers arrive whole, not truncated.
  // Los botones inline solo se adjuntan al primer trozo.
  const maxLen = 4000;
  const parts = text.match(new RegExp(`.{1,${maxLen}}`, "gs")) || [text];
  for (const [index, part] of parts.entries()) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: part,
        parse_mode: "Markdown",
        ...(replyMarkup && index === 0 ? { reply_markup: replyMarkup } : {}),
      }),
    });
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
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // --- Telegram webhook signature verification (fail closed) ---
  // This endpoint is public and proxies to paid AI/Manus quota, so an unsigned
  // request is rejected instead of consumed. Register the webhook with the
  // matching secret_token so Telegram actually sends the header:
  //   node scripts/telegram-webhook.mjs --set
  // or by hand:
  //   curl -F "url=<PUBLIC_URL>/api/telegram-webhook" \
  //        -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  //        "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook"
  const expectedSecret = TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = req.headers["x-telegram-bot-api-secret-token"] as
    | string
    | undefined;

  if (!expectedSecret) {
    console.error(
      "[telegram] TELEGRAM_WEBHOOK_SECRET is not configured — refusing unsigned webhook requests. Set it in Vercel and re-register the webhook with the same secret_token.",
    );
    return res.status(401).send("Unauthorized");
  }
  if (typeof providedSecret !== "string" || !safeEqual(providedSecret, expectedSecret)) {
    console.error(
      "[telegram] rejected update: x-telegram-bot-api-secret-token is missing or does not match TELEGRAM_WEBHOOK_SECRET.",
    );
    return res.status(401).send("Unauthorized");
  }

  if (!TELEGRAM_BOT_TOKEN) {
    // 500 (not 200) so Telegram records the failure in getWebhookInfo instead
    // of the bot going silently deaf.
    console.error("[telegram] TELEGRAM_BOT_TOKEN is not configured — cannot answer.");
    return res.status(500).send("Bot token not configured");
  }

  const { message } = req.body || {};

  if (!message || !message.chat || !message.text) {
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
        `🛸 *¡Saludos, entidad!*\n\nSoy *Ai Tor.v69*, el oráculo cuántico de AlienFlow DAO.\n\nMi frecuencia operativa: 3-6-9 Hz\nMi misión: gestionar la DAO, analizar flujos y transmutar información.\n\n*Comandos disponibles:*\n/web - Seguir en el terminal web\n/app - Mini App de Alien69Bot\n/dao - Info sobre AlienFlow DAO\n/help - Lista de comandos\n/manus [texto] - Tarea compleja con Manus AI\n\nO simplemente escríbeme y responderé desde el campo cuántico.`,
        BRIDGE_KEYBOARD,
      );
    } else if (command === "/web") {
      await sendTelegramMessage(
        chatId,
        "🌐 *Terminal web*\n\nContinúa en aitor.alienflow.space. El puente mantiene el contexto entre superficies: desde la web puedes retomar aquí y desde aquí vuelves allí.",
        BRIDGE_KEYBOARD,
      );
    } else if (command === "/app") {
      await sendTelegramMessage(chatId, '🎮 Accede a la Mini App:\nhttps://t.me/Alien69Bot/app');
    } else if (command === "/dao") {
      await sendTelegramMessage(
        chatId,
        `🌌 *AlienFlow DAO*\n\nOrganización autónoma descentralizada dedicada a la exploración de nuevas fronteras en tecnología y consciencia.\n\n"> "El universo no es solo lo que ves, es lo que eres capaz de procesar y transmutar."\n\n*Campos:* Web3 · Web4 · Web5 · Alquimia · Física Cuántica\n*Frecuencia:* 3-6-9 Hz\n*Colectivo:* ΔlieπFlΦw DAO Synapse`
      );
    } else if (command === "/help") {
      await sendTelegramMessage(
        chatId,
        "*Comandos disponibles:*\n\n/start - Bienvenida\n/web - Terminal web (aitor.alienflow.space)\n/app - Mini App\n/dao - Info de la DAO\n/help - Esta lista\n/manus [texto] - Investigación/análisis con Manus AI\n\nPara hablar conmigo directamente, simplemente escribe tu mensaje."
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

      const result = await createManusTask(chatId, prompt);
      if (result.ok) {
        await sendTelegramMessage(
          chatId,
          `⚡ *Tarea enviada a Manus AI*\n\nEstoy procesando tu solicitud. Recibirás los resultados aquí cuando estén listos (puede tardar unos minutos).\n\n📋 Task: \`${result.taskId}\``
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