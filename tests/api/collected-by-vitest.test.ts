/**
 * Guardián de la suite de `api/`.
 *
 * Los handlers de `api/` se quedaron fuera de Vitest una vez y un cambio en los
 * mocks (respuestas sin `json()`, el contrato viejo de `sendJson`) rompió
 * pruebas que nadie ejecutaba. Arreglar los mocks —#`1d4b476`, `9a3fb4f`— no
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
 *  - El workflow de la CI tiene que ejecutar `npm test` y no puede envolverlo
 *    en `continue-on-error`, que es como un rojo se convierte en verde.
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

const config = readFileSync(path.join(ROOT, "vitest.config.ts"), "utf8");
const workflow = readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");

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
    expect(uncoveredApiTests(`include: [${withoutApi}]`, apiTestFiles()).length).toBeGreaterThan(0);
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
  it("ejecuta la suite", () => {
    expect(workflow).toMatch(/npm test|npx vitest run/);
  });

  it("no envuelve ningún paso en continue-on-error", () => {
    expect(workflow).not.toMatch(/continue-on-error/);
  });

  it("el lint también bloquea", () => {
    expect(workflow).toMatch(/npm run lint/);
  });
});
