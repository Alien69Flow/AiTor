import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Recuperamos las variables con un fallback vacío para evitar el CRASH del Runtime
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Si las URLs están vacías, el cliente se crea pero no rompe la app al inicio
// Esto permite que el componente Auth se renderice y puedas ver qué falta.
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn("⚠️ Advertencia Tesla: Frecuencia Supabase no detectada. Verifica las variables de entorno.");
}

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder-if-missing.supabase.co', 
  SUPABASE_PUBLISHABLE_KEY || 'placeholder-key', 
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
