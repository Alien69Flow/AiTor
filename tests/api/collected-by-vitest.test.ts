/**
 * Guardián de la suite de `api/`.
 *
 * Los handlers de `api/` se quedaron fuera de Vitest una vez y un cambio en los
 * mocks (respuestas sin `json()`, el contrato viejo de `sendJson`) rompió
 * pruebas que nadie ejecutaba. Arreglar los mocks —`1d4b476`, `9a3fb4f`— no
 * basta: dentro de seis meses alguien puede tocar `include` en
 * `vitest.config.ts` y volver a dejar cientos de pruebas en el limbo sin que
 * ningún rojo lo diga.
 *
 * Este fichero es ese rojo. No prueba el producto: prueba el contrato de que el
 * producto se prueba.
 *
 *  - Cada `api/**\/*.test.ts` del disco tiene que encajar en un glob de
 *    `include`; si sobra uno, falla con su ruta.
 *  - `include` tiene que seguir nombrando `api/**` de forma explícita.
 *  - Ningún workflow de `.github/workflows` puede envolver un paso en
 *    `continue-on-error`, que es como un rojo se convierte en verde. Se leen
 *    todos los del directorio, no sólo `ci.yml`.
 *  - Si hay un workflow que corre pgTAP, tiene que arrancar la base y apuntar a
 *    `supabase/tests`.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// jsdom sirve los módulos desde `http://localhost/`, así que `import.meta.url`
// no es un `file:` y no vale para localizar el repo. Vitest arranca con la raíz
// del proyecto como cwd, que es justo lo que necesitamos.
const ROOT = path.resolve(process.cwd());

/** Convierte un glob de `include` al mismo criterio que usa Vitest. */
export function globToRegex(glob: string): RegExp {
  let pattern = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          // `**/` también vale para cero directorios: `api/**/*.test.ts`
          // tiene que recoger `api/foo.test.ts`, no sólo `api/x/foo.test.ts`.
          pattern += "(?:.*/)?";
          i += 2;
        } else {
          pattern += ".*";
          i += 1;
        }
      } else {
        pattern += "[^/]*";
      }
    } else if (char === "{") {
      const end = glob.indexOf("}", i);
      const options = glob
        .slice(i + 1, end)
        .split(",")
        .map((option) => option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      pattern += `(?:${options.join("|")})`;
      i = end;
    } else if ("\\^$.|?+()[]".includes(char)) {
      pattern += `\\${char}`;
    } else {
      pattern += char;
    }
  }
  return new RegExp(`^${pattern}$`);
}

