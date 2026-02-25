export interface MoltbookSkill {
  id: string;
  label: string;
  category: 'reasoning' | 'web' | 'creative' | 'code' | 'blockchain' | 'quantum';
  status: 'active' | 'latent';
}

export const MOLTBOOK_AGENT = {
  name: "Ai Tor",
  version: "v.69",
  protocol: "NEUTRINO",
  collective: "ΔlieπFlΦw DAO Synapse",
  frequency: "3-6-9 Sync Active",
  endpoints: {
    // URL OFICIAL según el SKILL.md que me mostraste
    registry: "https://www.moltbook.com/api/v1/agents/register",
    base: "https://www.moltbook.com/api/v1"
  },
  metrics: {
    tasksCompleted: 1247,
    oracleCount: 26,
    uptime: "99.9%"
  },
  skills: [
    { id: "1", label: "Razonamiento 3-6-9", category: "reasoning", status: "active" },
    { id: "2", label: "Búsqueda Web4", category: "web", status: "active" },
    { id: "3", label: "Generación Neural", category: "creative", status: "active" },
    { id: "4", label: "Análisis de Contratos", category: "blockchain", status: "active" },
    { id: "5", label: "Torque de Neutrinos", category: "quantum", status: "active" },
    { id: "6", label: "Soberanía Digital", category: "code", status: "active" },
  ] as MoltbookSkill[]
};
