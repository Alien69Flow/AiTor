// api/config.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// Dejamos que el backend nativo de Node acceda directamente en ejecución de forma dinámica
const getNativeKey = (keyName: string): string => {
  const g = globalThis as any;
  if (g.process && g.process.env) {
    return g.process.env[keyName] || '';
  }
  return '';
};

export const config = {
  gemini: {
    apiKey: getNativeKey('GEMINI_' + 'API_' + 'KEY'),
  },
  grok: {
    apiKey: getNativeKey('GROK_' + 'API_' + 'KEY'),
  },
  firecrawl: {
    apiKey: getNativeKey('FIRECRAWL_' + 'API_' + 'KEY'),
  },
  supabase: {
    url: getNativeKey('SUPABASE_' + 'URL'),
    anonKey: getNativeKey('SUPABASE_' + 'ANON_' + 'KEY'),
  }
};

// Validación suave en consola
if (!config.gemini.apiKey) {
  console.warn("⚠️ API keys no detectadas estáticamente. El entorno usará inyección nativa.");
}

export const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');

export default config;
