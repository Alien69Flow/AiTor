#!/usr/bin/env node
/**
 * Configura y verifica la clave de Gemini que usa el bucle de herramientas de
 * `/api/mcp`.
 *
 * El bucle vive en `api/mcp.ts` y lee `GEMINI_API_KEY` **en cada petición**, así
 * que no hay nada que compilar: la clave sólo tiene que estar en las variables
 * del proyecto de Vercel y en el despliegue de producción. Lo que faltaba era
 * poder comprobarlo sin abrir el panel y sin pegar la clave en un chat.
 *
 * Uso:
 *   node scripts/vercel-gemini-key.mjs --check    # valida la clave contra Gemini
 *   node scripts/vercel-gemini-key.mjs --set      # la registra en Vercel y verifica
 *   node scripts/vercel-gemini-key.mjs --verify   # estado del endpoint desplegado
 *
 * Variables (entorno o .env / .env.local):
 *   GEMINI_API_KEY        clave de Google AI Studio (empieza por AIza)
 *   VERCEL_TOKEN          token de cuenta (Account → Tokens), sólo para --set
 *   VERCEL_PROJECT_ID     id o nombre del proyecto en Vercel (o .vercel/project.json)
 *   VERCEL_TEAM_ID        opcional, si el proyecto vive en un equipo
 *   MCP_URL               por defecto https://aitor.alienflow.space/api/mcp
 *
 * Nunca imprime el valor de la clave: sólo su forma y el veredicto del proveedor.
 */

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

const args = new Set(process.argv.slice(2));
const mode = args.has("--set") ? "set" : args.has("--check") ? "check" : "verify";
const KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const MCP_URL = process.env.MCP_URL || "https://aitor.alienflow.space/api/mcp";
const VERCEL_API = "https://api.vercel.com";

/** Mismo criterio que `geminiKeyState` en api/mcp.ts. */
function keyState(key) {
  if (!key) return "missing";
  if (key.length < 20 || /\s/.test(key)) return "placeholder";
  if (/^(xxx+|changeme|tu[_-]|your[_-]|pon[_-]|aqui|aquí|placeholder|<)/i.test(key)) return "placeholder";
  return "ok";
}

/** Enmascara la clave si apareciera dentro de un mensaje del proveedor. */
const mask = (text) => (KEY.length > 6 ? String(text).split(KEY).join("***") : String(text));

