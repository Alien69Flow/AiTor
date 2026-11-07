import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateGate } from "./auth-providers-gate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const row = (id, state, detail = "") => ({
  method: { id, label: id, panel: `Authentication → Providers → ${id}` },
  result: { state, detail },
});

/**
 * The gate is what stops the October regression from happening twice: Google and
 * Apple stayed "enabled" for a day while every click ended in a 400. Each case
 * below is one way that state can look from the outside.
 */
describe("auth providers gate", () => {
  it("falla cuando un proveedor está encendido sin credenciales", () => {
    const gate = evaluateGate({ rows: [row("google", "sin-credenciales")], today: "2026-10-20" });

    expect(gate.ok).toBe(false);
    expect(gate.failures.map((f) => f.kind)).toEqual(["missing-secret"]);
    expect(gate.failures[0].panel).toContain("Providers → google");
  });

  it("no falla por los proveedores que nadie encendió", () => {
    const gate = evaluateGate({
      rows: [row("github", "apagado"), row("discord", "apagado")],
      today: "2026-10-20",
    });

    expect(gate.ok).toBe(true);
    expect(gate.failures).toEqual([]);
    expect(gate.warnings).toEqual([]);
  });

  it("acepta una excepción registrada mientras no haya caducado", () => {
    const baseline = { providers: { google: { expires: "2026-11-19", reason: "pendiente" } } };
    const gate = evaluateGate({ rows: [row("google", "sin-credenciales")], baseline, today: "2026-10-20" });

    expect(gate.ok).toBe(true);
    expect(gate.warnings[0].kind).toBe("acknowledged");
    expect(gate.warnings[0].message).toContain("30 días");
  });

  it("falla en el mismo día de vencimiento un día después, no antes", () => {
    const baseline = { providers: { apple: { expires: "2026-11-19" } } };

    expect(evaluateGate({ rows: [row("apple", "sin-credenciales")], baseline, today: "2026-11-19" }).ok).toBe(true);

    const expired = evaluateGate({ rows: [row("apple", "sin-credenciales")], baseline, today: "2026-11-20" });
    expect(expired.ok).toBe(false);
    expect(expired.failures[0].kind).toBe("expired-ack");
  });

  it("avisa cuando la excepción ya no hace falta", () => {
    const baseline = { providers: { google: { expires: "2026-11-19" } } };
    const gate = evaluateGate({ rows: [row("google", "ready")], baseline, today: "2026-10-20" });

    expect(gate.ok).toBe(true);
    expect(gate.warnings[0].kind).toBe("stale-ack");
  });

  it("falla cuando un proveedor responde algo que no se entiende", () => {
    const gate = evaluateGate({ rows: [row("x", "error", "HTTP 500")], today: "2026-10-20" });

    expect(gate.ok).toBe(false);
    expect(gate.failures[0].kind).toBe("probe-error");
  });

  it("avisa de entradas del baseline que no corresponden a ningún proveedor", () => {
    const gate = evaluateGate({
      rows: [row("google", "ready")],
      baseline: { providers: { myspace: { expires: "2026-11-19" } } },
      today: "2026-10-20",
    });

    expect(gate.ok).toBe(true);
    expect(gate.warnings.map((w) => w.kind)).toContain("unknown-ack");
  });

  it("el baseline del repositorio tiene fechas válidas y motivos escritos", () => {
    const baseline = JSON.parse(readFileSync(resolve(root, "scripts/auth-providers.baseline.json"), "utf8"));

    for (const [id, entry] of Object.entries(baseline.providers)) {
      expect(id).toMatch(/^[a-z_]+$/);
      expect(entry.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });
});
