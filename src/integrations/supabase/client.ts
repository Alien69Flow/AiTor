import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ✅ Variables correctas
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("⚠️ [AiTor] Frecuencia Supabase no detectada:", {
    VITE_SUPABASE_URL: !!SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY,
  });
  console.warn("⚠️ Advertencia Tesla: Frecuencia Supabase no detectada. Verifica las variables de entorno.");
}

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder-key', 
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
