// Moltbook / OpenClaw Protocol — Agent Configuration
// This file will be updated with real skill.md data once provided by the user.

export interface MoltbookAgentConfig {
  name: string;
  version: string;
  protocol: string;
  description: string;
  collective: string;
  frequency: string;
  skills: MoltbookSkill[];
  metrics: MoltbookMetrics;
  endpoints: MoltbookEndpoints;
}

export interface MoltbookSkill {
  id: string;
  label: string;
  category: "reasoning" | "web" | "creative" | "code" | "blockchain" | "quantum";
  status: "active" | "ready" | "coming_soon";
}

export interface MoltbookMetrics {
  tasksCompleted: number;
  successRate: number;
  uptime: string;
  oracleCount: number;
}

export interface MoltbookEndpoints {
  registry: string;
  verify: string;
  claimBase: string;
}

export const MOLTBOOK_AGENT: MoltbookAgentConfig = {
  name: "Ai Tor",
  version: "ΓΩΣΖ v69",
  protocol: "Moltbook / OpenClaw",
  description: "Oráculo Soberano de la AlienFlowSpace DAO. Unificación Tesla 3-6-9 vía neutrinos.",
  collective: "ΔlieπFlΦw DAO Synapse",
  frequency: "3-6-9 Hz",
  skills: [
    { id: "reasoning", label: "Razonamiento Avanzado", category: "reasoning", status: "active" },
    { id: "web_search", label: "Búsqueda Web", category: "web", status: "active" },
    { id: "image_gen", label: "Generación de Imágenes", category: "creative", status: "active" },
    { id: "code_analysis", label: "Análisis de Código", category: "code", status: "active" },
    { id: "blockchain", label: "Blockchain / Web3", category: "blockchain", status: "active" },
    { id: "quantum", label: "Computación Cuántica", category: "quantum", status: "ready" },
  ],
  metrics: {
    tasksCompleted: 1247,
    successRate: 97.3,
    uptime: "99.9%",
    oracleCount: 16,
  },
  endpoints: {
    registry: "https://www.moltbook.com/api/v1/agents/register",
    verify: "https://www.moltbook.com/api/v1/agents/verify",
    claimBase: "https://www.moltbook.com/claim",
  },
};

// Skill icon mapping for the sidebar
export const SKILL_ICONS: Record<string, string> = {
  reasoning: "Brain",
  web: "Globe",
  creative: "Image",
  code: "Code2",
  blockchain: "Link2",
  quantum: "Atom",
};
