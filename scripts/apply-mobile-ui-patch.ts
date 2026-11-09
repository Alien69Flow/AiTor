import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MOBILE_UI_FILES, isMobileUiPatched, patchMobileUi } from "../src/lib/mobile-ui-patch";

/** `--check` informa sin escribir: lo usa el flujo para no repetir trabajo. */
const checkOnly = process.argv.includes("--check");
const root = process.cwd();

let written = 0;
let pending = 0;

try {
  for (const file of MOBILE_UI_FILES) {
    const path = resolve(root, file);
    const source = readFileSync(path, "utf8");

    if (isMobileUiPatched(source, file)) {
      console.log(`· ${file}: ya tiene los ajustes`);
      continue;
    }

    const patched = patchMobileUi(source, file);
    if (patched === source) {
      console.log(`· ${file}: sin cambios`);
      continue;
    }

    if (checkOnly) {
      console.error(`✗ ${file}: faltan los ajustes de móvil`);
      pending += 1;
      continue;
    }

    writeFileSync(path, patched);
    written += 1;
    console.log(`✓ ${file}: ajustes aplicados`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (checkOnly && pending > 0) process.exit(1);
console.log(checkOnly ? "Comprobación completada." : `${written} fichero(s) actualizados.`);
