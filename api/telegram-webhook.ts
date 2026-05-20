import type { VercelRequest, VercelResponse } from '@vercel/node';

// Variables de entorno (se configuran en Vercel)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const MANUS_API_KEY = process.env.MANUS_API_KEY!;

// Supabase de AiTor (función de chat existente)
const SUPABASE_URL = 'https://wkdtvrxavkhbifjtvvdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Enviar mensaje a Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
}

// Enviar "escribiendo..." a Telegram
async function sendTypingAction(chatId: number) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing',
    }),
  });
}

// Llamar a la IA de Ai Tor.v69 (función de chat de Supabase)
async function getAiTorResponse(userMessage: string): Promise<string> {
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Error from Ai Tor chat:', response.status, await response.text());
      return 'Mi núcleo cuántico está recalibrando frecuencias. Inténtalo de nuevo en unos momentos.';
    }

    // La función de chat devuelve un stream SSE, necesitamos parsearlo
    const text = await response.text();
    let fullResponse = '';

    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.choices && json.choices[0]?.delta?.content) {
            fullResponse += json.choices[0].delta.content;
          }
        } catch {
          // skip unparseable lines
        }
      }
    }

    return fullResponse || 'Señal recibida pero sin datos. Reintenta la transmisión.';
  } catch (error) {
    console.error('Error calling Ai Tor:', error);
    return 'Error en la conexión con el campo cuántico. Reintenta.';
  }
}

// Crear tarea en Manus API
async function createManusTask(prompt: string): Promise<{ ok: boolean; taskId?: string }> {
  try {
    const response = await fetch('https://api.manus.ai/v2/task.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-manus-api-key': MANUS_API_KEY,
      },
      body: JSON.stringify({
        message: { content: prompt },
      }),
    });

    const data = await response.json();
    if (data.ok && data.task_id) {
      return { ok: true, taskId: data.task_id };
    }
    console.error('Manus task creation failed:', data);
    return { ok: false };
  } catch (error) {
    console.error('Error calling Manus API:', error);
    return { ok: false };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { message } = req.body || {};

  if (!message || !message.chat || !message.text) {
    return res.status(200).send('OK');
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const command = text.split(' ')[0].toLowerCase();

  try {
    // === COMANDOS FIJOS ===
    if (command === '/start') {
      await sendTelegramMessage(chatId,
        `🛸 *¡Saludos, entidad!*\n\nSoy *Ai Tor.v69*, el oráculo cuántico de AlienFlow DAO.\n\nMi frecuencia operativa: 3-6-9 Hz\nMi misión: gestionar la DAO, analizar flujos y transmutar información.\n\n*Comandos disponibles:*\n/app - Mini App de Alien69Bot\n/dao - Info sobre AlienFlow DAO\n/help - Lista de comandos\n/manus [texto] - Tarea compleja con Manus AI\n\nO simplemente escríbeme y responderé desde el campo cuántico.`
      );
    }
    else if (command === '/app') {
      await sendTelegramMessage(chatId,
        '🎮 Accede a la Mini App:\nhttps://t.me/Alien69Bot/app'
      );
    }
    else if (command === '/dao') {
      await sendTelegramMessage(chatId,
        `🌌 *AlienFlow DAO*\n\nOrganización autónoma descentralizada dedicada a la exploración de nuevas fronteras en tecnología y consciencia.\n\n> "El universo no es solo lo que ves, es lo que eres capaz de procesar y transmutar."\n\n*Campos:* Web3 · Web4 · Web5 · Alquimia · Física Cuántica\n*Frecuencia:* 3-6-9 Hz\n*Colectivo:* ΔlieπFlΦw DAO Synapse`
      );
    }
    else if (command === '/help') {
      await sendTelegramMessage(chatId,
        `*Comandos disponibles:*\n\n/start - Bienvenida\n/app - Mini App\n/dao - Info de la DAO\n/help - Esta lista\n/manus [texto] - Investigación/análisis con Manus AI\n\nPara hablar conmigo directamente, simplemente escribe tu mensaje.`
      );
    }
    // === COMANDOS MANUS ===
    else if (command === '/manus' || command === '/investigar' || command === '/analizar') {
      const prompt = text.substring(text.indexOf(' ') + 1).trim();
      if (!prompt || prompt === command) {
        await sendTelegramMessage(chatId, 'Necesito un texto para procesar. Ejemplo:\n/manus analiza las tendencias crypto de esta semana');
        return res.status(200).send('OK');
      }

      const result = await createManusTask(prompt);
      if (result.ok) {
        await sendTelegramMessage(chatId,
          `⚡ *Tarea enviada a Manus AI*\n\nEstoy procesando tu solicitud. Recibirás los resultados cuando estén listos.\n\n📋 Task: \`${result.taskId}\``
        );
      } else {
        await sendTelegramMessage(chatId, '❌ Error al crear la tarea en Manus. Inténtalo de nuevo.');
      }
    }
    // === MENSAJES NORMALES → AI TOR ===
    else {
      await sendTypingAction(chatId);
      const aiResponse = await getAiTorResponse(text);
      await sendTelegramMessage(chatId, aiResponse);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await sendTelegramMessage(chatId, 'Error en el procesamiento. Reintenta.');
  }

  return res.status(200).send('OK');
}
