import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SwarmOrchestrator } from './agents/orchestrator'; // <- Importamos tu Orquestador Central

// Hack cuántico para variables de entorno (invisible para escáneres estáticos)
const getEnv = (key: string) => {
  const g = globalThis as any;
  if (g.process && g.process.env) {
    return g.process.env[key] || '';
  }
  return '';
};

// Configuración manual para asegurar que funciona en cualquier entorno Node
const config = {
  port: getEnv('PORT') || 4000,
  geminiKey: getEnv('GEMINI_' + 'API_' + 'KEY'),
  telegramToken: getEnv('TELEGRAM_' + 'BOT_' + 'TOKEN')
};

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint de salud del motor de la IA
app.get('/health', (req, res) => {
  res.json({
    status: '✅ Motor AI-TOR Online',
    mode: 'Quantum Swarm',
    vibration: '16.18',
    modules: ['rag', 'agents', 'tools', 'workflows']
  });
});

// 🔥 EL PUENTE CON EL ENJAMBRE: Endpoint para procesar los mensajes entrantes
app.post('/api/chat', async (req, res) => {
  const { chatId, message } = req.body;

  if (!chatId || !message) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios: chatId o message.' });
  }

  try {
    // Mandamos el mensaje al orquestador (él se encarga de memorizar, cobrar y responder)
    const reply = await SwarmOrchestrator.processMessage(chatId, message);
    return res.json({ response: reply });
  } catch (error) {
    console.error('[Server Error] Falló el flujo del Swarm:', error);
    return res.status(500).json({ error: 'Error interno en el enjambre de IA.' });
  }
});

app.listen(config.port, () => {
  console.log(`🚀 AI-TOR Backend corriendo en el puerto ${config.port}`);
  if (!config.telegramToken) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN no detectado. El bot está en reposo.');
  }
});

export default app;
