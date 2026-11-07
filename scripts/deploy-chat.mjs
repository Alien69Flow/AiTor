#!/usr/bin/env node
/**
 * Despliega la función `chat` de Supabase y comprueba `?health=1`.
 *
 * El 7 de noviembre de 2026 el despliegue de `wkdtvrxavkhbifjtvvdw` era anterior
 * al informe de salud: `GET /functions/v1/chat?health=1` devolvía
 * `400 {"error":"Invalid JSON in request body"}` porque el handler sólo miraba
 * el cuerpo. Con este script, desplegar y verificar es el mismo paso: si el
 * informe no sale, el comando falla en vez de dar el despliegue por bueno.
 *
 * Uso:
 *   node scripts/deploy-chat.mjs            # despliega y verifica
 *   node scripts/deploy-chat.mjs --verify   # sólo verifica el desplegado
 *
 * Variables (entorno o .env / .env.local):
 *   SUPABASE_ACCESS_TOKEN   (obligatoria para desplegar; la CLI también acepta
 *                            `npx supabase login`, que la guarda en ~/.supabase)
 *   SUPABASE_PROJECT_REF    (por defecto wkdtvrxavkhbifjtvvdw)
 *
 * No imprime secretos: el informe público de la función sólo dice si cada clave
 * existe, nunca su valor.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!match) continue;
    let value = match[2];
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
loadDotEnv(".env");
loadDotEnv(".env.local");

const onlyVerify = new Set(process.argv.slice(2)).has("--verify");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "wkdtvrxavkhbifjtvvdw";
// `probe=1` hace que el informe llame de verdad a cada oráculo con una palabra:
// una clave revocada o un proveedor caído sólo se ven así, no mirando la clave.
const HEALTH_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/chat?health=1&probe=1`;

/** Estado por proveedor y por modelo, sin secretos. */
async function readHealth() {
  let response;
  try {
    response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(25_000) });
  } catch (error) {
    console.error(`✖ Sin respuesta de ${HEALTH_URL}: ${error instanceof Error ? error.message : error}`);
    return null;
  }

  const raw = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    /* respuesta no JSON: se enseña recortada */
  }

  if (response.status !== 200 || !payload || typeof payload !== "object") {
    console.error(`✖ ${HEALTH_URL} respondió ${response.status}`);
    console.error(`  ${raw.slice(0, 200)}`);
    if (response.status === 400) {
      console.error(
        "\n  Esa respuesta es la de la versión anterior de la función: el handler\n" +
          "  sólo miraba el cuerpo y no atiende GET/?health=1. Vuelve a desplegar\n" +
          "  (sin --verify) para que el informe exista.",
      );
    }
    return null;
  }
  return payload;
}

function printHealth(payload) {
  const providers = Array.isArray(payload.providers) ? payload.providers : [];
  const models = Array.isArray(payload.models) ? payload.models : [];

  console.log(`\nServicio   : ${payload.service ?? "(sin nombre)"}`);
  console.log(`Estado     : ${payload.status ?? "desconocido"}`);
  console.log(`Comprobado : ${payload.checkedAt ?? "(sin fecha)"}`);
  console.log(`Modelo por defecto : ${payload.defaultModel ?? "?"}`);
  console.log(`Modelo de reserva  : ${payload.fallbackModel ?? "?"}`);

  console.log("\nProveedores");
  for (const provider of providers) {
    const mark = provider.configured ? "✅" : provider.keyState === "missing" ? "⛔" : "⚠️ ";
    console.log(
      `  ${mark} ${String(provider.label ?? provider.id).padEnd(12)} ${String(provider.envVar ?? "").padEnd(28)} ` +
        `clave: ${String(provider.keyState ?? "?").padEnd(12)} modelos: ${(provider.models ?? []).length}`,
    );
  }

  console.log("\nOráculos");
  for (const model of models) {
    const probe = model.probe;
    // Con sonda manda la llamada real; sin ella, lo que diga la clave.
    const mark = probe ? (probe.ok ? "✅" : "❌") : model.available ? "✅" : "⛔";
    const detalle = probe
      ? probe.ok
        ? `respondió ${probe.ms} ms`
        : `falló ${probe.status === null ? "sin respuesta" : `HTTP ${probe.status}`}${probe.error ? ` · ${probe.error}` : ""}`
      : (model.reason ?? "");
    console.log(
      `  ${mark} ${String(model.id).padEnd(34)} ${String(model.provider ?? "").padEnd(12)} ${detalle}`,
    );
  }

  const listed = providers.length;
  const ready = providers.filter((provider) => provider.configured).length;
  console.log(`\n${ready}/${listed} proveedores con clave real.`);

  if (payload.probe) {
    const fallan = models.filter((model) => model.probe && !model.probe.ok);
    console.log(
      `Sonda real : ${payload.probe.ok}/${payload.probe.total} oráculos respondieron ` +
        `(${payload.probe.at}).`,
    );
    if (fallan.length > 0) {
      console.log(`  Sin respuesta: ${fallan.map((model) => model.id).join(", ")}`);
    }
  } else {
    console.log("Sonda real : no incluida en la respuesta (el despliegue es anterior a `probe=1`).");
  }
  return payload;
}

async function main() {
  if (!onlyVerify) {
    if (!existsSync(join(ROOT, "supabase", "functions", "chat", "index.ts"))) {
      console.error("✖ No encuentro supabase/functions/chat/index.ts: ejecuta el script desde el repositorio.");
      process.exit(1);
    }
    console.log(`→ Desplegando chat en ${PROJECT_REF}…`);
    const deploy = spawnSync(
      "npx",
      ["supabase", "functions", "deploy", "chat", "--project-ref", PROJECT_REF],
      { cwd: ROOT, stdio: "inherit", env: process.env },
    );
    if (deploy.status !== 0) {
      console.error(
        "\n✖ El despliegue falló. Si la CLI dice «Access token not provided»:\n" +
          "    export SUPABASE_ACCESS_TOKEN=...   # Account → Access Tokens\n" +
          "  o inicia sesión una vez con:  npx supabase login",
      );
      process.exit(1);
    }
  }

  const payload = await readHealth();
  if (!payload) process.exit(1);
  printHealth(payload);

  if (payload.status === "down") {
    console.error("\n✖ Ningún proveedor puede responder: el chat no tiene ninguna clave utilizable.");
    process.exit(1);
  }
  if (payload.status !== "ok") {
    console.log("\n→ Informe degradado: hay proveedores sin clave. Los oráculos marcados ⛔ no responderán.");
  }
  process.exit(0);
}

main();
