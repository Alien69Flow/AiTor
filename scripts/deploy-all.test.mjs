import { describe, expect, it } from "vitest";
import {
  interpretGithubProxy,
  interpretMcp,
  interpretTelegram,
  planSteps,
} from "./deploy-all.mjs";

/**
 * El script de despliegue decide con qué credenciales puede trabajar y traduce
 * la respuesta de cada endpoint a "sirve o no sirve". Esa decisión no puede
 * depender de la red: si se equivoca, el despliegue se da por bueno o se aborta
 * sin motivo. Aquí se fijan las dos mitades.
 */

describe("plan de despliegue", () => {
  it("sin credenciales no inventa: marca qué falta", () => {
    const steps = planSteps({}, {});
    const supabase = steps.find((step) => step.id === "supabase");
    expect(supabase.needs).toMatch(/SUPABASE_ACCESS_TOKEN/);
  });

  it("con el token de Supabase, ese paso ya puede correr", () => {
    const steps = planSteps({ SUPABASE_ACCESS_TOKEN: "sbp_x" }, {});
    expect(steps.find((step) => step.id === "supabase").needs).toBeNull();
  });

  it("Vercel no se despliega solo: hay que pedir el empuje a main", () => {
    const sinPush = planSteps({}, {}).find((step) => step.id === "vercel");
    expect(sinPush.needs).toMatch(/--push/);
    expect(sinPush.push).toBe(false);

    const conPush = planSteps({}, { push: true }).find((step) => step.id === "vercel");
    expect(conPush.needs).toBeNull();
    expect(conPush.push).toBe(true);
  });

  it("--only deja un solo paso", () => {
    const soloSupabase = planSteps({ SUPABASE_ACCESS_TOKEN: "sbp_x" }, { only: "supabase" });
    expect(soloSupabase.map((step) => step.id)).toEqual(["supabase"]);
  });
});

describe("lectura de la salud", () => {
  it("/api/mcp: distingue sin clave de clave rota", () => {
    expect(interpretMcp(200, { ok: true, tools: 7, geminiKeyState: "missing" })).toEqual({
      ok: true,
      detail: "7 herramientas · sin clave (chat sin herramientas)",
    });
    expect(interpretMcp(200, { ok: true, tools: 7, geminiKeyState: "ok" }).detail).toContain("clave ok");
    expect(interpretMcp(500, null).ok).toBe(false);
  });

  it("Telegram: un atraso o un error de envío cuentan como fallo", () => {
    const sano = interpretTelegram(200, {
      ok: true,
      secretConfigured: true,
      webhook: { matchesExpected: true, pendingUpdates: 0, lastErrorMessage: null },
    });
    expect(sano).toEqual({ ok: true, detail: "al día · firma activa" });

    const atrasado = interpretTelegram(200, {
      ok: true,
      webhook: { matchesExpected: true, pendingUpdates: 12, lastErrorMessage: null },
    });
    expect(atrasado.ok).toBe(false);
    expect(atrasado.detail).toContain("12 pendientes");

    const malaUrl = interpretTelegram(200, {
      ok: true,
      webhook: { matchesExpected: false, pendingUpdates: 0, lastErrorMessage: null },
    });
    expect(malaUrl.detail).toContain("URL registrada distinta");
  });

  it("github-proxy: sólo el 404 significa que no está desplegada", () => {
    expect(interpretGithubProxy(404).ok).toBe(false);
    expect(interpretGithubProxy(401).ok).toBe(true);
    expect(interpretGithubProxy(400).ok).toBe(true);
    expect(interpretGithubProxy(500).ok).toBe(false);
  });
});
