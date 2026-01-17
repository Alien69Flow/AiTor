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
    oracleIcon: '🔮',
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Ai Tor Pro",
    provider: "ΔlieπFlΦw",
    description: "Razonamiento cuántico avanzado",
    supportsVision: true,
    available: true,
    oracleType: 'advanced',
    oracleIcon: '🔮',
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o Oracle",
    provider: "Lovable AI",
    description: "Máxima precisión, multimodal",
    supportsVision: true,
    available: true,
    oracleType: 'advanced',
    oracleIcon: '⚡',
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "Lovable AI",
    description: "Balance velocidad/rendimiento",
    supportsVision: true,
    available: true,
    oracleType: 'primary',
    oracleIcon: '⚡',
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
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Razonamiento estilo o1",
    supportsVision: false,
    available: false,
    oracleType: 'external',
    oracleIcon: '🌊',
  },
  {
    id: "xai/grok-2",
    name: "Grok 2",
    provider: "xAI",
    description: "IA con acceso a X (Twitter)",
    supportsVision: true,
    available: false,
    oracleType: 'external',
    oracleIcon: '🚀',
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Creatividad y razonamiento",
    supportsVision: true,
    available: false,
    oracleType: 'external',
    oracleIcon: '🎭',
  },
];

export const getAvailableModels = () => AI_MODELS.filter(m => m.available);
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
