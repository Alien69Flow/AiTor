#!/usr/bin/env node
/**
 * Inventario de retirada: compara las Edge Functions que hay en el repositorio
 * con las que están desplegadas en Supabase, y dice cuáles sobran.
 *
 * El problema que resuelve: `supabase functions deploy` solo sabe añadir. Una
 * función que se borra del repositorio **sigue desplegada y accesible** en el
 * proyecto, con sus secretos y su cuota, y nada en el código lo delata. `mcp`
 * estuvo así ~3 meses después de retirarse del repo.
 *
 * Dos fuentes de verdad, en este orden:
 *
 *   1. API de administración (autoritativa, requiere SUPABASE_ACCESS_TOKEN):
 *      GET https://api.supabase.com/v1/projects/<ref>/functions
 *      Devuelve TODAS las desplegadas, incluso las que nunca existieron aquí.
 *
 *   2. Sondas HTTP con la clave publishable (sin credenciales de admin):
 *      una función desplegada contesta 200/400/401/403/405; una que no existe
 *      contesta 404 con `{"code":"NOT_FOUND","message":"Requested function was
 *      not found"}`. Solo puede confirmar o descartar nombres que ya conocemos
 *      (los del registro `supabase/functions-retired.json` y `--name`), no
 *      descubrir nombres nuevos: por eso el registro existe.
 *
 * Nunca despliega, nunca borra, nunca apaga nada. Solo mide y dice qué haría
 * falta. El apagado real (tumba 410 → borrado) está en
 * docs/function-decommission-runbook.md y es manual a propósito.
 *
 * Uso:
 *   npm run functions:retire                  # inventario + sondas del registro
 *   npm run functions:retire -- --strict      # falla si hay funciones de más
 *   npm run functions:retire -- --name foo,bar  # candidatas puntuales
 *   npm run functions:retire -- --json        # salida para CI
 *
 * Código de salida:
 *   0  nada urgente (o solo funciones de más sin consumidores: se pueden retirar)
 *   1  bloqueo: una candidata a retirada todavía se llama desde el código
 *      (o, con --strict, existe cualquier función desplegada que sobra)
 *   2  no se pudo resolver el proyecto
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const valueOf = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const strict = flag("--strict");
const asJson = flag("--json");
const offline = flag("--no-probe");
const timeoutMs = Number(valueOf("--timeout") ?? 12_000);
const extraNames = (valueOf("--name") ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

/* ------------------------------------------------------------------ entorno */

function envValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${name}=`));
    if (line) return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function projectConfig() {
  const client = readFileSync(resolve(root, "src/integrations/supabase/client.ts"), "utf8");
  const url =
    envValue("VITE_SUPABASE_URL") ||
    client.match(/SUPABASE_URL\s*=\s*[\s\S]*?'(https:\/\/[^']+)'/)?.[1];
  const key =
    envValue("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    envValue("VITE_SUPABASE_ANON_KEY") ||
    client.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*[\s\S]*?'(eyJ[^']+)'/)?.[1];

  const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  const ref =
    config.match(/project_id\s*=\s*"([a-z0-9]+)"/)?.[1] || url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

  if (!url || !key || !ref) {
    throw new Error("No encuentro la URL, la clave publishable o el project-ref del proyecto.");
  }
  return { url: url.replace(/\/$/, ""), key, ref };
}

/* ---------------------------------------------------------------- inventario */

export function functionsOnDisk(dir = resolve(root, "supabase/functions")) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

export function declaredInConfig(text) {
  const declared = new Map();
  for (const match of text.matchAll(/\[functions\.([a-z0-9-]+)\]\s*\n(?:.*\n)*?verify_jwt\s*=\s*(true|false)/g)) {
    declared.set(match[1], match[2] === "true");
  }
  return declared;
}

export function readLedger(path = resolve(root, "supabase/functions-retired.json")) {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed.retired) ? parsed.retired : [];
}

/* ------------------------------------------------------------------ sondas */

const ABSENT_BODY = /requested function was not found/i;

/**
 * Interpreta la respuesta a `GET /functions/v1/<name>` sin sesión.
 *
 * Ojo con el 404: una función viva puede devolver 404 por su cuenta (una ruta
 * inexistente dentro de ella), así que solo cuenta como "no desplegada" cuando
 * el cuerpo es el de la plataforma. El 404 desnudo se marca como ambiguo para
 * que nadie borre una función por un falso negativo.
 */
export function interpretProbe(status, body) {
  const text = String(body ?? "");
  if (status === 404) {
    return ABSENT_BODY.test(text)
      ? { deployed: false, signal: "404 de la plataforma" }
      : { deployed: "ambiguous", signal: "404 propio de la función: no concluyente" };
  }
  if (status === 0) return { deployed: "unknown", signal: text.slice(0, 60) };
  if (status === 401 || status === 403) return { deployed: true, signal: `${status} protegida` };
  if (status === 400) return { deployed: true, signal: "400 valida la entrada" };
  if (status === 405) return { deployed: true, signal: "405 responde a otro método" };
  if (status === 429) return { deployed: true, signal: "429 rate limit del guard" };
  if (status >= 200 && status < 300) return { deployed: true, signal: `${status} responde` };
  if (status >= 500) return { deployed: true, signal: `${status} falla pero existe` };
  return { deployed: "ambiguous", signal: `${status} no concluyente` };
}

async function probe(project, name) {
  const endpoint = `${project.url}/functions/v1/${name}`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { apikey: project.key },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    return interpretProbe(response.status, body);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return interpretProbe(0, /timeout|abort/i.test(reason) ? "sin respuesta (timeout)" : reason);
  }
}

/** Lista autoritativa. Requiere un token de cuenta, no la clave publishable. */
async function listDeployed(project, token) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project.ref}/functions`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`La API de administración respondió HTTP ${response.status}: ${(await response.text()).slice(0, 120)}`);
  }
  const list = await response.json();
  return new Map(
    list.map((fn) => [fn.slug ?? fn.name, {
      status: fn.status ?? "ACTIVE",
      version: fn.version,
      updatedAt: fn.updated_at,
      verifyJwt: fn.verify_jwt,
    }]),
  );
}

