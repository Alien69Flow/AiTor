import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://avuflwehgtcstrejqdyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dWZsd2VoZ3Rjc3RyZWpxZHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDUyNjIsImV4cCI6MjA4NjU4MTI2Mn0.2e8GpmZ7lgU9j9CJbk9ZO0RVoq_XFj1v0nvSI2lw61U";

export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
