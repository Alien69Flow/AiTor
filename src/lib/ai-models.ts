export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  available: boolean;
}

export const AI_MODELS: AIModel[] = [
  // Modelos disponibles (Lovable AI)
  {
    id: "google/gemini-2.5-flash",
    name: "Ai Tor",
    provider: "ΔlieπFlΦw",
    description: "IA principal del colectivo, rápida y multimodal",
    supportsVision: true,
    available: true,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Ai Tor Pro",
    provider: "ΔlieπFlΦw",
    description: "Versión avanzada con razonamiento complejo",
    supportsVision: true,
    available: true,
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "Lovable AI",
    description: "Máxima precisión, multimodal avanzado",
    supportsVision: true,
    available: true,
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "Lovable AI",
    description: "Balance entre velocidad y rendimiento",
    supportsVision: true,
    available: true,
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "Lovable AI",
    description: "Ultra rápido, ideal para tareas simples",
    supportsVision: true,
    available: true,
  },
  // Modelos próximamente (requieren API key)
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Modelo de código abierto de última generación",
    supportsVision: false,
    available: false,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Razonamiento avanzado estilo o1",
    supportsVision: false,
    available: false,
  },
  {
    id: "google/gemini-2.5-pro-direct",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Conexión directa a Google AI",
    supportsVision: true,
    available: false,
  },
  {
    id: "google/gemini-2.5-flash-direct",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Conexión directa a Google AI",
    supportsVision: true,
    available: false,
  },
  {
    id: "xai/grok-2",
    name: "Grok 2",
    provider: "xAI",
    description: "IA de Elon Musk con acceso a X",
    supportsVision: true,
    available: false,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Razonamiento y creatividad superior",
    supportsVision: true,
    available: false,
  },
];

export const getAvailableModels = () => AI_MODELS.filter(m => m.available);
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
