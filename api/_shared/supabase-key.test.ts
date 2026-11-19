import { describe, expect, it } from "vitest";
import { isJwt, keyKindOf, pickSupabaseKey, supabaseAuthHeaders } from "./supabase-key";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma-de-prueba-suficientemente-larga";
const PUBLISHABLE = "sb_publishable_abc123";

describe("pickSupabaseKey", () => {
  it("prefiere la JWT anon a una clave publicable", () => {
    const picked = pickSupabaseKey({
      VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      VITE_SUPABASE_ANON_KEY: JWT,
    });
    expect(picked.key).toBe(JWT);
    expect(picked.source).toBe("VITE_SUPABASE_ANON_KEY");
    expect(picked.kind).toBe("jwt");
  });

  it("usa la JWT del código cuando las variables no tienen ninguna válida", () => {
    const picked = pickSupabaseKey({ VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE }, JWT);
    expect(picked.key).toBe(JWT);
    expect(picked.source).toBe("codigo");
  });

  it("si no hay JWT, acepta la publicable y lo dice", () => {
    const picked = pickSupabaseKey({ VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE });
    expect(picked.key).toBe(PUBLISHABLE);
    expect(picked.kind).toBe("publishable");
    expect(picked.source).toBe("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("sin nada, devuelve vacío en vez de inventar", () => {
    const picked = pickSupabaseKey({});
    expect(picked.kind).toBe("empty");
    expect(picked.key).toBe("");
  });
});

describe("supabaseAuthHeaders", () => {
  it("manda Bearer sólo con una JWT", () => {
    expect(supabaseAuthHeaders(JWT)).toEqual({ apikey: JWT, Authorization: `Bearer ${JWT}` });
  });

  it("con una clave publicable no manda Bearer (era el 401)", () => {
    expect(supabaseAuthHeaders(PUBLISHABLE)).toEqual({ apikey: PUBLISHABLE });
    expect(supabaseAuthHeaders(PUBLISHABLE).Authorization).toBeUndefined();
  });

  it("sin clave no manda nada", () => {
    expect(supabaseAuthHeaders("")).toEqual({});
  });
});

describe("keyKindOf", () => {
  it("distingue JWT, publicable y resto", () => {
    expect(keyKindOf(JWT)).toBe("jwt");
    expect(keyKindOf(PUBLISHABLE)).toBe("publishable");
    expect(keyKindOf("algo-raro")).toBe("other");
    expect(keyKindOf("")).toBe("empty");
    expect(isJwt("a.b.c")).toBe(false);
  });
});
