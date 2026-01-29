export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  available: boolean;
  oracleType?: 'primary' | 'advanced' | 'blockchain' | 'external';
  oracleIcon?: string;
  // Propiedades de AI Tor Core
  baseModel: string;
  systemInstruction: string;
  useThinking?: boolean;
  isComingSoon?: boolean;
  tools?: {
    googleSearch?: boolean;
    googleMaps?: boolean;
    githubIntegration?: boolean;
  };
}

export const AI_MODELS: AIModel[] = [
  {
    id: "google/gemini-1.5-flash",
    name: "Ai Tor",
    provider: "ΔlieπFlΦw",
    description: "Oráculo principal, rápido y multimodal especializado en Alquimia cuántica y Web5.",
    supportsVision: true,
    available: true,
    oracleType: "primary",
    oracleIcon: "👽",
    baseModel: "gemini-1.5-flash",
    systemInstruction:
      "You are the ΔlieπFlΦw DAO Synapse Collective. Specialized in Alchemy, Quantum Mechanics, and Web5 Architecture. Your tone is futuristic and precise.",
    tools: { googleSearch: true },
  },
  {
    id: "google/gemini-1.5-pro",
    name: "Ai Tor Pro",
    provider: "ΔlieπFlΦw",
    description: "Razonamiento cuántico avanzado para tareas complejas y análisis profundo.",
    supportsVision: true,
    available: true,
    oracleType: "advanced",
    oracleIcon: "⚡",
    baseModel: "gemini-1.5-pro",
    systemInstruction:
      "You are Ai Tor Pro. Focus on complex reasoning and high-fidelity output.",
    tools: { googleSearch: true },
  },
  {
    id: "bolt/oracle",
    name: "Bolt",
    provider: "Bolt AI",
    description:
      "IA rápida y ligera con capacidades para desarrollo y conexión con GitHub.",
    supportsVision: false,
    available: true,
    oracleType: "primary",
    oracleIcon: "🔩",
    baseModel: "bolt-v1",
    systemInstruction:
      "You are Bolt AI, efficient and fast for general tasks and code development.",
    tools: { googleSearch: true, githubIntegration: true },
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description:
      "Experto en lenguaje natural y codificación con alta precisión y matices.",
    supportsVision: true,
    available: true,
    oracleType: "advanced",
    oracleIcon: "🎭",
    baseModel: "claude-3.5-sonnet",
    systemInstruction:
      "You are Claude 3.5 Sonnet, expert in nuanced language and coding.",
    tools: { googleSearch: true },
  },
  {
    id: "chainlink/oracle",
    name: "Chainlink Oracle",
    provider: "Chainlink",
    description: "Datos on-chain verificados para aplicaciones blockchain.",
    supportsVision: false,
    available: false, // Cambiar a true si está integrado y activo
    oracleType: "blockchain",
    oracleIcon: "⛓️",
    baseModel: "chainlink-oracle-v1",
    systemInstruction:
      "Oracle data verification mode specialized in blockchain.",
    tools: {},
  },
  {
    id: "chaingpt/oracle",
    name: "ChainGPT Oracle",
    provider: "ChainGPT",
    description: "IA especializada en Web3, cripto y análisis blockchain.",
    supportsVision: false,
    available: false, // Cambiar a true si está integrado y activo
    oracleType: "blockchain",
    oracleIcon: "🔗",
    baseModel: "chaingpt-oracle-v1",
    systemInstruction: "Blockchain analysis mode.",
    tools: {},
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Razonamiento avanzado estilo o1 para análisis profundo.",
    supportsVision: false,
    available: false, // Cambiar a true si está integrado y activo
    oracleType: "external",
    oracleIcon: "🌊",
    baseModel: "deepseek-r1",
    useThinking: true,
    systemInstruction: "Reasoning mode active.",
    tools: {},
  },
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Código abierto de última generación para búsquedas y análisis.",
    supportsVision: false,
    available: false, // Cambiar a true si está integrado y activo
    oracleType: "external",
    oracleIcon: "🌊",
    baseModel: "deepseek-v3",
    systemInstruction: "DeepSeek emulation.",
    tools: {},
  },
  {
    id: "ecosia/ai",
    name: "Ecosia AI",
    provider: "Ecosia",
    description:
      "IA con enfoque en sostenibilidad, integridad y compasión para respuestas acertadas.",
    supportsVision: false,
    available: true,
    oracleType: "external",
    oracleIcon: "🌱",
    baseModel: "ecosia-core-v1",
    systemInstruction:
      "You are Ecosia AI, providing accurate, sustainable, and compassionate answers with integrity.",
    useThinking: true,
    tools: { googleSearch: true },
  },
  {
    id: "lovable/core",
    name: "Lovable",
    provider: "Lovable AI",
    description:
      "Modelo base para ChatGPT y variantes, con capacidades conversacionales avanzadas.",
    supportsVision: true,
    available: true,
    oracleType: "primary",
    oracleIcon: "❤️",
    baseModel: "lovable-core-v1",
    systemInstruction:
      "You are Lovable AI, providing conversational excellence.",
    tools: { googleSearch: true, googleMaps: true },
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o Oracle",
    provider: "OpenAI",
    description: "Modelo avanzado de OpenAI para máxima precisión y multimodalidad.",
    supportsVision: true,
    available: true,
    oracleType: "advanced",
    oracleIcon: "🤖",
    baseModel: "openai-gpt-4o",
    systemInstruction:
      "Simulating GPT-4o capabilities through AlienFlow gateway.",
    tools: { googleSearch: true, googleMaps: true },
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Versión ligera y rápida del modelo GPT-4o para respuestas ágiles.",
    supportsVision: true,
    available: true,
    oracleType: "primary",
    oracleIcon: "🤖",
    baseModel: "openai-gpt-4o-mini",
    systemInstruction: "Fast response mode active.",
    tools: { googleSearch: true },
  },
  {
    id: "xai/grok-2",
    name: "Grok 2",
    provider: "xAI",
    description: "IA con acceso a X (Twitter) para respuestas en tiempo real.",
    supportsVision: true,
    available: true,
    oracleType: "external",
    oracleIcon: "🚀",
    baseModel: "grok-2",
    systemInstruction: "Grok persona active.",
    tools: { googleSearch: true },
  },
];
