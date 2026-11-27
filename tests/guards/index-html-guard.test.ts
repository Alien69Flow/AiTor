/**
 * Guardián de scripts inline en `index.html`.
 *
 * `'unsafe-inline'` en `script-src` sólo hace falta si hay código dentro de un
 * `<script>` en el propio documento. Hoy no hay ninguno y no debe haberlo: el
 * día que alguien pegue uno a mano, la política tendría que abrirse, y abrirla
 * desactiva la protección contra XSS en toda la app, no sólo en esa línea.
 *
 * El criterio es el del navegador, no una lista de excepciones: ejecuta el
 * `<script>` sin `src` cuyo `type` está vacío o es un MIME de JavaScript (o
 * `module`). Todo lo demás es un bloque de datos que el navegador no ejecuta:
 * `application/ld+json` (Schema.org), `application/json`, `importmap`,
 * `speculationrules` y los tipos desconocidos.
 *
 * Se parsea con `DOMParser` y no con una expresión regular: el `type` y el
 * `src` pueden venir en cualquier orden y con comillas simples o dobles, y un
 * `<script>` dentro de un comentario no es un script.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// jsdom sirve los módulos desde `http://localhost/`, así que `import.meta.url`
// no es un `file:`; la raíz del proyecto, que es el cwd de Vitest, sí vale.
const INDEX = readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");

/** Los MIME de JavaScript que el navegador ejecuta, ya sin parámetros. */
const MIME_JS = /^(?:text|application)\/(?:x-)?(?:java|ecma)script$|^(?:text|application)\/jscript$/;

/** ¿Un `type` así hace que el `<script>` ejecute? */
function ejecuta(type: string | null): boolean {
  // Sin `type` el navegador ejecuta el contenido como JavaScript clásico.
  if (type === null || type.trim() === "") return true;
  // `text/javascript; charset=utf-8` ejecuta igual: manda la esencia del MIME.
  const esencia = type.split(";")[0].trim().toLowerCase();
  // `module` no es un MIME, pero también ejecuta.
  return esencia === "module" || MIME_JS.test(esencia);
}

/** Los `<script>` de `html` que el navegador ejecutaría, recortados al mensaje. */
function scriptsInline(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("script"))
    .filter((script) => !script.hasAttribute("src") && ejecuta(script.getAttribute("type")))
    .map((script) => script.outerHTML.replace(/\s+/g, " ").slice(0, 140));
}

describe("index.html no lleva código dentro de un <script>", () => {
  it("el detector muerde, y hay algo que morder", () => {
    // Sin fichero no hay nada que guardar y todas las comprobaciones pasarían
    // por vacío.
    expect(INDEX.length).toBeGreaterThan(0);

    // Lo que ejecuta: sin `type`, como `module`, o con un MIME de JavaScript.
    expect(scriptsInline(`<script>alert(1)</script>`)).toHaveLength(1);
    expect(scriptsInline(`<script type="module">init()</script>`)).toHaveLength(1);
    expect(scriptsInline(`<script type="text/javascript; charset=utf-8">x()</script>`)).toHaveLength(1);
    expect(scriptsInline(`<script type="application/javascript">x()</script>`)).toHaveLength(1);
    expect(scriptsInline(`<script type=''>x()</script>`)).toHaveLength(1);

    // Lo que no ejecuta: bloques de datos. `ld+json` es el que ya está en el
    // `index.html` real, y por eso el guardián tiene que dejarlo pasar.
    expect(scriptsInline(`<script type="application/ld+json">{"@type":"Organization"}</script>`)).toHaveLength(0);
    expect(scriptsInline(`<script type="application/json">{}</script>`)).toHaveLength(0);
    expect(scriptsInline(`<script type="importmap">{"imports":{}}</script>`)).toHaveLength(0);
    expect(scriptsInline(`<script type="text/x-template"><b>hola</b></script>`)).toHaveLength(0);

    // Un `src` no es código en línea, y dentro de un comentario no hay script.
    expect(scriptsInline(`<script src="/src/main.tsx"></script>`)).toHaveLength(0);
    expect(scriptsInline(`<!-- <script>x()</script> -->`)).toHaveLength(0);
  });

  it("el index.html real no tiene ninguno", () => {
    // Si esto se pone rojo, el arreglo no es abrir la CSP: es mover ese código
    // a un módulo con `src`, o a un fichero de `/public`.
    expect(scriptsInline(INDEX)).toEqual([]);
  });

  it("el bloque de datos estructurados sigue ahí, y es el que se ignora", () => {
    const doc = new DOMParser().parseFromString(INDEX, "text/html");
    const datos = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));

    // Que exista y parsee demuestra que la excepción cubre un bloque real y no
    // un hueco: si desapareciera, el `ld+json` no sería lo que se está
    // dejando pasar y habría que revisar el criterio.
    expect(datos).toHaveLength(1);
    expect(JSON.parse(datos[0].textContent ?? "")).toMatchObject({ "@type": "Organization" });
  });
});
