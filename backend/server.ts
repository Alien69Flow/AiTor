import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SwarmOrchestrator } from './agents/orchestrator.js';
import {
  approveGeneratedPlan,
  createPlanForApproval,
  getPlanStatus,
} from './workflows/approvalApi.js';

dotenv.config();

const config = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'Quantum Swarm', modules: ['rag', 'agents', 'tools', 'workflows'] });
});

async function verifyUser(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: config.supabaseAnonKey },
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

async function requireUser(req: express.Request, res: express.Response): Promise<string | null> {
  const userId = await verifyUser(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: 'No autorizado.' });
    return null;
  }
  return userId;
}

app.post('/api/chat', async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const { message } = req.body as { message?: unknown };
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 10000) {
    res.status(400).json({ error: 'Parámetro "message" inválido (máx. 10000 caracteres).' });
    return;
  }
  try {
    const response = await SwarmOrchestrator.processMessage(userId, message);
    res.json({ response });
  } catch (error) {
    console.error('[Server Error] Falló el flujo del Swarm:', error);
    res.status(500).json({ error: 'Error interno en el enjambre de IA.' });
  }
});

app.post('/api/workflows/plans', async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const { task, capabilities } = req.body as { task?: unknown; capabilities?: unknown };
  if (typeof task !== 'string' || task.trim().length === 0 || task.length > 10000) {
    res.status(400).json({ error: 'Parámetro "task" inválido (máx. 10000 caracteres).' });
    return;
  }
  const requestedCapabilities = Array.isArray(capabilities)
    ? capabilities.filter((value): value is string => typeof value === 'string')
    : undefined;
  const result = await createPlanForApproval({ task, capabilities: requestedCapabilities, actorId: userId });
  res.status(result.ok ? 201 : 400).json(result);
});

app.post('/api/workflows/plans/:planId/approve', async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const { approvals } = req.body as { approvals?: unknown };
  if (!Array.isArray(approvals)) {
    res.status(400).json({ error: 'El campo "approvals" debe ser un array.' });
    return;
  }
  const validApprovals = approvals.filter((entry): entry is { stepId: string; approved: boolean; reason?: string } => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.stepId === 'string' && typeof candidate.approved === 'boolean'
      && (candidate.reason === undefined || typeof candidate.reason === 'string');
  });
  if (validApprovals.length !== approvals.length) {
    res.status(400).json({ error: 'Cada aprobación debe incluir stepId y approved.' });
    return;
  }
  const result = await approveGeneratedPlan(req.params.planId, userId, validApprovals);
  res.status(result.ok ? 200 : 400).json(result);
});

app.get('/api/workflows/plans/:planId', async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const result = await getPlanStatus(req.params.planId, userId);
  res.status(result.ok ? 200 : 404).json(result);
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.listen(config.port, () => console.log(`AI-TOR backend listening on port ${config.port}`));
