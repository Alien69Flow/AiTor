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

app.get('/health', (req, res) => {
  res.json({ 
    status: '✅ Ai Tor ΔlieπFlΦw $pac€ DAO ONLINE',
    mode: 'agentic',
    llms: ['gemini', 'grok']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Ai Tor Backend corriendo en puerto ${PORT}`);
});

export default app;
