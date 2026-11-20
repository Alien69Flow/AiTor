/**
 * Fase 3 del portado: las rutas de `api/` tienen que poder desplegarse.
 *
 * Vercel carga cada fichero de `api/` como una función suelta y el proyecto es
 * ESM (`"type": "module"`). De ahí salieron dos fallos reales:
 *
 *  - `FUNCTION_INVOCATION_FAILED` por un import relativo sin extensión (está
 *    documentado en la cabecera de `api/predictions.ts`);
 *  - duplicación de validación, CORS y caché en cada handler, porque parecía
 *    que no se podía compartir código entre rutas.
 *
 * Compartir sí se puede —`api/_shared/*.js`, y el resto de handlers lo hace—
 * pero el especificador tiene que llevar la extensión. Esta prueba lo fija
 * leyendo las fuentes, así que no necesita credenciales ni red y falla en el
 * momento en que alguien vuelve a escribir `./_shared/redis`.
 *
 * Qué NO se comprueba aquí: que el handler responda, ni que el despliegue de
 * Vercel funcione. Eso es `vercel build` / `vercel dev`, que no corre en CI.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Vitest arranca con la raíz del repo como directorio de trabajo. */
const API_DIR = resolve(process.cwd(), "api");

/** Los ficheros que Vercel publica como ruta: sin `_`, sin `.test.ts`. */
function routeFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      // `_shared/` es código compartido, no una ruta.
      if (entry.name.startsWith("_")) return [];
      return routeFiles(join(dir, entry.name), `${relative}/`);
    }
    if (!entry.name.endsWith(".ts")) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.startsWith("_")) return [];
    return [relative];
  });
}

const ROUTES = routeFiles(API_DIR)
  .sort()
  .map((path) => ({ path, source: readFileSync(join(API_DIR, path), "utf8") }));

/** Especificadores de `import … from`, `export … from` e `import()`. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s+"([^"]+)"/g,
    /\bimport\s*\(\s*"([^"]+)"\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

describe("rutas de api/", () => {
  it("la prueba está mirando rutas de verdad", () => {
    const names = ROUTES.map((route) => route.path);
    expect(names).toEqual(
      expect.arrayContaining(["health.ts", "telegram-webhook.ts", "gdelt.ts", "mcp.ts"]),
    );
    expect(names).not.toEqual(expect.arrayContaining(["telegram-webhook.probe.test.ts"]));
  });

  it("ninguna ruta importa módulos que el runtime edge no tiene", () => {
    const banned = /^node:(http|https|zlib)$/;
    const violations = ROUTES.flatMap(({ path, source }) =>
      specifiers(source)
        .filter((specifier) => banned.test(specifier))
        .map((specifier) => `${path} importa ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it("cada import relativo lleva la extensión .js", () => {
    const violations = ROUTES.flatMap(({ path, source }) =>
      specifiers(source)
        .filter((specifier) => specifier.startsWith(".") && !specifier.endsWith(".js"))
        .map((specifier) => `${path} importa "${specifier}" sin .js`),
    );
    expect(violations).toEqual([]);
  });

  it("ninguna ruta se sale de api/ a buscar código", () => {
    const violations = ROUTES.flatMap(({ path, source }) =>
      specifiers(source)
        .filter((specifier) => specifier.startsWith("."))
        .filter((specifier) => relative(API_DIR, resolve(API_DIR, dirname(path), specifier)).startsWith(".."))
        .map((specifier) => `${path} sale de api/ con "${specifier}"`),
    );
    expect(violations).toEqual([]);
  });

  it("cada ruta exporta su handler", () => {
    const violations = ROUTES.filter(
      ({ source }) => !/export\s+default\s/.test(source) && !/export\s*\{[^}]*\bdefault\b/s.test(source),
    ).map(({ path }) => `${path} no tiene export default`);
    expect(violations).toEqual([]);
  });
});
