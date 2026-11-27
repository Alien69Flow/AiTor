/**
 * Guardián de los workflows.
 *
 * El guardián de la suite (`collected-by-vitest.test.ts`) solo miraba
 * `.github/workflows/ci.yml`. Mientras el CI vivió en un único fichero eso
 * bastaba; en cuanto aparece un segundo workflow —`pgtap.yml`, la guardia
 * semanal, el que venga— el agujero vuelve: un `continue-on-error` en un
 * fichero que nadie lee marca el paso como *success* aunque el comando salga
 * con 1, y el rojo desaparece sin que nadie lo haya aprobado.
 *
 * Aquí se enumera el directorio en tiempo de ejecución en vez de listar
 * ficheros a mano: un workflow nuevo queda cubierto el día que se añade, sin
 * tocar este test.
 * Y si alguien corre pgTAP (`supabase test db`), se exige que arranque la base
 * y apunte a `supabase/tests`.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// jsdom sirve los módulos desde `http://localhost/`, así que `import.meta.url`
// no es un `file:` y no vale para localizar el repo. Vitest arranca con la raíz
// del proyecto como cwd, que es justo lo que necesitamos.
const DIR = path.resolve(process.cwd(), ".github/workflows");

interface Workflow {
  name: string;
  source: string;
}

function workflowFiles(): Workflow[] {
  return readdirSync(DIR)
    .filter((entry) => /\.ya?ml$/.test(entry))
    .sort()
    .map((entry) => ({ name: entry, source: readFileSync(path.join(DIR, entry), "utf8") }));
}

/** Un `continue-on-error` en el YAML, valga `true`, `false` o una expresión. */
const SILENCIA_UN_ROJO = /continue-on-error/;

/** Los nombres de los workflows cuyo YAML silencia un rojo. Vacío = limpio. */
function silencianUnRojo(workflows: Workflow[]): string[] {
  return workflows.filter(({ source }) => SILENCIA_UN_ROJO.test(source)).map(({ name }) => name);
}

const workflows = workflowFiles();

describe("ningún workflow silencia un rojo", () => {
  it("se leen todos los workflows del directorio", () => {
    expect(workflows.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["ci.yml", "guardia-produccion.yml"]),
    );
  });

  it("ninguno de los workflows reales lleva el flag", () => {
    expect(silencianUnRojo(workflows)).toEqual([]);
  });

  it("el detector muerde: un workflow sintético con el flag sale en la lista", () => {
    const conFlag: Workflow = {
      name: "sintetico.yml",
      source: [
        "jobs:",
        "  x:",
        "    steps:",
        "      - run: npm test",
        "        continue-on-error: true",
      ].join("\n"),
    };
    const sinFlag: Workflow = {
      name: "limpio.yml",
      source: ["jobs:", "  x:", "    steps:", "      - run: npm test"].join("\n"),
    };

    // Misma función que recorre los workflows reales, no el regex a mano: si
    // mañana la detección deja de morder, o empieza a marcar todo, esto se
    // pone rojo. El segundo caso desactiva el verde por exceso.
    expect(silencianUnRojo([conFlag, sinFlag])).toEqual(["sintetico.yml"]);
  });

  it("algún workflow ejecuta la suite", () => {
    expect(workflows.some(({ source }) => /npm test|npx vitest run/.test(source))).toBe(true);
  });
});

describe("el workflow de pgTAP, cuando exista, ejecuta sus suites", () => {
  const pgtap = workflows.filter(({ source }) => /supabase test db/.test(source));

  // El comando no se busca detrás de `run:` porque el bloque `run: |` de varias
  // líneas es la forma normal de invocarlo: dentro van un `log=…` y un `if !`
  // por delante. Se exige que estén los dos comandos, no cómo se escriben.
  it("arranca la base y apunta a supabase/tests", () => {
    for (const { name, source } of pgtap) {
      expect(source, `${name} no arranca la base`).toMatch(/\bsupabase db start\b/);
      expect(source, `${name} no apunta a las suites`).toMatch(
        /\bsupabase test db\s+supabase\/tests\b/,
      );
    }
  });
});
