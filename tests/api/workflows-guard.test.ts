/**
 * Guardián de los workflows.
 *
 * Un `continue-on-error` marca el paso como *success* aunque el comando salga
 * con 1: el rojo desaparece sin que nadie lo haya aprobado. Se prohíbe en todos
 * los workflows del directorio, no sólo en `ci.yml`, y el que corre pgTAP tiene
 * que arrancar la base y apuntar a `supabase/tests`.
 *
 * El directorio se enumera en tiempo de ejecución: un workflow nuevo queda
 * cubierto el día que se añade, sin tocar este fichero.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// jsdom sirve los módulos desde `http://localhost/`, así que `import.meta.url`
// no es un `file:`; la raíz del proyecto, que es el cwd de Vitest, sí vale.
const DIR = path.resolve(process.cwd(), ".github/workflows");

/** Nombre → YAML de cada workflow en disco. */
const workflows = new Map(
  readdirSync(DIR)
    .filter((entry) => /\.ya?ml$/.test(entry))
    .map((entry) => [entry, readFileSync(path.join(DIR, entry), "utf8")] as const),
);

/** Nombres de los workflows cuyo YAML silencia un rojo. */
const silencian = (all: Iterable<readonly [string, string]>) =>
  [...all].filter(([, yaml]) => /continue-on-error/.test(yaml)).map(([name]) => name);

describe("los workflows no silencian un rojo", () => {
  it("el detector muerde, y hay algo que morder", () => {
    // Sin ficheros, todo lo de abajo pasaría por vacío; y el caso limpio impide
    // que el verde salga de marcar de más.
    expect(workflows.size).toBeGreaterThan(0);
    expect(
      silencian([
        ["limpio.yml", "steps:\n  - run: npm test"],
        ["sucio.yml", "steps:\n  - run: npm test\n    continue-on-error: true"],
      ]),
    ).toEqual(["sucio.yml"]);
  });

  it("ninguno de los reales lleva el flag", () => {
    expect(silencian(workflows)).toEqual([]);
  });

  it("alguno ejecuta la suite: sin comandos no hay rojo que silenciar", () => {
    const yamls = [...workflows.values()];
    expect(yamls.some((yaml) => /npm test|npx vitest run/.test(yaml))).toBe(true);
  });

  it("el que corre pgTAP arranca la base y apunta a supabase/tests", () => {
    for (const [name, yaml] of workflows) {
      if (!/supabase test db/.test(yaml)) continue;
      expect(yaml, `${name} no arranca la base`).toMatch(/\bsupabase db start\b/);
      expect(yaml, `${name} no apunta a las suites`).toMatch(
        /\bsupabase test db\s+supabase\/tests\b/,
      );
    }
  });
});
