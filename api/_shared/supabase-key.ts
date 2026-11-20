/**
 * Qué clave de Supabase usa el servidor para hablar con la función `chat`.
 *
 * El webhook cogía `VITE_SUPABASE_PUBLISHABLE_KEY` antes que nada, y en Vercel
 * había ahí una `sb_publishable_…`. El gateway de Supabase contesta a esa clave
 * con 401 «Invalid API key», así que el bot estuvo días sin poder responder
 * mientras el código, la base y el token estaban bien. La causa no era la
 * variable: era el orden en que se elegía.
 *
 * Reglas, en orden:
 *  1. Una JWT anon de verdad (`VITE_SUPABASE_ANON_KEY` o `SUPABASE_ANON_KEY`).
 *  2. La JWT anon que vive en el repo, que es pública y se sabe buena.
 *  3. Sólo si no hay ninguna JWT, una clave nueva (`sb_publishable_…`), que
 *     sirve como `apikey` pero no como `Bearer`.
 *
 * El módulo no loguea ni devuelve la clave: sólo su procedencia y su forma.
 */

export type SupabaseKeyKind = "jwt" | "publishable" | "other" | "empty";

/**
 * La JWT anon del proyecto de AiTor. Es pública por diseño (viaja en el bundle
 * web) y es el último recurso cuando Vercel no tiene ninguna JWT válida. Vive
 * aquí, y no en cada endpoint, para que no vuelvan a aparecer dos copias que se
 * desincronicen: el webhook y `/api/health` tienen que elegir la misma clave.
 */
export const AITOR_ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHR2cnhhdmtoYmlmanR2dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDAzMjgsImV4cCI6MjA4MDg3NjMyOH0.9L-59tbpbK564ZaObEtgF70IUKwL6IR2VF2VLYBhSt8";

/** Una JWT tiene tres partes y es larga; una `sb_publishable_…`, no. */
export function isJwt(key: string): boolean {
  if (!key) return false;
  const parts = key.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0) && key.length > 40;
}

export function keyKindOf(key: string): SupabaseKeyKind {
  if (!key) return "empty";
  if (isJwt(key)) return "jwt";
  if (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) return "publishable";
  return "other";
}

const JWT_VARS = ["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"] as const;
const NEW_KEY_VARS = ["VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY"] as const;

export interface PickedKey {
  key: string;
  /** Nombre de la variable de la que salió, o "codigo" / "ninguna". */
  source: string;
  kind: SupabaseKeyKind;
}

/**
 * `fallbackJwt` es la JWT anon del repositorio: pública, y la única forma de que
 * el despliegue siga hablando con Supabase cuando las variables de Vercel no
 * tienen ninguna válida.
 */
export function pickSupabaseKey(
  env: Record<string, string | undefined>,
  fallbackJwt = "",
): PickedKey {
  for (const name of JWT_VARS) {
    const value = (env[name] ?? "").trim();
    if (isJwt(value)) return { key: value, source: name, kind: "jwt" };
  }
  if (isJwt(fallbackJwt.trim())) {
    return { key: fallbackJwt.trim(), source: "codigo", kind: "jwt" };
  }
  for (const name of NEW_KEY_VARS) {
    const value = (env[name] ?? "").trim();
    if (value) return { key: value, source: name, kind: keyKindOf(value) };
  }
  for (const name of JWT_VARS) {
    const value = (env[name] ?? "").trim();
    if (value) return { key: value, source: name, kind: keyKindOf(value) };
  }
  return { key: "", source: "ninguna", kind: "empty" };
}

/**
 * Cabeceras para el gateway de Supabase y para la función `chat`.
 *
 * `apikey` va siempre; `Authorization: Bearer` sólo con una JWT, porque mandar
 * una clave `sb_publishable_…` como Bearer es justo lo que devolvía 401.
 */
export function supabaseAuthHeaders(key: string): Record<string, string> {
  if (!key) return {};
  return isJwt(key)
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}
