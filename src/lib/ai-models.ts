export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  available: boolean;
  oracleType?: 'primary' | 'advanced' | 'blockchain' | 'external';
  oracleIcon?: string;
}

export const AI_MODELS: AIModel[] = [
  // Oráculos Activos (Lovable AI Gateway)
  {
    id: "google/gemini-2.5-flash",
    name: "Ai Tor",
    provider: "ΔlieπFlΦw",
    description: "Oráculo principal, rápido y multimodal",
    supportsVision: true,
    available: true,
    oracleType: 'primary',
    oracleIcon: '⚡',
  },
  {
    id: "google/gemini-2.5-pro",
    name: "AlienFlow Pro",
    provider: "ΔlieπFlΦw",
    description: "Razonamiento cuántico avanzado",
    supportsVision: true,
    available: true,
    oracleType: 'advanced',
    oracleIcon: '👽',
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "ΔlieπFlΦw",
    description: "Nueva generación, velocidad y potencia",
    supportsVision: true,
    available: true,
    oracleType: 'primary',
    oracleIcon: '⚡',
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini Lite",
    provider: "ΔlieπFlΦw",
    description: "Ultra rápido, tareas simples",
    supportsVision: false,
    available: true,
    oracleType: 'primary',
    oracleIcon: '⚡',
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5 Oracle",
    provider: "Lovable AI",
    description: "Máxima precisión, razonamiento profundo",
    supportsVision: true,
    available: true,
    oracleType: 'advanced',
    oracleIcon: '🧠',
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "Lovable AI",
    description: "Balance velocidad/rendimiento",
    supportsVision: true,
    available: true,
    oracleType: 'primary',
    oracleIcon: '🧠',
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "Lovable AI",
    description: "Ultra rápido y económico",
    supportsVision: false,
    available: true,
    oracleType: 'primary',
    oracleIcon: '🧠',
  },
  // Grok (xAI - API key directa)
  {
    id: "xai/grok-2",
    name: "Grok 2",
    provider: "xAI",
    description: "IA con acceso a X (Twitter)",
    supportsVision: true,
    available: true,
    oracleType: 'external',
    oracleIcon: '🚀',
  },
  // Oráculos Blockchain (Próximamente)
  {
    id: "chaingpt/oracle",
    name: "ChainGPT Oracle",
    provider: "ChainGPT",
    description: "IA especializada en Web3 y cripto",
    supportsVision: false,
    available: false,
    oracleType: 'blockchain',
    oracleIcon: '🔗',
  },
  {
    id: "chainlink/oracle",
    name: "Chainlink Oracle",
    provider: "Chainlink",
    description: "Datos on-chain verificados",
    supportsVision: false,
    available: false,
    oracleType: 'blockchain',
    oracleIcon: '⛓️',
  },
  // Otros Oráculos (Próximamente - requieren API key)
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Código abierto de última generación",
    supportsVision: false,
    available: false,
    oracleType: 'external',
    oracleIcon: '🌊',
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Creatividad y razonamiento avanzado",
    supportsVision: true,
    available: true,
    oracleType: 'external',
    oracleIcon: '🎭',
  },
];

export const getAvailableModels = () => AI_MODELS.filter(m => m.available);
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
