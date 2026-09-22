import "dotenv/config";

function read(name: string, required = false): string | undefined {
  const value = process.env[name]?.trim();
  if (!value && required) throw new Error(`${name} is required`);
  return value || undefined;
}

export interface BackendConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey?: string;
}

/**
 * Backend-only configuration. Never expose the service-role key to the browser.
 * A user access token should be preferred for user-scoped Edge Function calls.
 */
export function loadBackendConfig(): BackendConfig {
  return {
    supabaseUrl: read("SUPABASE_URL", true)!,
    supabasePublishableKey:
      read("SUPABASE_PUBLISHABLE_KEY") ?? read("SUPABASE_ANON_KEY", true)!,
    supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