/* --------------------------------------------------------------- referencias */

const CODE_DIRS = ["src", "api", "backend", "scripts", "supabase/functions", ".github"];
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|toml|yml|yaml|html|md|sql|sh)$/;
const SKIP = /(node_modules|dist|build|coverage|\.git|screenshots)/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (SKIP.test(path)) continue;
    if (entry.isDirectory()) walk(path, out);
    else if (TEXT_EXT.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * Dónde se nombra cada función. `code` es lo que rompe si la apagas (un
 * `functions.invoke("x")`, una URL, un cron); `docs` es lo que solo hay que
 * actualizar. Se ignora `supabase/config.toml` porque ahí aparecen todas.
 */
export function findReferences(name, files = walkAllFiles()) {
  const pattern = new RegExp(`(^|[^a-z0-9-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9-]|$)`, "i");
  const hits = { code: [], docs: [] };
  for (const file of files) {
    if (file.endsWith("supabase/config.toml")) continue;
    // Este verificador y sus tests nombran a propósito las funciones del
    // registro; contarse a sí mismos como consumidores convertiría cualquier
    // retirada en un bloqueo.
    if (/^retire-functions(\.test)?\.mjs$/.test(file.split(/[\\/]/).pop() ?? "")) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!pattern.test(text)) continue;
    const relPath = relative(root, file);
    if (/^docs\//.test(relPath) || /\.md$/.test(relPath)) hits.docs.push(relPath);
    else hits.code.push(relPath);
  }
  return hits;
}

let fileCache = null;
function walkAllFiles() {
  if (fileCache) return fileCache;
  fileCache = CODE_DIRS.flatMap((dir) => walk(resolve(root, dir))).concat(
    ["vercel.json", "package.json"]
      .map((f) => resolve(root, f))
      .filter((f) => existsSync(f) && statSync(f).isFile()),
  );
  fileCache = [...new Set(fileCache)];
  return fileCache;
}

/* ------------------------------------------------------------- clasificación */

/**
 * Decide qué es cada función. Puro y exportado para poder probarlo: es la
 * lógica que justifica apagar algo, así que tiene que ser legible y testeable.
 */
export function classify({ onDisk, declared, deployed, candidates, references, coverage = "full" }) {
  const diskSet = new Set(onDisk);
  const deployedSet = deployed ? new Set(deployed.keys()) : null;

  const rows = [];
  for (const name of onDisk) {
    rows.push({
      name,
      // Solo la lista de la API de administración cubre también las funciones
      // del repositorio; las sondas se limitan a las candidatas.
      kind: coverage === "full" ? (deployedSet?.has(name) ? "live" : "not-deployed") : "in-repo",
      declared: declared.has(name),
      references: references.get(name) ?? { code: [], docs: [] },
    });
  }

  const extra = [];
  for (const name of candidates) {
    if (diskSet.has(name)) continue;
    // Sin lista autoritativa, "no probado" y "no desplegada" no son lo mismo:
    // una sonda de solo candidatas nunca devuelve el conjunto completo.
    const deployedState =
      coverage === "none" ? "unprobed" : deployedSet?.has(name) ? "deployed" : "absent";
    extra.push({
      name,
      kind: deployedState === "absent" ? "already-gone" : "extra",
      deployed: deployedState,
      references: references.get(name) ?? { code: [], docs: [] },
    });
  }

  const orphanConfig = [...declared.keys()].filter((name) => !diskSet.has(name) && !candidates.includes(name));

  const blocking = [...rows, ...extra].filter(
    (row) => row.kind === "extra" && row.deployed !== "unprobed" && row.references.code.length > 0,
  );

  return { rows, extra, orphanConfig, blocking };
}

/* ------------------------------------------------------------------- salida */

const ICON = { ok: "✅", warn: "⚠️ ", fail: "❌", gone: "🪦" };

async function main() {
  const project = projectConfig();
  const onDisk = functionsOnDisk();
  const declared = declaredInConfig(readFileSync(resolve(root, "supabase/config.toml"), "utf8"));
  const ledger = readLedger();
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  const candidates = [...new Set([...ledger.map((entry) => entry.name), ...extraNames])].sort();

  let deployed = null;
  const probes = new Map();
  if (token) {
    deployed = await listDeployed(project, token);
  } else if (!offline) {
    for (const name of candidates) probes.set(name, await probe(project, name));
    // Las sondas solo aciertan a confirmar lo que ya conocemos: se pasan como
    // conjunto parcial, nunca como inventario completo.
    deployed = new Map(
      [...probes]
        .filter(([, result]) => result.deployed === true)
        .map(([name]) => [name, { status: "probe", version: null }]),
    );
  }

  const references = new Map();
  const namesToScan = new Set([...onDisk, ...candidates]);
  for (const name of namesToScan) references.set(name, findReferences(name));

  const result = classify({
    onDisk,
    declared,
    deployed,
    candidates,
    references,
    // `full` con token, `candidates` con sondas, `none` con --no-probe.
    coverage: token ? "full" : offline ? "none" : "candidates",
  });
  const tombstoned = new Map(ledger.map((entry) => [entry.name, entry]));

  const report = {
    project: project.url,
    mode: token ? "management-api" : offline ? "offline" : "probe",
    onDisk: onDisk.length,
    candidates: candidates.length,
    deployed: deployed ? [...deployed.keys()].sort() : null,
    probes: Object.fromEntries(probes),
    ...result,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nProyecto: ${project.url}`);
    console.log(
      token
        ? "Fuente: API de administración (lista completa de desplegadas)\n"
        : offline
          ? "Fuente: solo repositorio (sin sondas)\n"
          : `Fuente: sondas HTTP a ${candidates.length} candidatas del registro (sin SUPABASE_ACCESS_TOKEN no se pueden descubrir nombres nuevos)\n`,
    );

    const extrasAlive = result.extra.filter((row) => row.kind === "extra" && row.deployed !== "unprobed").length;
    console.log(`En repositorio: ${onDisk.length} · Desplegadas fuera del repo: ${extrasAlive}`);

    console.log("\nDESPLEGADAS FUERA DEL REPOSITORIO (candidatas a retirada)");
    if (!result.extra.length) console.log("  (ninguna)");
    const states = new Map(
      result.extra.map((row) => [
        row.name,
        row.kind === "already-gone"
          ? `${ICON.gone} ya no está desplegada`
          : row.deployed === "unprobed"
            ? `${ICON.warn} sin comprobar (usa SUPABASE_ACCESS_TOKEN)`
            : `${ICON.warn} SIGUE DESPLEGADA · ${probes.get(row.name)?.signal ?? (deployed?.get(row.name)?.version ? `versión ${deployed.get(row.name).version}` : "")}`,
      ]),
    );
    const width = Math.max(0, ...[...states.values()].map((state) => state.length)) + 2;
    for (const row of result.extra) {
      const state = states.get(row.name);
      const when = tombstoned.get(row.name)?.removedFromRepo;
      console.log(`  ${state.padEnd(width)}${row.name}${when ? `   (fuera del repo desde ${when})` : ""}`);
      if (row.references.code.length) {
        console.log(`      ${ICON.fail} todavía se llama desde el código: ${row.references.code.slice(0, 4).join(", ")}`);
      } else {
        console.log("      sin llamadas en el código");
      }
      if (row.references.docs.length) {
        console.log(`      solo mencionada en: ${row.references.docs.slice(0, 3).join(", ")}`);
      }
    }

    if (deployed) {
      const missing = result.rows.filter((row) => row.kind === "not-deployed");
      console.log(`\nEN EL REPOSITORIO PERO SIN DESPLEGAR (${missing.length})`);
      if (!missing.length) console.log("  (ninguna)");
      for (const row of missing) console.log(`  ${ICON.warn} ${row.name} — ${row.references.code.length} referencias en código`);
    }

    console.log(`\nDECLARADAS EN config.toml SIN CARPETA (${result.orphanConfig.length})`);
    if (!result.orphanConfig.length) console.log("  (ninguna)");
    for (const name of result.orphanConfig) console.log(`  ${ICON.warn} ${name} — borra la entrada [functions.${name}]`);

    if (!token && !offline) {
      console.log(
        "\nNota: sin SUPABASE_ACCESS_TOKEN esta comprobación solo cubre los nombres del registro.\n" +
          "Para la lista completa: export SUPABASE_ACCESS_TOKEN=… && npm run functions:retire",
      );
    }
  }

  const hasExtras = result.extra.some((row) => row.kind === "extra");
  if (result.blocking.length) process.exit(1);
  if (strict && hasExtras) process.exit(1);
  process.exit(0);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  });
}
