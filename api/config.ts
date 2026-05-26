// api/config.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  // === API KEYS ===
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY,
  },
  grok: {
    apiKey: process.env.GROK_API_KEY || import.meta.env.VITE_GROK_API_KEY,
  },
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY || import.meta.env.VITE_FIRECRAWL_API_KEY,
  },
  supabase: {
    url: process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
};

// === Inicializar Gemini (Nano Banana listo) ===
export const genAI = new GoogleGenerativeAI(config.gemini.apiKey!);

// === Exportar configuración global ===
export default config;
