#!/usr/bin/env node
/**
 * El issue de la guardia: se abre (o se actualiza) cuando la sonda semanal
 * falla y se cierra solo cuando vuelve a verde.
 *
 * Por qué: el workflow se ponía rojo y nadie lo miraba hasta días después.
 * Ahora el rojo deja un issue con el detalle de la comprobación que falló, y
 * el verde lo cierra con un comentario y el enlace al run.
 *
 * Sin secretos nuevos: usa el token del propio workflow (`GITHUB_TOKEN`, con
 * `issues: write`). No inventa métricas ni resume lo que no hay: pega la salida
 * real de la sonda, recortada.
 *
 * Uso:
 *   node scripts/guardia-issue.mjs --dir .guardia [--dry-run]
 *
 * Lee `<comprobación>.code` y `<comprobación>.log` del directorio (los escribe
 * el workflow). `--dry-run` imprime lo que haría sin tocar GitHub.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Título fijo: es la clave con la que se busca el issue abierto. */
export const ISSUE_TITLE = "Guardia de producción en rojo";
export const ISSUE_LABEL = "guardia";
const MAX_LOG_CHARS = 6_000;
const API = "https://api.github.com";
const ANSI = /\u001b\[[0-9;]*m/g;

/** Códigos de `verify-production.mjs`, para no traducirlos mal en el issue. */
const CODE_MEANING = {
  0: "todo lo comprobado responde",
  1: "algún fallo: producción no cumple el criterio",
  2: "nada falló, pero algo quedó sin verificar",
};

export function stripAnsi(text) {
  return String(text).replace(ANSI, "");
}

/** Recorta por el principio: el final de la sonda trae la tabla y el detalle. */
export function tail(text, max = MAX_LOG_CHARS) {
  const clean = stripAnsi(text).trim();
  if (clean.length <= max) return clean;
  return `[… salida recortada, se conservan los últimos ${max} caracteres]\n${clean.slice(-max)}`;
}

/** Lee los resultados que dejó el workflow: `{ name, code, log }`. */
export function readResults(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".code"))
    .map((file) => {
      const name = file.slice(0, -".code".length);
      const raw = readFileSync(join(dir, file), "utf8").trim();
      const parsed = Number.parseInt(raw, 10);
      const logPath = join(dir, `${name}.log`);
      const log = existsSync(logPath) ? stripAnsi(readFileSync(logPath, "utf8")) : "";
      return { name, code: Number.isFinite(parsed) ? parsed : null, log };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Normaliza un código a 0 / 1 / 2; `null` (sin salida) cuenta como fallo. */
function normalizeCode(code) {
  return code === 0 || code === 1 || code === 2 ? code : 1;
}

/**
 * Qué hay que hacer: `red` abre o actualiza, `green` cierra, `unknown` no toca
 * nada (el job murió antes de escribir resultados; sin datos no se inventa).
 */
export function decide(results) {
  if (results.length === 0) return "unknown";
  return results.some((result) => normalizeCode(result.code) !== 0) ? "red" : "green";
}

export function buildIssueBody(results, { runUrl, now = new Date() } = {}) {
  const failed = results.filter((result) => normalizeCode(result.code) !== 0);
  const when = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  const rows = results.map(
    (result) =>
      `| \`${result.name}\` | ${result.code ?? "sin salida"} | ${CODE_MEANING[normalizeCode(result.code)] ?? ""} |`,
  );

  const details = failed
    .map((result) => {
      const body = result.log.trim() ? `\n\n\`\`\`\n${tail(result.log)}\n\`\`\`` : "\n\n(sin salida)";
      return `<details><summary><code>${result.name}</code> — código ${result.code ?? "sin salida"}</summary>${body}\n</details>`;
    })
    .join("\n\n");

  return [
    `La guardia semanal de producción falló el **${when}**.`,
    runUrl ? `Run: ${runUrl}` : null,
    "",
    "| Comprobación | Salida | Qué significa |",
    "| --- | --- | --- |",
    ...rows,
    "",
    details,
    "",
    "---",
    "Este issue lo mantiene `scripts/guardia-issue.mjs`: se actualiza en cada pasada roja y se cierra solo cuando la guardia vuelve a verde. No tiene secretos; sólo la salida de la sonda.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildRecoveryComment({ runUrl, now = new Date() } = {}) {
  const when = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  return [
    `La guardia volvió a verde el **${when}**.`,
    runUrl ? `Run: ${runUrl}` : null,
    "",
    "Cierro el issue. Si vuelve a fallar, se reabre uno nuevo con el detalle.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function createClient({ repo, token, fetchImpl }) {
  async function call(path, init = {}) {
    const response = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }
  return { call };
}

async function findOpenIssue(client, repo) {
  const { status, body } = await client.call(
    `/repos/${repo}/issues?state=open&per_page=100&sort=created&direction=asc`,
  );
  if (status !== 200 || !Array.isArray(body)) return null;
  return (
    body.find(
      (issue) => !issue.pull_request && issue.title === ISSUE_TITLE,
    ) ?? null
  );
}

async function ensureLabel(client, repo) {
  const { status } = await client.call(`/repos/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: ISSUE_LABEL,
      color: "b60205",
      description: "Abierto por la guardia semanal de producción",
    }),
  });
  // 201 = creada, 422 = ya existía. Cualquier otro código se ignora: la
  // etiqueta es una ayuda, no un requisito para avisar.
  return status === 201 || status === 422;
}

/**
 * Ejecuta la decisión contra GitHub. `dryRun` devuelve el payload sin llamar.
 * Nunca lanza por un fallo de la API: lo registra y sigue, porque el job ya
 * está en rojo por su cuenta y perder el aviso sería peor que no actualizarlo.
 */
export async function runGuardiaIssue({
  dir,
  dryRun = false,
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const results = readResults(dir);
  const verdict = decide(results);
  const repo = env.GITHUB_REPOSITORY ?? "";
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  const runUrl = env.GITHUB_RUN_ID ? `${server}/${repo}/actions/runs/${env.GITHUB_RUN_ID}` : null;
  const body = buildIssueBody(results, { runUrl, now });

  if (verdict === "unknown") {
    console.log("[guardia] sin resultados en el directorio: no hay nada que contar.");
    return { verdict, results, action: "none" };
  }

  if (dryRun) {
    console.log(`[guardia] ${verdict} (dry-run)`);
    console.log(verdict === "green" ? buildRecoveryComment({ runUrl, now }) : body);
    return { verdict, results, action: "dry-run", body };
  }

  const token = env.GITHUB_TOKEN ?? "";
  if (!repo || !token) {
    console.error("[guardia] faltan GITHUB_REPOSITORY o GITHUB_TOKEN: no puedo abrir el issue.");
    return { verdict, results, action: "skipped" };
  }

  const client = createClient({ repo, token, fetchImpl });
  const issue = await findOpenIssue(client, repo);

  if (verdict === "red") {
    if (issue) {
      const { status } = await client.call(`/repos/${repo}/issues/${issue.number}`, {
        method: "PATCH",
        body: JSON.stringify({ body, labels: [ISSUE_LABEL] }),
      });
      console.log(`[guardia] issue #${issue.number} actualizado (${status}).`);
      return { verdict, results, action: "updated", issue: issue.number };
    }

    await ensureLabel(client, repo);
    const { status, body: created } = await client.call(`/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title: ISSUE_TITLE, body, labels: [ISSUE_LABEL] }),
    });
    const number = created?.number ?? null;
    console.log(`[guardia] issue ${number ? `#${number}` : ""} abierto (${status}).`);
    return { verdict, results, action: "opened", issue: number };
  }

  if (!issue) {
    console.log("[guardia] verde y sin issue abierto: nada que cerrar.");
    return { verdict, results, action: "none" };
  }

  await client.call(`/repos/${repo}/issues/${issue.number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: buildRecoveryComment({ runUrl, now }) }),
  });
  const { status } = await client.call(`/repos/${repo}/issues/${issue.number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed", state_reason: "completed" }),
  });
  console.log(`[guardia] issue #${issue.number} cerrado (${status}).`);
  return { verdict, results, action: "closed", issue: issue.number };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = process.argv.slice(2);
  const dir = args.find((arg) => arg.startsWith("--dir="))?.slice("--dir=".length) ?? ".guardia";
  const dryRun = args.includes("--dry-run");
  runGuardiaIssue({ dir, dryRun }).catch((error) => {
    console.error("[guardia] fallo inesperado:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
