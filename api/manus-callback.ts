import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const MANUS_API_KEY = process.env.MANUS_API_KEY!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(chatId: number, text: string) {
  const maxLen = 4000;
  if (text.length > maxLen) {
    const parts = text.match(/.{1,4000}/gs) || [text];
    for (const part of parts) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: part,
          parse_mode: 'Markdown',
        }),
      });
    }
  } else {
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
}

async function getChatIdFromTask(taskId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.manus.ai/v2/task.listMessages?task_id=${taskId}&order=asc&limit=1`,
      {
        headers: {
          'x-manus-api-key': MANUS_API_KEY,
        },
      }
    );
    const data = await response.json();
    if (data.ok && data.data && data.data.length > 0) {
      for (const event of data.data) {
        if (event.type === 'user_message' && event.user_message?.content) {
          const match = event.user_message.content.match(/\[TELEGRAM_CHAT_ID:(\d+)\]/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching task messages:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const { event_type, task_detail } = req.body || {};
    console.log(`Manus webhook received: ${event_type}, task: ${task_detail?.task_id}`);
    if (event_type === 'task_stopped' && task_detail) {
      const { task_id, message, stop_reason, attachments } = task_detail;
      const chatId = await getChatIdFromTask(task_id);
      if (chatId) {
        if (stop_reason === 'finish' && message) {
          let resultText = `✅ *Resultado de Manus AI:*\n\n${message}`;
          if (attachments && attachments.length > 0) {
            resultText += '\n\n📎 *Archivos adjuntos:*';
            for (const att of attachments) {
              resultText += `\n• [${att.file_name}](${att.url})`;
            }
          }
          await sendTelegramMessage(chatId, resultText);
        } else if (stop_reason === 'ask' && message) {
          await sendTelegramMessage(chatId,
            `🤔 *Manus AI necesita más información:*\n\n${message}\n\n_Responde con /manus seguido de tu respuesta._`
          );
        }
      } else {
        console.log(`No se pudo encontrar chat_id para task ${task_id}`);
      }
    }
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Manus callback:', error);
    return res.status(200).send('OK');
  }
}
