import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { trackSupabaseError } from '@/lib/analytics';

/**
 * Dos proyectos, a propósito.
 *
 * La identidad vive en el proyecto que el dueño controla (`AUTH_*`): es el que
 * tiene Google configurado y devuelve el 302 real. El plano de datos —las Edge
 * Functions y las tablas que tocan— sigue en el proyecto heredado (`DATA_*`),
 * que no se puede reconfigurar porque no es nuestro.
 *
 * Esto reparte el *transporte*, no el comportamiento: `authClient` inicia
 * sesión y `supabase` habla con el backend. No se movió ninguna función ni se
 * tocó ninguna tabla, así que nada de lo que hoy funciona deja de funcionar.
 *
 * Los dos tokens no se cruzan nunca: `functions.invoke` resuelve su `Bearer`
 * desde `supabase.auth` en el momento de la llamada, y un JWT firmado por el
 * proyecto de identidad lo rechaza el gateway del de datos (401). Por eso el
 * cliente de datos se crea sin sesión y su `auth` no se usa jamás: si lo
 * necesitas, la llamada es de identidad y va por `authClient`.
 *
 * Migración completa = poner `VITE_DATA_SUPABASE_URL` y
 * `VITE_DATA_SUPABASE_PUBLISHABLE_KEY` en el proyecto nuevo. Una sola variable,
 * ningún cambio de código.
 */

/** Proyecto heredado: el que sirve hoy las Edge Functions. */
const DATA_URL_FALLBACK = 'https://wkdtvrxavkhbifjtvvdw.supabase.co';
const DATA_KEY_FALLBACK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8';

export const DATA_SUPABASE_URL =
  (import.meta.env.VITE_DATA_SUPABASE_URL as string) || DATA_URL_FALLBACK;
export const DATA_SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_DATA_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_DATA_SUPABASE_ANON_KEY as string) ||
  DATA_KEY_FALLBACK;

/**
 * Proyecto de identidad: el propio, el que tiene Google configurado.
 *
 * Nunca cae al de datos. Esa caída era el fallo: Vercel tiene la clave
 * publicable del proyecto nuevo (`sb_publishable_…`, que responde 200 en
 * `pnyi…` y 401 en `wkdt…`) pero no tiene ningún `VITE_SUPABASE_URL`, así que
 * el cliente emparejaba **clave nueva con URL vieja** y GoTrue contestaba 401.
 * Emparejar mal es peor que no emparejar: aquí la URL por defecto es la del
 * proyecto al que pertenece esa clave.
 */
const AUTH_URL_FALLBACK = 'https://pnyigikagdxqaogbiift.supabase.co';
/**
 * Clave publicable del proyecto de identidad. Pública por diseño, como la del
 * proyecto de datos que ya vivía aquí: viaja al navegador en cada visita, así
 * que no es un secreto y no puede filtrarse. Va emparejada con su URL para que
 * ningún build pueda cruzar clave y proyecto; rotarla es cambiar esta línea.
 */
const AUTH_KEY_FALLBACK =
  'sb_publishable_c4VVYw8uPzt7-24KvOre6A_91csa5Xp';

// `VITE_SUPABASE_URL` NO entra en esta cadena. En Vercel apunta al proyecto de
// datos, y al ser una constante en tiempo de compilación el minificador podía
// resolver `"" || "wkdt…" || "pnyi…"` como `"wkdt…"` y **borrar el respaldo**:
// el build quedaba con clave de un proyecto y URL de otro, y GoTrue contestaba
// 401. Identidad sólo acepta sus propias variables.
export const AUTH_SUPABASE_URL =
  (import.meta.env.VITE_AUTH_SUPABASE_URL as string) || AUTH_URL_FALLBACK;
export const AUTH_SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY as string) ||
  AUTH_KEY_FALLBACK;

/**
 * Nombres que significan «dónde viven las Edge Functions». Se mantienen porque
 * el chat, el globo y el diagnóstico los importan; nunca apuntan al proyecto
 * de identidad.
 */
export const SUPABASE_URL = DATA_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = DATA_SUPABASE_PUBLISHABLE_KEY;

/** Backend: Edge Functions y filas públicas. Sin sesión, siempre. */
export const supabase = createClient<Database>(DATA_SUPABASE_URL, DATA_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Identidad: la sesión de Google, email, OTP, wallet y las filas que pertenecen
 * al usuario (créditos). Es el único cliente que persiste sesión en el navegador.
 */
export const authClient = createClient<Database>(AUTH_SUPABASE_URL, AUTH_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
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
