import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('supabaseUrl is required. Check VITE_SUPABASE_URL environment variable.');
}
if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('supabaseKey is required. Check VITE_SUPABASE_PUBLISHABLE_KEY environment variable.');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
