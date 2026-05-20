import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// En producción, usar un KV store (Vercel KV, Redis, etc.)
// Por ahora, el chat_id se puede pasar como metadata o extraer del task
// Este endpoint recibe webhooks de Manus cuando una tarea termina

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { event_type, task_detail } = req.body || {};

    if (event_type === 'task_stopped' && task_detail) {
      const { task_id, message, stop_reason, attachments } = task_detail;

      console.log(`Manus task completed: ${task_id}, reason: ${stop_reason}`);

      // NOTA: Para enviar el resultado al chat correcto, necesitas
      // almacenar el mapeo task_id → chat_id en un KV store.
      // Por ahora, este endpoint loguea el resultado.
      // Cuando implementes el KV store, descomenta y adapta:
      //
      // const chatId = await getChatIdForTask(task_id);
      // if (chatId && message) {
      //   const truncatedMessage = message.length > 4000
      //     ? message.substring(0, 4000) + '\n\n... (resultado truncado)'
      //     : message;
      //   await sendTelegramMessage(chatId, `✅ *Resultado de Manus AI:*\n\n${truncatedMessage}`);
      // }

      console.log('Task result:', message?.substring(0, 500));
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Manus callback:', error);
    return res.status(200).send('OK');
  }
}
