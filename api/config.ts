// api/config.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  grok: {
    apiKey: process.env.GROK_API_KEY,
  },
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  }
};

// Validación suave (no rompe el build)
if (!config.gemini.apiKey) {
  console.warn("⚠️ GEMINI_API_KEY no configurada. Revisa secrets en Lovable/Vercel.");
}

export const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');

export default config;
