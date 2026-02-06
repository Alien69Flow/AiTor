export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  supportsImageGen: boolean;
  available: boolean;
  oracleType: 'primary' | 'advanced' | 'quantum' | 'speed' | 'creative';
  oracleIcon: string;
  tools: {
    webSearch?: boolean;
    imageGen?: boolean;
    codeExec?: boolean;
  };
}

export const AI_MODELS: AIModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Ai Tor",
    provider: "ΔlieπFlΦw",
    description: "Oráculo principal — razonamiento rápido y multimodal.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "primary",
    oracleIcon: "👽",
    tools: { webSearch: true, codeExec: true },
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Ai Tor Pro",
    provider: "ΔlieπFlΦw",
    description: "Razonamiento cuántico profundo, contexto masivo.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "advanced",
    oracleIcon: "⚡",
    tools: { webSearch: true, codeExec: true },
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "Google",
    description: "Última generación, velocidad y eficiencia óptimas.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "speed",
    oracleIcon: "🔮",
    tools: { webSearch: true, codeExec: true },
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "Google",
    description: "Siguiente generación del motor de razonamiento más potente.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "advanced",
    oracleIcon: "🔮",
    tools: { webSearch: true, codeExec: true },
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Ai Tor Lite",
    provider: "ΔlieπFlΦw",
    description: "Ultra-rápido para tareas simples y clasificación.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "speed",
    oracleIcon: "⚡",
    tools: { webSearch: true },
  },
  {
    id: "google/gemini-2.5-flash-image",
    name: "Imagen 4.0",
    provider: "ΔlieπFlΦw",
    description: "Generación y edición de imágenes con IA.",
    supportsVision: true,
    supportsImageGen: true,
    available: true,
    oracleType: "creative",
    oracleIcon: "🎨",
    tools: { imageGen: true },
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5 Oracle",
    provider: "OpenAI",
    description: "Motor de razonamiento avanzado, multimodal y preciso.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "advanced",
    oracleIcon: "🤖",
    tools: { webSearch: true, codeExec: true },
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "OpenAI",
    description: "Balance perfecto entre rendimiento y velocidad.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "primary",
    oracleIcon: "🤖",
    tools: { webSearch: true },
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "OpenAI",
    description: "Ultra eficiente para consultas de alto volumen.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "speed",
    oracleIcon: "🤖",
    tools: { webSearch: true },
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "OpenAI",
    description: "Último modelo de OpenAI con razonamiento mejorado.",
    supportsVision: true,
    supportsImageGen: false,
    available: true,
    oracleType: "advanced",
    oracleIcon: "🧠",
    tools: { webSearch: true, codeExec: true },
  },
  {
    id: "google/gemini-3-pro-image-preview",
    name: "Imagen 4.0 Pro",
    provider: "Google",
    description: "Generación de imágenes de próxima generación.",
    supportsVision: true,
    supportsImageGen: true,
    available: true,
    oracleType: "creative",
    oracleIcon: "🎨",
    tools: { imageGen: true },
  },
];

export const getModelById = (id: string) => AI_MODELS.find(m => m.id === id);

export const getImageModel = () => AI_MODELS.find(m => m.supportsImageGen);

export const MODEL_CATEGORIES = {
  primary: { label: "Oráculos Primarios", icon: "⚡" },
  advanced: { label: "Razonamiento Avanzado", icon: "🧠" },
  speed: { label: "Velocidad Cuántica", icon: "💨" },
  creative: { label: "Generación Creativa", icon: "🎨" },
  quantum: { label: "Computación Cuántica", icon: "⚛️" },
};
