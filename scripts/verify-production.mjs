#!/usr/bin/env node
/**
 * Una pasada contra producción: webhook, salud, memoria y cron.
 *
 * Por qué existe: el ROADMAP marcaba fases con ✅ escrito a mano y varias
 * estaban verdes en papel y mudas en producción (la memoria devolvía 404, el
 * cron no tenía Redis). Esto ejecuta la comprobación de cada fase y devuelve un
 * código de salida que CI puede leer.
 *
 * Uso:
 *   node scripts/verify-production.mjs
 *   node scripts/verify-production.mjs --only=memoria
 *   node scripts/verify-production.mjs --json
 *   node scripts/verify-production.mjs --run-cron   # ejecuta el cron de verdad
 *
 * Variables (entorno o .env / .env.local):
 *   PUBLIC_URL                  por defecto https://aitor.alienflow.space
 *   SUPABASE_PROJECT_REF        por defecto wkdtvrxavkhbifjtvvdw
 *   SUPABASE_URL                opcional; si no, se deriva del project ref
 *   SUPABASE_SERVICE_ROLE_KEY   necesaria para probar la memoria (sin ella: ⏭)
 *   CRON_SECRET                 necesaria para --run-cron
 *
 * Códigos de salida: 0 todo verde · 1 algún fallo · 2 nada falló pero algo
 * quedó sin verificar. Nunca imprime claves ni contenido de conversaciones.
 */

import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const only = [...args].find((arg) => arg.startsWith("--only="))?.slice("--only=".length) || null;
const asJson = args.has("--json");
const runCron = args.has("--run-cron");

