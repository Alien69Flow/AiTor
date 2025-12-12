export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  available: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Lovable AI",
    description: "Rápido y equilibrado, excelente para multimodal",
    supportsVision: true,
    available: true,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Lovable AI",
    description: "Top-tier, razonamiento complejo y contexto largo",
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
];

export const getAvailableModels = () => AI_MODELS.filter(m => m.available);
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
