#!/usr/bin/env node
/**
 * Un solo comando para desplegar la superficie viva de AiTor y comprobar que
 * responde: `/api/mcp`, `/api/telegram-webhook` y `github-proxy`.
 *
 * Por qué existe: cada pieza se desplegaba de una forma distinta y el resultado
 * se daba por bueno sin mirarlo. `/api/mcp` y el webhook viven en Vercel y sólo
 * cambian cuando el commit está en `main` (Vercel está conectado al repo);
 * `github-proxy` es una Edge Function y necesita la CLI de Supabase. Mezclar
 * ambos desde la memoria falla: se despliega una parte y la otra sigue vieja.
 *
 * Uso:
 *   node scripts/deploy-all.mjs                 # despliega lo que pueda y verifica
 *   node scripts/deploy-all.mjs --push          # además empuja `main` (dispara Vercel)
 *   node scripts/deploy-all.mjs --verify        # sólo comprobaciones de salud
 *   node scripts/deploy-all.mjs --dry-run       # enseña el plan, no ejecuta nada
 *   node scripts/deploy-all.mjs --only=supabase # una sola parte (vercel|supabase)
 *
 * Variables (entorno o .env / .env.local):
 *   SUPABASE_ACCESS_TOKEN   obligatoria para desplegar `github-proxy`
 *   SUPABASE_PROJECT_REF    por defecto wkdtvrxavkhbifjtvvdw
 *   PUBLIC_URL              por defecto https://aitor.alienflow.space
 *
 * Nunca imprime tokens. Si falta una credencial, lo dice y sigue con el resto:
 * un despliegue a medias con el informe delante es más útil que un aborto.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Carga un `.env` sin dependencias y sin pisar lo que ya venga del entorno. */
function loadDotEnv(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, name, raw] = match;
    if (process.env[name]) continue;
    process.env[name] = raw.replace(/^["']|["']$/g, "");
  }
}
loadDotEnv(".env");
loadDotEnv(".env.local");

const args = new Set(process.argv.slice(2));
const only = [...args]
  .find((arg) => arg.startsWith("--only="))?.slice("--only=".length);
const dryRun = args.has("--dry-run");
const onlyVerify = args.has("--verify");

