#!/usr/bin/env node
/**
 * Reports the real state of every sign-in method this app offers.
 *
 * Supabase exposes two public endpoints that answer without any secret:
 *
 *   GET /auth/v1/settings   → which providers are switched on
 *   GET /auth/v1/authorize  → whether a provider can actually start
 *
 * The second one is the one that matters: a provider can be toggled on and
 * still answer "missing OAuth secret", which is exactly the state that makes a
 * button look broken. This script probes both and prints one line per method
 * with the panel where it gets fixed, so enabling them is a checklist instead
 * of a guessing game.
 *
 * Usage: npm run auth:providers
 *
 * The URL and publishable key are read from the environment first
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, also from .env.local),
 * then from the defaults committed in src/integrations/supabase/client.ts.
 * The publishable key is public by design — it ships inside the browser
 * bundle — so reading it here leaks nothing.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every method the login page offers, with its GoTrue id and panel path. */
const METHODS = [
  { id: "google", label: "Google", panel: "Authentication → Providers → Google" },
  { id: "apple", label: "Apple", panel: "Authentication → Providers → Apple" },
  { id: "azure", label: "Microsoft", panel: "Authentication → Providers → Azure" },
  { id: "github", label: "GitHub", panel: "Authentication → Providers → GitHub" },
  { id: "x", label: "X", panel: "Authentication → Providers → X / Twitter" },
  { id: "discord", label: "Discord", panel: "Authentication → Providers → Discord" },
  { id: "facebook", label: "Facebook", panel: "Authentication → Providers → Facebook" },
  { id: "linkedin_oidc", label: "LinkedIn", panel: "Authentication → Providers → LinkedIn (OIDC)" },
  { id: "custom:reddit", label: "Reddit", panel: "Authentication → Providers → Custom Providers → custom:reddit" },
  { id: "twitch", label: "Twitch", panel: "Authentication → Providers → Twitch" },
  { id: "gitlab", label: "GitLab", panel: "Authentication → Providers → GitLab" },
  { id: "bitbucket", label: "Bitbucket", panel: "Authentication → Providers → Bitbucket" },
  { id: "slack_oidc", label: "Slack", panel: "Authentication → Providers → Slack (OIDC)" },
  { id: "spotify", label: "Spotify", panel: "Authentication → Providers → Spotify" },
  { id: "notion", label: "Notion", panel: "Authentication → Providers → Notion" },
  { id: "figma", label: "Figma", panel: "Authentication → Providers → Figma" },
  { id: "zoom", label: "Zoom", panel: "Authentication → Providers → Zoom" },
  { id: "kakao", label: "Kakao", panel: "Authentication → Providers → Kakao" },
  { id: "custom:wechat", label: "WeChat", panel: "Authentication → Providers → Custom Providers → custom:wechat" },
];

const EMAIL = { panel: "Authentication → Email" };
const PHONE = { panel: "Authentication → Phone (necesita Twilio/MessageBird/Vonage)" };

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const file = resolve(root, ".env.local");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${name}=`));
  return line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
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

  if (!url || !key) {
    console.error("No encuentro la URL y la clave publishable del proyecto.");
    process.exit(2);
  }
  return { url: url.replace(/\/$/, ""), key };
}

const { url, key } = projectConfig();
const headers = { apikey: key };
const redirect = "https://aitor.alienflow.space";

async function enabledProviders() {
  const res = await fetch(`${url}/auth/v1/settings`, { headers });
  if (!res.ok) throw new Error(`/auth/v1/settings respondió HTTP ${res.status}`);
  const settings = await res.json();
  return { external: settings.external ?? {}, settings };
}

/**
 * `authorize` without following redirects: 302 means the provider is ready and
 * would hand the browser to it; a 4xx body says why it cannot start.
 */
async function probe(provider) {
  const res = await fetch(
    `${url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirect)}`,
    { headers, redirect: "manual" },
  );
  if (res.status >= 300 && res.status < 400) {
    return { state: "ready", detail: `redirige a ${new URL(res.headers.get("location")).host}` };
  }
  const body = await res.json().catch(() => ({}));
  const msg = body.msg || body.message || `HTTP ${res.status}`;
  if (/missing oauth secret/i.test(msg)) {
    return { state: "sin-credenciales", detail: "interruptor encendido, faltan Client ID + Secret" };
  }
  if (/not enabled|unsupported/i.test(msg)) {
    return { state: "apagado", detail: "el proveedor no está activado" };
  }
  return { state: "error", detail: msg };
}

const ICON = {
  ready: "✅ listo",
  "sin-credenciales": "⚠️  faltan credenciales",
  apagado: "⛔ apagado",
  error: "❌ error",
};

const { external } = await enabledProviders();
const toggledOn = METHODS.filter((m) => external[m.id]);
const rows = [];

for (const method of METHODS) {
  let result;
  try {
    result = await probe(method.id);
  } catch (error) {
    result = { state: "error", detail: error.message };
  }
  rows.push({ method, result });
}

const print = (row) =>
  `${ICON[row.result.state].padEnd(20)} ${row.method.label.padEnd(11)} ${row.method.id.padEnd(18)} ${row.result.detail}`;

console.log(`\nProyecto: ${url}`);
console.log(`Proveedores encendidos en /settings: ${toggledOn.length ? toggledOn.map((m) => m.id).join(", ") : "ninguno"}`);
console.log(`Email: ${external.email ? "activado" : "apagado"} · Phone: ${external.phone ? "activado" : "apagado"}\n`);

for (const row of rows) console.log(print(row));

// Email y phone no pasan por /authorize, así que se informan aparte.
console.log(`\n${external.email ? "✅" : "⛔"} email   → ${EMAIL.panel}`);
console.log(
  `${external.phone ? "⚠️ " : "⛔"} phone   → ${external.phone ? "activado, pero sin proveedor SMS los envíos fallan" : "apagado"} · ${PHONE.panel}`,
);

const pending = rows.filter((r) => r.result.state !== "ready");
if (pending.length) {
  console.log(`\nPendientes (${pending.length}). Dónde se arreglan:\n`);
  for (const { method } of pending) console.log(`  · ${method.label}: ${method.panel}`);
  console.log(
    "\nCada proveedor necesita, además de su Client ID + Secret, esta URL de callback registrada en su consola:\n" +
      `  ${url}/auth/v1/callback\n`,
  );
  process.exit(1);
}

console.log("\nTodos los métodos responden.\n");