const PUBLIC_URL = (process.env.PUBLIC_URL || "https://aitor.alienflow.space").replace(/\/+$/, "");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "wkdtvrxavkhbifjtvvdw";
const SUPABASE_URL = (process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`).replace(/\/+$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();

export const ids = ["webhook", "health", "memoria", "cron"];

const ok = (detail) => ({ status: "ok", detail });
const warn = (detail) => ({ status: "warn", detail });
const fail = (detail) => ({ status: "fail", detail });
const skip = (detail) => ({ status: "skip", detail });

/**
 * Webhook: vive, identifica al bot, apunta a la URL buena y no arrastra
 * entregas. Sin firma funciona, pero es un aviso (Fase 8): cualquiera puede
 * gastar cuota del modelo.
 */
export function interpretWebhook(status, payload) {
  if (status !== 200 || !payload || payload.ok !== true) {
    return fail(`HTTP ${status}${payload?.error ? `: ${payload.error}` : ""}`);
  }
  const webhook = payload.webhook || {};
  const problemas = [];
  if (webhook.matchesExpected === false) problemas.push("URL registrada distinta");
  if (typeof webhook.pendingUpdates === "number" && webhook.pendingUpdates > 0) {
    problemas.push(`${webhook.pendingUpdates} entregas pendientes`);
  }
  if (webhook.lastErrorMessage) problemas.push("último envío con error");
  if (problemas.length > 0) return fail(problemas.join(" · "));

  const bot = payload.bot?.username ? `@${payload.bot.username}` : "bot sin identificar";
  const base = `${bot} · ${payload.registration || "sin registro"}`;
  return payload.secretConfigured
    ? ok(`${base} · firma activa`)
    : warn(`${base} · sin firma (configura TELEGRAM_WEBHOOK_SECRET)`);
}

/**
 * Salud: el endpoint responde y dice qué sabe. `UNCONFIGURED` es la verdad, no
 * un fallo del endpoint: avisa de que sin Redis no se puede comprobar frescura.
 * Un upstream caído se marca como aviso: el webhook es la autoridad sobre el
 * chat, y aquí puede discrepar por la clave usada.
 */
export function interpretHealth(status, payload) {
  if (status !== 200 || !payload || typeof payload.status !== "string") {
    return fail(`HTTP ${status} sin veredicto`);
  }
  const upstreams = Array.isArray(payload.upstreams) ? payload.upstreams : [];
  const resumen = upstreams.map((entry) => `${entry.key} ${entry.status}`).join(" · ") || "sin upstreams";
  if (payload.status === "UNCONFIGURED") {
    return warn(`${resumen} · falta Redis: la frescura no se puede comprobar`);
  }
  const caidos = upstreams.filter((entry) => entry.status === "DOWN").map((entry) => entry.key);
  if (caidos.length > 0) return warn(`${payload.status} · ${resumen} · caído: ${caidos.join(", ")}`);
  return ok(`${payload.status} · ${resumen}`);
}

/**
 * Cron sin secreto tiene que dar 401. Con secreto (`--run-cron`) se ejecuta de
 * verdad: `sin-redis` no es verde, porque sin almacén no puede disparar nada.
 */
export function interpretCron(status, payload, options = {}) {
  const withSecret = Boolean(options.withSecret);
  if (!withSecret) {
    if (status === 401) return ok("protegido: 401 sin Authorization");
    if (status === 200) return fail("responde 200 sin secreto: no está protegido");
    return fail(`HTTP ${status} sin secreto (se esperaba 401)`);
  }
  if (status !== 200 || !payload || payload.ok !== true) {
    return fail(`HTTP ${status} con el secreto correcto`);
  }
  if (payload.reason === "sin-redis") {
    return fail("responde 200 pero sin Redis: no puede disparar ninguna alerta");
  }
  const failures = Array.isArray(payload.failures) ? payload.failures : [];
  const base = `${payload.checked ?? 0} avisos · ${payload.fired ?? 0} disparados · ${payload.delivered ?? 0} entregados`;
  return failures.length > 0 ? warn(`${base} · fuentes caídas: ${failures.join(", ")}`) : ok(base);
}

/** La sonda de memoria sólo es verde con ida y vuelta completa y borrada. */
export function interpretMemory(result) {
  if (!result.configured) {
    return skip("falta SUPABASE_SERVICE_ROLE_KEY: no se puede probar el hilo desde aquí");
  }
  if (result.error) return fail(result.error);
  const malas = (result.statuses || []).filter((entry) => entry.status >= 300);
  if (malas.length > 0) {
    return fail(malas.map((entry) => `${entry.name} HTTP ${entry.status}`).join(" · "));
  }
  if (!result.saved) return fail("no se pudo guardar el turno de prueba");
  if (!result.readBack) return fail("el turno guardado no se pudo leer de vuelta");
  if (!result.cleaned) return fail("la sonda no se pudo borrar: revisa chat_threads");
  return ok("ida y vuelta de 2 turnos, y borrada");
}

export function summarize(results) {
  const count = (status) => results.filter((entry) => entry.status === status).length;
  const summary = { ok: count("ok"), warn: count("warn"), fail: count("fail"), skip: count("skip") };
  summary.exitCode = summary.fail > 0 ? 1 : summary.skip > 0 ? 2 : 0;
  return summary;
}

const ICON = { ok: "✅", warn: "⚠️ ", fail: "❌", skip: "⏭️ " };

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  try {
    return { status: response.status, payload: JSON.parse(text) };
  } catch {
    return { status: response.status, payload: null, raw: text.slice(0, 160) };
  }
}

async function checkWebhook() {
  const { status, payload, raw } = await getJson(`${PUBLIC_URL}/api/telegram-webhook`);
  const result = interpretWebhook(status, payload);
  if (result.status === "fail" && raw) result.detail += ` · ${raw}`;
  // La conclusión de `?probe=1` es la Fase 1: dice qué extremo falla, gratis.
  if (result.status !== "fail") {
    const probe = await getJson(`${PUBLIC_URL}/api/telegram-webhook?probe=1`).catch(() => null);
    const conclusion = probe?.payload?.chatProbe?.conclusion;
    if (typeof conclusion === "string" && conclusion) result.detail += ` · ${conclusion}`;
  }
  return { id: "webhook", ...result };
}

async function checkHealth() {
  const { status, payload } = await getJson(`${PUBLIC_URL}/api/health?compact=1`);
  return { id: "health", ...interpretHealth(status, payload) };
}

/**
 * Cron: primero la puerta (sin secreto), y sólo con `--run-cron` la ejecución
 * real. Ejecutarlo puede enviar avisos a chats reales, así que no es implícito.
 */
async function checkCron() {
  const gate = await getJson(`${PUBLIC_URL}/api/cron/price-alerts`);
  const gateResult = interpretCron(gate.status, gate.payload);
  if (gateResult.status !== "ok") return { id: "cron", ...gateResult };
  if (!runCron) {
    return { id: "cron", ...ok(`${gateResult.detail} · ejecución real omitida (--run-cron)`) };
  }
  if (!CRON_SECRET) {
    return { id: "cron", ...skip(`${gateResult.detail} · falta CRON_SECRET para ejecutarlo`) };
  }
  const run = await getJson(`${PUBLIC_URL}/api/cron/price-alerts`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  return { id: "cron", ...interpretCron(run.status, run.payload, { withSecret: true }) };
}

/**
 * Memoria: se prueba el mismo camino que usa el webhook (PostgREST con la
 * service key) con un token de usar y tirar. El hilo se borra siempre al final;
 * si el borrado falla, la sonda lo dice en vez de esconderlo.
 */
async function probeMemory() {
  const result = { configured: Boolean(SERVICE_KEY), statuses: [], saved: false, readBack: false, cleaned: false };
  if (!SERVICE_KEY) return result;

  const token = `tg_${randomBytes(16).toString("hex")}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  const call = async (name, path, init = {}) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      signal: AbortSignal.timeout(15_000),
    });
    result.statuses.push({ name, status: response.status });
    return response;
  };

  try {
    const upsert = await call("alta del hilo", "chat_threads?on_conflict=surface,external_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        { surface: "telegram", external_id: token, last_active_at: new Date().toISOString() },
      ]),
    });
    if (upsert.ok) {
      const rows = await upsert.json().catch(() => []);
      const threadId = rows?.[0]?.id;
      if (threadId) {
        const inserted = await call("guardar turno", "chat_turns", {
          method: "POST",
          body: JSON.stringify([
            { thread_id: threadId, role: "user", content: "sonda: hola" },
            { thread_id: threadId, role: "assistant", content: "sonda: hola" },
          ]),
        });
        result.saved = inserted.ok;
        const read = await call(
          "leer turnos",
          `chat_turns?thread_id=eq.${encodeURIComponent(threadId)}&select=role,content&order=id.desc&limit=8`,
        );
        const turns = read.ok ? await read.json().catch(() => []) : [];
        result.readBack = Array.isArray(turns) && turns.length === 2;
      }
    }
  } catch (error) {
    result.error = `memoria: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    try {
      const deleted = await call(
        "borrar sonda",
        `chat_threads?surface=eq.telegram&external_id=eq.${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
      result.cleaned = deleted.ok;
    } catch {
      result.cleaned = false;
    }
  }
  return result;
}

