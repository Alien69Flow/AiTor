import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardia de la CI: si alguien cambia `ci.yml` por `npm install`, quita el
 * paso de tipos o deja de versionar el lockfile, esto se pone rojo con el
 * motivo escrito, en vez de que la CI siga en verde midiendo otra cosa.
 *
 * No comprueba que la CI *use* estos pasos: comprueba que existan tal como los
 * dejó el último arreglo, que es justo lo que se perdió una vez sin que nadie
 * lo notara.
 */

const root = process.cwd();
const WORKFLOW = resolve(root, ".github/workflows/ci.yml");

function stepBlock(workflow, name) {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) =>
    new RegExp(`^\\s*(?:-\\s*)?name:\\s*${name}\\s*$`).test(line),
  );
  if (start === -1) return null;
  const indent = lines[start].search(/\S/);
  const block = [lines[start]];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") {
      block.push(line);
      continue;
    }
    const lineIndent = line.search(/\S/);
    // Un `- ` a la altura de este paso (o menos) empieza otro paso.
    if (lineIndent <= indent) break;
    block.push(line);
  }
  return block.join("\n");
}

describe("ci.yml no puede volver atrás sin que se note", () => {
  const workflow = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, "utf8") : null;

  it("el workflow existe", () => {
    expect(
      workflow,
      "Falta .github/workflows/ci.yml: sin CI no hay nada que verifique `main`.",
    ).not.toBeNull();
  });

  it("instala con `npm ci`, no con `npm install`", () => {
    expect(
      workflow,
      "ci.yml desapareció: no se puede comprobar cómo instala.",
    ).not.toBeNull();
    const runLines = [...workflow.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1]);
    const install = runLines.find((line) => /\bnpm\s+ci\b/.test(line));
    expect(
      install,
      "ci.yml ya no tiene un paso `run: npm ci`. Con `npm install` un lockfile desfasado se arregla solo y la CI mide un árbol distinto al que se versiona; vuelve a poner `npm ci --no-audit --no-fund`.",
    ).toBeDefined();
    expect(
      runLines.filter((line) => /\bnpm\s+install\b/.test(line)),
      "ci.yml llama a `npm install` en algún paso: instala lo que no está en el lockfile y deja pasar un `package.json` que no cuadra con él. Usa `npm ci`.",
    ).toEqual([]);
  });

  it("mantiene el paso Typecheck con `npm run typecheck`", () => {
    const step = workflow ? stepBlock(workflow, "Typecheck") : null;
    expect(
      step,
      "ci.yml perdió el paso `- name: Typecheck`. Vite compila sin comprobar tipos, así que sin él un TS2339 llega a `main` con la CI en verde. Añade el paso con `run: npm run typecheck` antes del build.",
    ).not.toBeNull();
    expect(
      step,
      "El paso Typecheck ya no ejecuta `npm run typecheck`: revisa que no lo hayan cambiado por `vite build` ni lo hayan vaciado.",
    ).toMatch(/run:\s*npm run typecheck/);
    expect(
      step,
      "El paso Typecheck tiene `continue-on-error`: un error de tipos quedaría en verde. Quítalo, este paso tiene que bloquear.",
    ).not.toMatch(/continue-on-error:\s*true/);
  });

  it("versiona `package-lock.json`", () => {
    expect(
      existsSync(resolve(root, "package-lock.json")),
      "No hay `package-lock.json` en el árbol de trabajo: `npm ci` no puede instalar sin él.",
    ).toBe(true);
    let tracked = "";
    try {
      tracked = execFileSync(
        "git",
        ["ls-files", "--error-unmatch", "package-lock.json"],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
    } catch {
      tracked = "";
    }
    expect(
      tracked,
      "`package-lock.json` no está versionado en git (`git ls-files` no lo ve). Sin lockfile en el repositorio, `npm ci` falla y la CI deja de instalar exactamente lo mismo en cada ejecución: quítalo de .gitignore y commitéalo.",
    ).toBe("package-lock.json");
  });
});
