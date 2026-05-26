// api/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import config from './config.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Ai Tor ΔlieπFlΦw $pac€ DAO ONLINE',
    timestamp: new Date().toISOString(),
    version: '0.1.0-agentic'
  });
});

// Aquí irán las rutas de workflows, agents, etc.
app.get('/api/status', (req, res) => {
  res.json({
    llms: ['gemini', 'grok'],
    tools: ['firecrawl'],
    mode: 'agentic'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Ai Tor Server corriendo en http://localhost:${PORT}`);
  console.log(`🔥 ΔlieπFlΦw $pac€ DAO Mode: ACTIVATED\n`);
});

export default app;