/** Comprueba la clave contra la API real: lista de modelos que pueden generar. */
async function checkKey() {
  const state = keyState(KEY);
  console.log(`Clave local : ${state === "ok" ? "presente y con forma de clave" : state}`);
  if (state !== "ok") {
    console.error(
      "\n✖ Falta GEMINI_API_KEY o tiene forma de marcador de posición.\n" +
        "  Crea una en https://aistudio.google.com/apikey y guárdala en .env:\n" +
        "    GEMINI_API_KEY=AIza...",
    );
    return false;
  }

  let response;
  try {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": KEY },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error(`✖ Sin respuesta de Gemini: ${mask(error instanceof Error ? error.message : error)}`);
    return false;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`✖ Gemini respondió ${response.status}: ${mask(detail).slice(0, 200)}`);
    if (response.status === 400 || response.status === 403) {
      console.error("  La clave no es válida para la API de Gemini (¿es de Vertex AI u otra cuenta?).");
    }
    return false;
  }

  const payload = await response.json();
  const models = (payload.models ?? []).filter((model) =>
    (model.supportedGenerationMethods ?? []).includes("generateContent"),
  );
  const chat = models.filter((model) => !/embedding|imagen|tts|veo|vision/i.test(model.name));
  const images = models.filter((model) => /image/i.test(model.name));
  console.log(`Gemini OK   : ${models.length} modelos con generateContent`);
  console.log(`  chat      : ${chat.length}${chat[0] ? ` (p. ej. ${chat[0].name.replace(/^models\//, "")})` : ""}`);
  console.log(`  imagen    : ${images.length}${images[0] ? ` (p. ej. ${images[0].name.replace(/^models\//, "")})` : " — media.image no tendrá modelo"}`);
  return true;
}

/** Proyecto de Vercel: `.vercel/project.json` o variables de entorno. */
function projectTarget() {
  const linked = join(ROOT, ".vercel", "project.json");
  if (existsSync(linked)) {
    try {
      const parsed = JSON.parse(readFileSync(linked, "utf8"));
      if (parsed.projectId) return { projectId: parsed.projectId, teamId: parsed.orgId ?? null };
    } catch {
      /* se sigue con las variables */
    }
  }
  return {
    projectId: process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT || null,
    teamId: process.env.VERCEL_TEAM_ID || null,
  };
}

/** Registra la clave en producción. `upsert=true` rota el valor si ya existía. */
async function pushToVercel() {
  const token = process.env.VERCEL_TOKEN;
  const { projectId, teamId } = projectTarget();

  if (!token) {
    console.error(
      "\n✖ Falta VERCEL_TOKEN (Vercel → Account Settings → Tokens).\n" +
        "  Sin token también vale el panel: Project → Settings → Environment Variables\n" +
        "  → GEMINI_API_KEY, entorno Production. Después, Redeploy.",
    );
    return false;
  }
  if (!projectId) {
    console.error(
      "\n✖ No sé a qué proyecto de Vercel apuntar. Ejecuta `vercel link` en la raíz\n" +
        "  o define VERCEL_PROJECT_ID (y VERCEL_TEAM_ID si es de un equipo).",
    );
    return false;
  }

  const query = new URLSearchParams({ upsert: "true" });
  if (teamId) query.set("teamId", teamId);
  const url = `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env?${query}`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        key: "GEMINI_API_KEY",
        value: KEY,
        type: "encrypted",
        target: ["production"],
        comment: "Bucle de herramientas de /api/mcp (Gemini)",
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error(`✖ Sin respuesta de la API de Vercel: ${error instanceof Error ? error.message : error}`);
    return false;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
    console.error(`✖ Vercel rechazó la variable: ${mask(detail)}`);
    return false;
  }

  console.log(`✔ GEMINI_API_KEY registrada en Production de ${projectId}.`);
  console.log(
    "  Vercel no reinyecta variables en despliegues ya hechos: hace falta un\n" +
      "  redeploy producto para que /api/mcp la lea (Project → Deployments → Redeploy).",
  );
  return true;
}

/** Estado real del bucle desplegado, sin sesión. */
async function verifyEndpoint() {
  let response;
  try {
    response = await fetch(MCP_URL, { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    console.error(`✖ Sin respuesta de ${MCP_URL}: ${error instanceof Error ? error.message : error}`);
    return false;
  }

  const raw = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    /* no JSON */
  }

  if (response.status === 404) {
    console.error(`✖ ${MCP_URL} responde 404: la función /api/mcp no está desplegada en ese dominio.`);
    console.error("  Sin desplegarla, el chat nunca usará herramientas aunque la clave exista.");
    return false;
  }
  if (!response.ok || !payload) {
    console.error(`✖ ${MCP_URL} respondió ${response.status}: ${raw.slice(0, 200)}`);
    return false;
  }

  console.log(`\nBucle de herramientas en ${MCP_URL}`);
  console.log(`  geminiConfigured : ${payload.geminiConfigured}`);
  console.log(`  geminiKeyState   : ${payload.geminiKeyState ?? "(el despliegue no lo informa todavía)"}`);
  console.log(`  variable vista   : ${payload.envVarSeen ?? "(ninguna)"}`);
  console.log(`  herramientas     : ${payload.tools ?? "?"}`);
  console.log(`  rondas máximas   : ${payload.maxRounds ?? "?"}`);
  if (Array.isArray(payload.toolNames)) console.log(`  ${payload.toolNames.join(", ")}`);
  if (payload.hint) console.log(`  ${payload.hint}`);
  return Boolean(payload.geminiConfigured);
}

async function main() {
  if (mode === "check") {
    process.exit((await checkKey()) ? 0 : 1);
  }

  if (mode === "set") {
    if (!(await checkKey())) process.exit(1);
    if (!(await pushToVercel())) process.exit(1);
    // El endpoint seguirá diciendo «sin clave» hasta el redeploy: se informa,
    // pero no se falla por ello.
    await verifyEndpoint();
    return;
  }

  const ok = await verifyEndpoint();
  process.exit(ok ? 0 : 1);
}

main();
