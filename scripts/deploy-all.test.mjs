import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DB_PROJECT_REF,
  FUNCTIONS_PROJECT_REF,
  interpretGithubProxy,
  interpretMcp,
  interpretTelegram,
  interpretVercel,
  planSteps,
  projectRefFromConfig,
} from "./deploy-all.mjs";

/**
 * El script de despliegue decide con qué credenciales puede trabajar, a qué
 * proyecto va cada cosa y traduce la respuesta de cada endpoint a "sirve o no
 * sirve". Esa decisión no puede depender de la red: si se equivoca, el
 * despliegue se da por bueno o se aborta sin motivo. Aquí se fijan las tres
 * mitades.
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
    expect(steps.find((step) => step.id === "migrations").needs).toBeNull();
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

    const soloMigraciones = planSteps({ SUPABASE_ACCESS_TOKEN: "sbp_x" }, { only: "migrations" });
    expect(soloMigraciones.map((step) => step.id)).toEqual(["migrations"]);
  });
});

describe("migraciones y project-ref", () => {
  it("el ref de las migraciones sale de supabase/config.toml", () => {
    const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
    expect(DB_PROJECT_REF).toBe(projectRefFromConfig(config));
  });

  it("lee project_id y no otra clave del TOML", () => {
    expect(projectRefFromConfig('project_id = "pnyigikagdxqaogbiift"')).toBe("pnyigikagdxqaogbiift");
    expect(projectRefFromConfig('  project_id = "abc123"\n[db]\nport = 54322')).toBe("abc123");
    expect(projectRefFromConfig("[db]\nport = 54322")).toBeNull();
    expect(projectRefFromConfig("")).toBeNull();
  });

  it("las migraciones van a las tablas y la función a donde se invoca", () => {
    const steps = planSteps({ SUPABASE_ACCESS_TOKEN: "sbp_x" }, {});
    const migrations = steps.find((step) => step.id === "migrations").command.flat();
    const funciones = steps.find((step) => step.id === "supabase").command.flat();

    expect(migrations).toContain("db");
    expect(migrations).toContain("push");
    expect(migrations).toContain(DB_PROJECT_REF);
    expect(funciones).toContain("functions");
    expect(funciones).toContain(FUNCTIONS_PROJECT_REF);
    // La función sigue en el proyecto heredado: unificar los dos refs la
    // desplegaría donde el cliente no la llama (404 comprobado el 2026-11-13).
    expect(FUNCTIONS_PROJECT_REF).not.toBe("");
  });

  it("el esquema va antes del empuje a main", () => {
    const ids = planSteps({ SUPABASE_ACCESS_TOKEN: "sbp_x" }, { push: true }).map((step) => step.id);
    expect(ids[0]).toBe("migrations");
    expect(ids.indexOf("migrations")).toBeLessThan(ids.indexOf("vercel"));
    expect(ids.indexOf("vercel")).toBeLessThan(ids.indexOf("supabase"));
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

  it("Vercel en pending no cuenta como desplegado", () => {
    const pending = interpretVercel({ state: "pending", description: "Deployment has started" });
    expect(pending.ok).toBe(false);
    expect(pending.pending).toBe(true);
    expect(interpretVercel(null).ok).toBe(false);
    expect(interpretVercel(undefined).pending).toBe(true);

    expect(interpretVercel({ state: "success", description: "Deployment has completed" }).ok).toBe(true);
    expect(interpretVercel({ state: "failure" }).ok).toBe(false);
    expect(interpretVercel({ state: "error" }).pending).toBe(false);
  });
});