async function checkMemory() {
  return { id: "memoria", ...interpretMemory(await probeMemory()) };
}

async function main() {
  if (args.has("--help") || args.has("-h")) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    return;
  }

  const checks = { webhook: checkWebhook, health: checkHealth, memoria: checkMemory, cron: checkCron };
  const selected = ids.filter((id) => !only || id === only);
  if (selected.length === 0) {
    console.error(`--only desconocido: ${only}. Válidos: ${ids.join(", ")}`);
    process.exitCode = 2;
    return;
  }

  const results = [];
  for (const id of selected) results.push(await checks[id]());
  const summary = summarize(results);
  process.exitCode = summary.exitCode;

  if (asJson) {
    console.log(JSON.stringify({ url: PUBLIC_URL, supabase: PROJECT_REF, results, summary }, null, 2));
    return;
  }

  console.log(`\nAiTor · verificación de producción`);
  console.log(`${PUBLIC_URL} · Supabase ${PROJECT_REF}\n`);
  for (const result of results) {
    console.log(`  ${ICON[result.status]} ${result.id.padEnd(8)} ${result.detail}`);
  }
  console.log(
    `\nResumen: ${summary.ok} ok · ${summary.warn} avisos · ${summary.fail} fallos · ${summary.skip} sin verificar`,
  );
  if (summary.exitCode === 1) console.log("Hay fallos: producción no cumple el criterio de alguna fase.");
  else if (summary.exitCode === 2) console.log("Nada falló, pero quedó algo sin verificar (mira los ⏭).");
  else console.log("Todo lo comprobado responde.");
}

if (process.argv[1] && process.argv[1].endsWith("verify-production.mjs")) {
  await main();
}