/** Globs del bloque `include` de un `vitest.config.ts` dado. */
export function includeGlobs(configSource: string): string[] {
  const block = configSource.match(/include:\s*\[([\s\S]*?)\]/);
  if (!block) return [];
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** Ficheros de test de `api/` que ningún glob del `include` recogería. */
export function uncoveredApiTests(configSource: string, files: string[]): string[] {
  const matchers = includeGlobs(configSource).map(globToRegex);
  return files.filter((file) => !matchers.some((matcher) => matcher.test(file)));
}

function apiTestFiles(): string[] {
  return (readdirSync(path.join(ROOT, "api"), { recursive: true }) as string[])
    .map((entry) => `api/${entry.split("\\").join("/")}`)
    .filter((entry) => /\.test\.tsx?$/.test(entry))
    .sort();
}

interface Workflow {
  name: string;
  source: string;
}

/**
 * Los workflows de disco, enumerados en vez de listados a mano: uno nuevo queda
 * cubierto el día que se añade, sin tocar este fichero.
 */
export function workflowFiles(): Workflow[] {
  const dir = path.join(ROOT, ".github/workflows");
  return readdirSync(dir)
    .filter((entry) => /\.ya?ml$/.test(entry))
    .sort()
    .map((entry) => ({
      name: entry,
      source: readFileSync(path.join(dir, entry), "utf8"),
    }));
}

/** Un `continue-on-error` en el YAML, valga `true`, `false` o una expresión. */
const SILENCIA_UN_ROJO = /continue-on-error/;

/** Los nombres de los workflows cuyo YAML silencia un rojo. Vacío = limpio. */
export function silencianUnRojo(workflows: Workflow[]): string[] {
  return workflows
    .filter(({ source }) => SILENCIA_UN_ROJO.test(source))
    .map(({ name }) => name);
}

const config = readFileSync(path.join(ROOT, "vitest.config.ts"), "utf8");
const workflows = workflowFiles();
const app = workflows.find(({ name }) => name === "ci.yml");

describe("la suite de api/ está dentro de Vitest", () => {
  it("recoge todos los tests de api/ que existen en disco", () => {
    const files = apiTestFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(uncoveredApiTests(config, files)).toEqual([]);
  });

  it("nombra api/** explícitamente, para que se vea en el diff si desaparece", () => {
    expect(includeGlobs(config)).toContain("api/**/*.test.{ts,tsx}");
  });

  it("el guardián muerde: sin la entrada de api/ sobran tests", () => {
    const withoutApi = includeGlobs(config)
      .filter((glob) => !glob.startsWith("api/"))
      .map((glob) => `"${glob}"`)
      .join(", ");
    expect(
      uncoveredApiTests(`include: [${withoutApi}]`, apiTestFiles()).length,
    ).toBeGreaterThan(0);
  });

  it("entiende el glob como Vitest: **/ también vale para cero directorios", () => {
    const apiMatcher = globToRegex("api/**/*.test.{ts,tsx}");
    expect(apiMatcher.test("api/health.test.ts")).toBe(true);
    expect(apiMatcher.test("api/cron/price-alerts.test.ts")).toBe(true);
    expect(apiMatcher.test("api/health.test.tsx")).toBe(true);
    expect(apiMatcher.test("src/lib/health.test.ts")).toBe(false);
    expect(apiMatcher.test("api/health.test.mjs")).toBe(false);
  });
});

describe("la CI no puede silenciar un rojo", () => {
  it("lee todos los workflows del directorio, no sólo ci.yml", () => {
    // La lista se contrasta con una enumeración escrita aparte: si el ayudante
    // pasa a leer un fichero fijo, o a filtrar de menos, dejan de cuadrar.
    const onDisk = readdirSync(path.join(ROOT, ".github/workflows"))
      .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
      .sort();
    expect(onDisk.length).toBeGreaterThan(0);
    expect(workflows.map(({ name }) => name)).toEqual(onDisk);
  });

  it("ninguno de los workflows lleva el flag", () => {
    expect(silencianUnRojo(workflows)).toEqual([]);
  });

  it("el detector muerde: uno sintético con el flag sale en la lista", () => {
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

    // La misma función que recorre los workflows reales, no el regex a mano: si
    // la detección deja de morder, o empieza a marcar todo, esto se pone rojo.
    // El segundo caso es el que impide que el verde salga de marcar de más.
    expect(silencianUnRojo([conFlag, sinFlag])).toEqual(["sintetico.yml"]);
  });

  it("ci.yml sigue ejecutando la suite y el lint", () => {
    expect(app, "falta .github/workflows/ci.yml").toBeDefined();
    expect(app?.source).toMatch(/npm test|npx vitest run/);
    expect(app?.source).toMatch(/npm run lint/);
  });
});

describe("el workflow de pgTAP, cuando exista, ejecuta sus suites", () => {
  // Sin buscar detrás de `run:` a propósito: el `run: |` de varias líneas es la
  // forma normal de invocarlo, con su `log=…` y su `if !` por delante. Se exige
  // que estén los dos comandos, no cómo se escriben.
  const conPgtap = workflows.filter(({ source }) => /\bsupabase test db\b/.test(source));

  it("arranca la base y apunta a supabase/tests", () => {
    for (const { name, source } of conPgtap) {
      expect(source, `${name} no arranca la base`).toMatch(/\bsupabase db start\b/);
      expect(source, `${name} no apunta a las suites`).toMatch(
        /\bsupabase test db\s+supabase\/tests\b/,
      );
    }
  });

  it("si el fichero está, es uno de los que se revisan", () => {
    const existe = workflows.some(({ name }) => name === "pgtap.yml");
    if (!existe) {
      // En `main` todavía no está: vive en su rama. Cuando entre, esta rama del
      // `if` deja de aplicarse y la exigencia empieza sola, sin tocar el test.
      expect(conPgtap).toEqual([]);
      return;
    }
    expect(conPgtap.map(({ name }) => name)).toContain("pgtap.yml");
  });
});
