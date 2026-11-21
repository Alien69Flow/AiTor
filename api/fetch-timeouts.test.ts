/**
 * Ningún `fetch` de `api/` puede quedarse esperando para siempre.
 *
 * Un extremo que acepta la conexión y no contesta deja el handler colgado
 * hasta que Vercel corta el turno: el usuario recibe un 504 en vez de un
 * mensaje que diga qué falló, y el webhook de Telegram reintenta la misma
 * entrega. Cada llamada lleva su `AbortSignal.timeout(...)` para que el fallo
 * llegue como error a tiempo y el handler pueda contarlo.
 *
 * La prueba lee el código fuente (sin red y sin ejecutar handlers), quita los
 * comentarios, recorre cada `fetch(` con sus paréntesis balanceados y exige
 * `AbortSignal.timeout(` dentro de los argumentos. Los ficheros `*.test.ts` no
 * cuentan: sus `fetch` son dobles.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = join(process.cwd(), "api");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found.sort();
}

/** Quita comentarios para que un `fetch()` citado en uno no cuente como llamada. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `//` precedido de `:` es parte de una URL, no un comentario.
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Texto entre el `(` de un `fetch(` y su `)` de cierre, sin contar paréntesis de cadenas. */
function callArguments(src: string, openParen: number): { args: string; end: number } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openParen; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return { args: src.slice(openParen, i + 1), end: i };
    }
  }
  return null;
}

interface FetchCall {
  file: string;
  line: number;
  args: string;
}

function fetchCalls(): FetchCall[] {
  const calls: FetchCall[] = [];
  for (const file of sourceFiles(API_DIR)) {
    const src = stripComments(readFileSync(file, "utf8"));
    let index = 0;
    while ((index = src.indexOf("fetch(", index)) !== -1) {
      const openParen = index + "fetch".length;
      const call = callArguments(src, openParen);
      if (!call) {
        throw new Error(`${relative(process.cwd(), file)}: paréntesis sin cerrar tras fetch(`);
      }
      calls.push({
        file: relative(process.cwd(), file),
        line: src.slice(0, index).split("\n").length,
        args: call.args,
      });
      index = call.end;
    }
  }
  return calls;
}

describe("fetch con límite de tiempo en api/", () => {
  const calls = fetchCalls();

  it("encuentra las llamadas (la prueba no pasa por no mirar nada)", () => {
    // Si el escaneo se rompe o alguien vacía api/, esto falla en vez de dar
    // verde con cero llamadas.
    expect(calls.length).toBeGreaterThanOrEqual(40);
    expect(new Set(calls.map((call) => call.file)).size).toBeGreaterThanOrEqual(10);
  });

  it("todas llevan AbortSignal.timeout", () => {
    const withoutTimeout = calls
      .filter((call) => !call.args.includes("AbortSignal.timeout("))
      .map((call) => `${call.file}:${call.line}`);

    expect(withoutTimeout).toEqual([]);
  });

  it("el límite es una duración, no un cero", () => {
    const zero = calls.filter((call) => /AbortSignal\.timeout\(\s*0\s*\)/.test(call.args));
    expect(zero.map((call) => `${call.file}:${call.line}`)).toEqual([]);
  });
});
