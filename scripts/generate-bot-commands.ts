/**
 * Reescribe el bloque de comandos de `AGENTS.md` desde la tabla única.
 *
 * Uso: `npm run docs:comandos` (escribe) o `--check` (falla si hay deriva, para
 * CI). El test `api/_shared/bot-commands.test.ts` hace la misma comparación, así que
 * olvidarse de regenerar no pasa desapercibido.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COMMANDS_END,
  COMMANDS_START,
  renderCommandsMarkdown,
} from "../api/_shared/bot-commands.js";

const DOC_PATH = resolve(process.cwd(), "AGENTS.md");
const doc = readFileSync(DOC_PATH, "utf8");

const start = doc.indexOf(COMMANDS_START);
const end = doc.indexOf(COMMANDS_END);
if (start === -1 || end === -1 || end < start) {
  console.error(
    `AGENTS.md no tiene el bloque de comandos (${COMMANDS_START} … ${COMMANDS_END}).`,
  );
  process.exit(1);
}

const block = renderCommandsMarkdown();
const next = doc.slice(0, start) + block + doc.slice(end + COMMANDS_END.length);
const check = process.argv.includes("--check");

if (next === doc) {
  console.log("AGENTS.md ya coincide con la tabla de comandos.");
  process.exit(0);
}

if (check) {
  console.error("AGENTS.md no coincide con la tabla: ejecuta `npm run docs:comandos`.");
  process.exit(1);
}

writeFileSync(DOC_PATH, next);
console.log("AGENTS.md actualizado desde api/_shared/bot-commands.ts.");
