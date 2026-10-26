import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { trackSupabaseError } from '@/lib/analytics';

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://wkdtvrxavkhbifjtvvdw.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8';

// Plain localStorage: the session belongs to this origin. The Lovable preview
// broker that re-exported it to the editor's iframe is gone with the rest of
// that integration, and it never activated outside `*.lovable.app` hosts.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Route every Edge Function failure to analytics in one place, so the owner can
// see which backend calls users actually hit errors on. Behaviour is unchanged:
// the original result (error included) is always returned to the caller.
type InvokeFn = typeof supabase.functions.invoke;
const invokeUntracked = supabase.functions.invoke.bind(supabase.functions) as InvokeFn;
supabase.functions.invoke = (async (...args: Parameters<InvokeFn>) => {
  const result = await invokeUntracked(...args);
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    trackSupabaseError(String(args[0]), result.error);
  }
  return result;
}) as InvokeFn;
