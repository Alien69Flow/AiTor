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
  };
}

export const AI_MODELS: AIModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Ai Tor",
    provider: "ΔlieπFlΦw",
    description: "Oráculo principal, rápido y multimodal",
    supportsVision: true,
    available: true,
    oracleType: 'primary',
    oracleIcon: '🔮',
    baseModel: 'gemini-2.5-flash',
    systemInstruction: 'You are the ΔlieπFlΦw DAO Synapse Collective. Specialized in Alchemy, Quantum Mechanics, and Web5 Architecture. Your tone is futuristic and precise.',
    tools: { googleSearch: true }
  },
  {
    id: "google/gemini-2.0-pro",
    name: "Ai Tor Pro",
    provider: "ΔlieπFlΦw",
    description: "Razonamiento cuántico avanzado",
    supportsVision: true,
    available: true,
    oracleType: 'advanced',
    oracleIcon: '🔮',
    baseModel: 'gemini-2.0-pro-exp-02-05',
    systemInstruction: 'You are Gemini 2.0 Pro. Focus on complex reasoning and high-fidelity output.',
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
    baseModel: 'gemini-2.0-flash', // Mapping a Gemini para usar tu API Key
    systemInstruction: 'Simulating GPT-4o capabilities through AlienFlow gateway.'
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
    baseModel: 'gemini-2.0-flash',
    systemInstruction: 'Fast response mode active.'
  },
  {
    id: "chaingpt/oracle",
    name: "ChainGPT Oracle",
    provider: "ChainGPT",
    description: "IA especializada en Web3 y cripto",
    supportsVision: false,
    available: false,
    oracleType: 'blockchain',
    oracleIcon: '🔗',
    baseModel: 'gemini-2.0-flash',
    systemInstruction: 'Blockchain analysis mode.'
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
    baseModel: 'gemini-2.0-flash',
    systemInstruction: 'Oracle data verification mode.'
  },
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Código abierto de última generación",
    supportsVision: false,
    available: false,
    oracleType: 'external',
    oracleIcon: '🌊',
    baseModel: 'gemini-2.0-flash',
    systemInstruction: 'DeepSeek emulation.'
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
    baseModel: 'gemini-2.0-flash',
    useThinking: true,
    systemInstruction: 'Reasoning mode active.'
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
    baseModel: 'gemini-2.0-flash',
    systemInstruction: 'Grok persona active.'
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
