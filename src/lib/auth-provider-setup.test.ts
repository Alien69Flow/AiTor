import { describe, expect, it } from "vitest";
import { GOTRUE_PROVIDER, SOCIAL_PROVIDERS } from "@/hooks/useAuth";
import { PROVIDER_SETUP, SUPABASE_CALLBACK } from "./auth-provider-setup";

/**
 * The panel that explains how to enable each provider is only as useful as its
 * coverage: a provider offered on the login page but missing from the setup
 * table would be a dead button with no instructions. This guards that gap.
 */
describe("auth-provider-setup", () => {
  it("explica cómo activar todos los proveedores que ofrece el acceso", () => {
    expect(Object.keys(PROVIDER_SETUP).sort()).toEqual([...SOCIAL_PROVIDERS].sort());

    for (const provider of SOCIAL_PROVIDERS) {
      const setup = PROVIDER_SETUP[provider];
      expect(setup.console.length).toBeGreaterThan(3);
      expect(setup.need.length).toBeGreaterThan(3);
      // Every path must point at the Supabase dashboard, where it is fixed.
      expect(setup.path).toMatch(/Authentication →/);
      expect(["sinRevision", "conRevision", "requiereCuenta"]).toContain(setup.effort);
    }
  });

  it("usa el callback de este proyecto, no un host de ejemplo", () => {
    expect(SUPABASE_CALLBACK).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co\/auth\/v1\/callback$/);
    expect(SUPABASE_CALLBACK).not.toMatch(/example|localhost/);
  });

  it("mantiene los identificadores de GoTrue distintos entre proveedores", () => {
    const ids = SOCIAL_PROVIDERS.map((provider) => GOTRUE_PROVIDER[provider]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
