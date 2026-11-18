export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  /**
   * `false` sólo cuando la función `chat` no tiene ruta para este modelo
   * (ChainGPT y Chainlink todavía no están enrutados). Es un hecho del
   * catálogo, no una promesa de que responda.
   *
   * Aquí no hay campo `available`: si un modelo puede contestar lo dice el
   * servidor en `chat?health=1` y lo cruza `resolveOracles()`. Un
   * `available: true` escrito a mano era una afirmación sin evidencia, y con
   * una clave revocada el modelo seguía apareciendo vivo.
   */
  routable?: boolean;
  oracleType?: 'primary' | 'advanced' | 'blockchain' | 'external';
  oracleIcon?: string;
  contextWindow?: string;
  speed?: 'instant' | 'fast' | 'medium' | 'slow';
  recommended?: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Ai Tor",
    provider: "ΔlieπFlΦw",
    description: "Oráculo principal, rápido y multimodal",
    supportsVision: true,
    oracleType: 'primary',
    oracleIcon: '⚡',
    contextWindow: '1M',
    speed: 'fast',
    recommended: true,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "AlienFlow Pro",
    provider: "ΔlieπFlΦw",
    description: "Razonamiento cuántico avanzado",
    supportsVision: true,
    oracleType: 'advanced',
    oracleIcon: '👽',
    contextWindow: '1M',
    speed: 'medium',
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "ΔlieπFlΦw",
    description: "Nueva generación, velocidad y potencia",
    supportsVision: true,
    oracleType: 'primary',
    oracleIcon: '⚡',
    contextWindow: '1M',
    speed: 'fast',
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini Lite",
    provider: "ΔlieπFlΦw",
    description: "Ultra rápido, tareas simples",
    supportsVision: false,
    oracleType: 'primary',
    oracleIcon: '⚡',
    contextWindow: '1M',
    speed: 'instant',
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5 Oracle",
    provider: "Lovable AI",
    description: "Máxima precisión, razonamiento profundo",
    supportsVision: true,
    oracleType: 'advanced',
    oracleIcon: '🧠',
    contextWindow: '128K',
    speed: 'slow',
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "Lovable AI",
    description: "Balance velocidad/rendimiento",
    supportsVision: true,
    oracleType: 'primary',
    oracleIcon: '🧠',
    contextWindow: '128K',
    speed: 'fast',
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "Lovable AI",
    description: "Ultra rápido y económico",
    supportsVision: false,
    oracleType: 'primary',
    oracleIcon: '🧠',
    contextWindow: '128K',
    speed: 'instant',
  },
  {
    id: "xai/grok-2",
    name: "Grok 2",
    provider: "xAI",
    description: "IA con acceso a X (Twitter)",
    supportsVision: true,
    oracleType: 'external',
    oracleIcon: '🚀',
    contextWindow: '128K',
    speed: 'fast',
  },
  {
    id: "chaingpt/oracle",
    name: "ChainGPT Oracle",
    provider: "ChainGPT",
    description: "IA especializada en Web3 y cripto",
    supportsVision: false,
    routable: false,
    oracleType: 'blockchain',
    oracleIcon: '🔗',
    contextWindow: '32K',
    speed: 'medium',
  },
  {
    id: "chainlink/oracle",
    name: "Chainlink Oracle",
    provider: "Chainlink",
    description: "Datos on-chain verificados",
    supportsVision: false,
    routable: false,
    oracleType: 'blockchain',
    oracleIcon: '⛓️',
    contextWindow: '—',
    speed: 'medium',
  },
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Código abierto de última generación",
    supportsVision: false,
    oracleType: 'external',
    oracleIcon: '🌊',
    contextWindow: '64K',
    speed: 'medium',
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Creatividad y razonamiento avanzado",
    supportsVision: true,
    oracleType: 'external',
    oracleIcon: '🎭',
    contextWindow: '200K',
    speed: 'medium',
  },
];

export const DEFAULT_MODEL = "google/gemini-2.5-flash";