const PUBLIC_URL = (process.env.PUBLIC_URL || "https://aitor.alienflow.space").replace(/\/$/, "");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "wkdtvrxavkhbifjtvvdw";
const MCP_URL = `${PUBLIC_URL}/api/mcp`;
const TELEGRAM_URL = `${PUBLIC_URL}/api/telegram-webhook`;
const GITHUB_PROXY_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/github-proxy`;
const REPO = "Alien69Flow/AiTor";

/**
 * Plan de despliegue: qué se puede hacer con las credenciales que hay.
 *
 * Es una función pura para poder probarla: lo que decide si un paso corre no
 * puede depender de que el script esté a medias.
 */
export function planSteps(env, options = {}) {
  const only = options.only || null;
  const conSupabase = Boolean((env.SUPABASE_ACCESS_TOKEN || "").trim());
  const steps = [];

  if (!only || only === "vercel") {
    steps.push({
      id: "vercel",
      label: "/api/mcp + /api/telegram-webhook (Vercel)",
      // Vercel está conectado al repo: el despliegue lo dispara el empuje a
      // `main`, no una CLI con token. El script sólo empuja si se le pide.
      command: ["git", ["push", "origin", "main"]],
      needs: options.push ? null : "empujar main (--push) para disparar el despliegue",
      push: Boolean(options.push),
    });
  }

  if (!only || only === "supabase") {
    steps.push({
      id: "supabase",
      label: "github-proxy (Edge Function)",
      command: [
        "npx",
        ["supabase", "functions", "deploy", "github-proxy", "--project-ref", PROJECT_REF],
      ],
      needs: conSupabase
        ? null
        : "SUPABASE_ACCESS_TOKEN (o `npx supabase login` una vez)",
    });
  }

  return steps;
}

/** `/api/mcp`: que conteste y que diga cuántas herramientas ve. */
export function interpretMcp(status, payload) {
  if (status !== 200 || !payload || payload.ok !== true) {
    return { ok: false, detail: `HTTP ${status}` };
  }
  const clave =
    payload.geminiKeyState === "ok"
      ? "clave ok"
      : payload.geminiKeyState === "placeholder"
        ? "clave con marcador de posición"
        : "sin clave (chat sin herramientas)";
  return { ok: true, detail: `${payload.tools} herramientas · ${clave}` };
}

/** Webhook de Telegram: registrado en la URL buena, sin atrasos ni errores. */
export function interpretTelegram(status, payload) {
  if (status !== 200 || !payload || payload.ok !== true) {
    return { ok: false, detail: `HTTP ${status}` };
  }
  const webhook = payload.webhook || {};
  const pendientes = webhook.pendingUpdates ?? "?";
  const problemas = [];
  if (webhook.matchesExpected === false) problemas.push("URL registrada distinta");
  if (typeof pendientes === "number" && pendientes > 0) problemas.push(`${pendientes} pendientes`);
  if (webhook.lastErrorMessage) problemas.push("último envío con error");
  const secreto = payload.secretConfigured ? "firma activa" : "sin firma";
  return {
    ok: problemas.length === 0,
    detail: problemas.length > 0 ? problemas.join(" · ") : `al día · ${secreto}`,
  };
}

/**
 * `github-proxy`: desplegada responde (401 sin sesión, 400 con cuerpo raro);
 * sin desplegar responde 404. Ese 404 es la única señal fiable de "no está".
 */
export function interpretGithubProxy(status) {
  if (status === 404) return { ok: false, detail: "404: la función no está desplegada" };
  if (status >= 200 && status < 500) return { ok: true, detail: `desplegada (HTTP ${status} sin sesión)` };
  return { ok: false, detail: `HTTP ${status}` };
}

async function getJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  try {
    return { status: response.status, payload: JSON.parse(text) };
  } catch {
    return { status: response.status, payload: null, raw: text.slice(0, 200) };
  }
}

async function checkMcp() {
  const { status, payload, raw } = await getJson(MCP_URL);
  const result = interpretMcp(status, payload);
  if (!result.ok && raw) result.detail += ` · ${raw}`;
  return result;
}

async function checkTelegram() {
  const { status, payload, raw } = await getJson(TELEGRAM_URL);
  const result = interpretTelegram(status, payload);
  if (!result.ok && raw) result.detail += ` · ${raw}`;
  return result;
}

async function checkGithubProxy() {
  const { status } = await getJson(GITHUB_PROXY_URL);
  return interpretGithubProxy(status);
}

/**
 * Vercel despliega al empujar a `main`, así que el despliegue "termina" cuando
 * GitHub recibe el estado de Vercel para ese commit. Se consulta la API pública
 * (el repo es público) con un tope de tiempo razonable.
 */
async function waitForVercel(sha, timeoutMs = 8 * 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`https://api.github.com/repos/${REPO}/commits/${sha}/status`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "aitor-deploy" },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (response?.ok) {
      const payload = await response.json().catch(() => null);
      const vercel = (payload?.statuses || []).find((entry) => /vercel/i.test(entry.context || ""));
      if (vercel?.state === "success") return { ok: true, detail: `Vercel: ${vercel.description || "listo"}` };
      if (vercel?.state === "failure" || vercel?.state === "error") {
        return { ok: false, detail: `Vercel: ${vercel.description || "falló"}` };
      }
      if (vercel?.state) return { ok: true, detail: `Vercel: ${vercel.state}` };
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return { ok: false, detail: "Vercel no publicó estado para ese commit a tiempo" };
}

function run(command, commandArgs, label) {
  console.log(`\n→ ${label}\n  ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: "inherit" });
  return result.status === 0;
}

async function main() {
  const steps = planSteps(process.env, { only, push: args.has("--push") });
  const skipped = steps.filter((step) => step.needs);

  console.log(`\nAiTor · despliegue y salud`);
  console.log(`${PUBLIC_URL} · proyecto Supabase ${PROJECT_REF}`);
  console.log(`Pasos: ${steps.map((step) => step.id).join(", ") || "ninguno"}`);

  for (const step of skipped) {
    console.log(`  ⏭  ${step.label}: ${step.needs}`);
  }

  if (!dryRun && !onlyVerify) {
    for (const step of steps) {
      if (step.needs || !step.command) continue;
      const [command, commandArgs] = step.command;
      if (!run(command, commandArgs, step.label)) {
        console.error(`✖ Falló: ${step.label}`);
        process.exitCode = 1;
      }
    }

    if (steps.some((step) => step.id === "vercel" && step.push && !step.needs)) {
      const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" })
        .stdout?.trim();
      if (head) {
        const vercel = await waitForVercel(head);
        console.log(`  ${vercel.ok ? "✅" : "⚠️ "} ${vercel.detail}`);
        if (!vercel.ok) process.exitCode = 1;
      }
    }
  }

  console.log("\nSalud");
  const checks = [
    ["/api/mcp", checkMcp],
    ["/api/telegram-webhook", checkTelegram],
    ["github-proxy", checkGithubProxy],
  ];
  for (const [name, check] of checks) {
    const result = await check();
    console.log(`  ${result.ok ? "✅" : "❌"} ${name.padEnd(22)} ${result.detail}`);
    if (!result.ok) process.exitCode = 1;
  }

  console.log(
    process.exitCode
      ? "\nHay algo que revisar (arriba)."
      : "\nTodo responde: despliegue y salud en orden.",
  );
}

// Sólo ejecuta si se llama directamente: el test importa las funciones puras.
if (process.argv[1] && process.argv[1].endsWith("deploy-all.mjs")) {
  await main();
}
