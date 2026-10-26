import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classify,
  declaredInConfig,
  functionsOnDisk,
  interpretProbe,
  readLedger,
} from "./retire-functions.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");

const refs = (code = [], docs = []) => ({ code, docs });

/**
 * Retirar una función es irreversible en producción, así que la decisión de
 * "esto sobra" tiene que ser reproducible. Cada caso de aquí es una forma en la
 * que una sonda puede engañar al operador.
 */
describe("sondas de función desplegada", () => {
  it("el 404 de la plataforma significa que no está desplegada", () => {
    const result = interpretProbe(
      404,
      '{"code":"NOT_FOUND","message":"Requested function was not found"}',
    );
    expect(result.deployed).toBe(false);
  });

  it("un 404 de la propia función no se da por bueno", () => {
    // La función existe y responde 404 por una ruta interna: borrarla por esto
    // sería un falso negativo.
    const result = interpretProbe(404, '{"error":"event not found"}');
    expect(result.deployed).toBe("ambiguous");
  });

  it("cualquier respuesta de la función cuenta como desplegada", () => {
    for (const status of [200, 400, 401, 403, 405, 429, 500]) {
      expect(interpretProbe(status, "{}").deployed, `HTTP ${status}`).toBe(true);
    }
  });

  it("un timeout no es una prueba de nada", () => {
    expect(interpretProbe(0, "sin respuesta (timeout)").deployed).toBe("unknown");
  });
});

describe("clasificación de funciones", () => {
  const base = {
    onDisk: ["chat", "openweather"],
    declared: new Map([["chat", false], ["openweather", false], ["fantasma", false]]),
    candidates: ["mcp", "skills-ingest", "nuevo"],
    references: new Map([
      ["chat", refs(["src/hooks/useChat.ts"])],
      ["mcp", refs(["src/lib/client.ts"])],
      ["skills-ingest", refs()],
      ["nuevo", refs()],
    ]),
  };

  it("marca como bloqueo la función de más que aún se llama desde el código", () => {
    const result = classify({
      ...base,
      deployed: new Map([["chat", {}], ["openweather", {}], ["mcp", {}], ["nuevo", {}]]),
    });

    expect(result.extra.find((row) => row.name === "mcp").kind).toBe("extra");
    expect(result.blocking.map((row) => row.name)).toEqual(["mcp"]);
  });

  it("no bloquea por una función que ya no existe en Supabase", () => {
    const result = classify({
      ...base,
      deployed: new Map([["chat", {}], ["openweather", {}], ["mcp", {}], ["nuevo", {}]]),
      references: new Map([...base.references, ["skills-ingest", refs(["src/viejo.ts"])]]),
    });

    expect(result.extra.find((row) => row.name === "skills-ingest").kind).toBe("already-gone");
    expect(result.blocking.map((row) => row.name)).toEqual(["mcp"]);
  });

  it("con sondas solo juzga las candidatas, no las del repositorio", () => {
    const result = classify({
      ...base,
      deployed: new Map([["mcp", {}], ["nuevo", {}]]),
      coverage: "candidates",
      references: new Map([["nuevo", refs(["src/vivo.ts"])]]),
    });

    expect(result.extra.find((row) => row.name === "mcp").deployed).toBe("deployed");
    expect(result.extra.find((row) => row.name === "skills-ingest").deployed).toBe("absent");
    expect(result.blocking.map((row) => row.name)).toEqual(["nuevo"]);
    // Sin inventario completo no se puede afirmar que una función del repo
    // esté sin desplegar.
    expect(result.rows.every((row) => row.kind === "in-repo")).toBe(true);
  });

  it("sin sondas ('no probado') nunca bloquea", () => {
    const result = classify({
      ...base,
      deployed: null,
      coverage: "none",
      references: new Map([["nuevo", refs(["src/vivo.ts"])]]),
    });

    expect(result.extra.every((row) => row.deployed === "unprobed")).toBe(true);
    expect(result.blocking).toEqual([]);
  });

  it("detecta entradas de config.toml sin carpeta", () => {
    const result = classify({
      ...base,
      deployed: new Map([["chat", {}]]),
      references: new Map(),
    });

    expect(result.orphanConfig).toEqual(["fantasma"]);
  });

  it("con inventario autoritativo distingue lo que falta desplegar", () => {
    const result = classify({
      ...base,
      deployed: new Map([["chat", {}]]),
    });

    expect(result.rows.find((row) => row.name === "openweather").kind).toBe("not-deployed");
    expect(result.rows.find((row) => row.name === "chat").kind).toBe("live");
  });
});

describe("inventario del repositorio", () => {
  it("toda función en disco está declarada en config.toml", () => {
    const declared = declaredInConfig(config);
    const undeclared = functionsOnDisk().filter((name) => !declared.has(name));
    expect(undeclared).toEqual([]);
  });

  it("el registro de retiradas es válido y no se repite", () => {
    const ledger = readLedger();
    expect(ledger.length).toBeGreaterThan(0);

    const names = ledger.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);

    for (const entry of ledger) {
      expect(entry.name).toMatch(/^[a-z0-9-]+$/);
      expect(entry.removedFromRepo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason.length).toBeGreaterThan(20);
      // Una función retirada no puede seguir teniendo carpeta: si la tiene, la
      // entrada del registro está caducada y engañaría a las sondas.
      expect(functionsOnDisk()).not.toContain(entry.name);
    }
  });
});
