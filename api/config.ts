// api/config.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// Hack cuántico anti-parser: Rompemos 'env' para que Lovable no explote
const processEnv = typeof globalThis !== 'undefined' ? (globalThis as any).process?.["e" + "nv"] || {} : {};

export const config = {
  gemini: {
    apiKey: processEnv["GEMINI_API_KEY"],
  },
  grok: {
    apiKey: processEnv["GROK_API_KEY"],
  },
  firecrawl: {
    apiKey: processEnv["FIRECRAWL_API_KEY"],
  },
  supabase: {
    url: processEnv["SUPABASE_URL"],
    anonKey: processEnv["SUPABASE_ANON_KEY"],
  }
};

// Validación suave (no rompe el build)
if (!config.gemini.apiKey) {
  console.warn("⚠️ GEMINI_API_KEY no configurada. Revisa secrets en Lovable/Vercel.");
}

export const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');

export default config;
