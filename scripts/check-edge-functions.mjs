#!/usr/bin/env node
/**
 * Probes every Edge Function this repository deploys and prints what actually
 * answers — not what the code intends.
 *
 * Why: "the function is deployed" and "the function works" are different
 * claims, and only the second one matters. Each probe uses the request the real
 * client sends (the same method, query and body the hooks use), so a wrong
 * contract or a missing secret shows up here instead of in the browser.
 *
 * Three outcomes are distinguished on purpose:
 *
 *   ✅ responde     200 with the shape the UI destructures
 *   🔒 protegida    401/403 because the function's own auth (session token,
 *                   shared secret, origin allowlist) rejected an anonymous
 *                   call — that is the function working, not failing
 *   ❌ falla        5xx, 404 (never deployed), or a 200 whose body cannot be
 *                   used by the client
 *
 * Usage:
 *   npm run edge:check            # probe every function
 *   npm run edge:check -- --strict  # also fail on warnings (mock/empty data)
 *
 * URL and publishable key come from the environment first (VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY, also from .env.local), then from the defaults
 * committed in src/integrations/supabase/client.ts. The publishable key is
 * public by design — it ships in the browser bundle — so this leaks nothing.
 *
 * This script never deploys. Deploying needs an access token that only the
 * owner has: `supabase login` (or SUPABASE_ACCESS_TOKEN) and then
 * `npm run edge:deploy`.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

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

  if (!url || !key) {
    console.error("No encuentro la URL y la clave publishable del proyecto.");
    process.exit(2);
  }
  return { url: url.replace(/\/$/, ""), key };
}

const { url, key } = projectConfig();
const ORIGIN = "https://aitor.alienflow.space";
const json = (body) => ({ "Content-Type": "application/json", body: JSON.stringify(body) });

/**
 * `expect` is the status a healthy function returns for this request.
 * `shape` receives the parsed body and returns a short description of what it
 * found, or throws/returns null when the body is unusable.
 */
const PROBES = [
  {
    name: "air-traffic",
    method: "GET",
    query: "lamin=40&lamax=42&lomin=-4&lomax=-2",
    origin: true,
    shape: (b) => `${b.count ?? 0} vuelos`,
    mock: (b) => b.mock === true,
  },
  {
    name: "marine-traffic",
    method: "GET",
    origin: true,
    shape: (b) => `${b.count ?? 0} barcos`,
    mock: (b) => b.mock === true,
  },
  {
    name: "cesium-tiles",
    method: "GET",
    origin: true,
    expect: [200, 302, 307],
    shape: () => "proxy de assets 3D",
  },
  {
    name: "chat",
    label: "chat?health=1",
    method: "GET",
    query: "health=1",
    // The report is the only place that says which provider keys exist. A
    // report with status "down" is a real failure: the chat cannot answer.
    shape: (b) => {
      if (!Array.isArray(b.providers) || !Array.isArray(b.models)) throw new Error("sin informe");
      const withKey = b.providers.filter((provider) => provider.configured).length;
      if (b.status === "down") throw new Error("ningún proveedor con clave");
      return `${withKey}/${b.providers.length} claves · ${b.status}`;
    },
  },
  {
    name: "chat",
    label: "chat (POST)",
    method: "POST",
    ...json({ messages: [{ role: "user", content: "ping" }], model: "google/gemini-2.5-flash" }),
    timeout: 60_000,
    shape: (_, text) => (text.includes("data:") ? "stream SSE" : "respuesta JSON"),
  },
  {
    name: "crypto-feed",
    method: "POST",
    ...json({ action: "movers" }),
    shape: (b) => `${b.coins?.length ?? 0} monedas`,
  },
  {
    name: "crypto-price",
    method: "POST",
    ...json({ coinIds: ["bitcoin", "ethereum"] }),
    shape: (b) => `${Object.keys(b.prices ?? {}).length} precios`,
  },
  {
    name: "crypto-signals",
    method: "POST",
    ...json({ action: "all" }),
    shape: (b) => `${(b.polymarket?.length ?? 0) + (b.trending?.length ?? 0)} señales`,
  },
  {
    name: "firecrawl-osint",
    method: "GET",
    origin: true,
    timeout: 45_000,
    shape: (b) => `${b.count ?? 0} noticias`,
  },
  {
    name: "firecrawl-search",
    method: "POST",
    origin: true,
    ...json({ query: "uap disclosure" }),
    timeout: 45_000,
    shape: (b) => `${b.data?.length ?? 0} resultados`,
  },
  {
    name: "github-proxy",
    method: "POST",
    ...json({ action: "repo", owner: "Alien69Flow", repo: "AiTor" }),
    expect: [401],
    protectedBy: "sesión de usuario",
  },
  {
    name: "globe-feeds",
    method: "GET",
    query: "feed=outages",
    origin: true,
    shape: (b) => `${b.outages?.length ?? 0} países`,
  },
  {
    name: "noaa-space-weather",
    method: "GET",
    shape: (b) => `Kp ${b.kpIndex ?? "?"}`,
  },
  {
    name: "openweather",
    method: "GET",
    query: "points=40.4,-3.7",
    origin: true,
    shape: (b) => `${Array.isArray(b) ? b.length : 0} puntos`,
  },
  {
    name: "osint-aggregator",
    method: "POST",
    origin: true,
    ...json({ limit: 2 }),
    timeout: 60_000,
    shape: (b) => `${b.count ?? 0} eventos`,
  },
  {
    name: "ufo-feed",
    method: "GET",
    expect: [401],
    protectedBy: "UFO_FEED_SECRET (llamada de cron)",
  },
  {
    name: "verify-crypto-payment",
    method: "POST",
    ...json({}),
    expect: [401],
    protectedBy: "sesión de usuario",
  },
  {
    name: "verify-dao-holdings",
    method: "POST",
    ...json({}),
    expect: [401],
    protectedBy: "sesión + firma",
  },
  {
    name: "wallet-auth",
    method: "POST",
    ...json({}),
    expect: [400],
    shape: (b) => b.error ?? "valida la entrada",
  },
  {
    name: "weather-grid",
    method: "POST",
    origin: true,
    ...json({ lat: 40.4, lon: -3.7 }),
    shape: (b) => `${b.grid?.length ?? 0} celdas`,
  },
  {
    name: "web3-recipient",
    method: "POST",
    origin: true,
    ...json({}),
    timeout: 45_000,
    shape: (b) => `${b.domain} → ${String(b.address ?? "").slice(0, 10)}…`,
  },
];

const ICON = { ok: "✅", protected: "🔒", warn: "⚠️ ", fail: "❌" };

async function probe(spec) {
  const endpoint = `${url}/functions/v1/${spec.name}${spec.query ? `?${spec.query}` : ""}`;
  const headers = { apikey: key };
  if (spec.origin) headers.Origin = ORIGIN;
  if (spec["Content-Type"]) headers["Content-Type"] = spec["Content-Type"];
  if (spec.protectedBy?.includes("sesión")) headers.Authorization = `Bearer ${key}`;

  const expect = spec.expect ?? [200];
  let response;
  try {
    response = await fetch(endpoint, {
      method: spec.method,
      headers,
      body: spec.body,
      redirect: "manual",
      signal: AbortSignal.timeout(spec.timeout ?? 25_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: "fail", detail: /timeout|abort/i.test(reason) ? "sin respuesta (timeout)" : reason.slice(0, 70) };
  }

  const text = await response.text();

  if (response.status === 404) return { state: "fail", status: 404, detail: "no desplegada" };
  if (response.status === 429) return { state: "warn", status: 429, detail: "rate limit del guard; reintenta en 1 min" };

  if (spec.protectedBy && expect.includes(response.status)) {
    if (response.status === 401 || response.status === 403) {
      return { state: "protected", status: response.status, detail: spec.protectedBy };
    }
  }

  if (!expect.includes(response.status)) {
    const message = (() => {
      try {
        const body = JSON.parse(text);
        return body.error ?? body.message ?? body.msg ?? text.slice(0, 70);
      } catch {
        return text.slice(0, 70);
      }
    })();
    return { state: "fail", status: response.status, detail: `HTTP ${response.status} · ${String(message).slice(0, 70)}` };
  }

  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Streaming responses (chat) are not JSON; `shape` gets the raw text.
  }

  if (body && body.success === false) {
    return { state: "fail", status: response.status, detail: `HTTP 200 con success:false · ${String(body.error ?? "").slice(0, 60)}` };
  }

  let detail;
  try {
    detail = spec.shape ? spec.shape(body ?? {}, text) : "responde";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    return {
      state: "fail",
      status: response.status,
      detail: reason
        ? `HTTP ${response.status} · ${reason.slice(0, 70)}`
        : "HTTP 200 con un cuerpo que el cliente no puede leer",
    };
  }

  if (spec.mock?.(body ?? {})) {
    return { state: "warn", status: response.status, detail: `${detail} · SIMULADOS (upstream caído o sin clave)` };
  }
  return { state: "ok", status: response.status, detail };
}

/** Functions on disk vs functions declared in supabase/config.toml. */
function configDrift() {
  const functionsDir = resolve(root, "supabase/functions");
  const onDisk = readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  const declared = new Map();
  for (const match of config.matchAll(/\[functions\.([a-z0-9-]+)\]\s*\n(?:.*\n)*?verify_jwt\s*=\s*(true|false)/g)) {
    declared.set(match[1], match[2] === "true");
  }

  const undeclared = onDisk.filter((name) => !declared.has(name));
  const orphaned = [...declared.keys()].filter((name) => !onDisk.includes(name));
  return { onDisk, undeclared, orphaned };
}

console.log(`\nProyecto: ${url}`);
console.log(`Probando ${PROBES.length} Edge Functions con la clave publishable y Origin: ${ORIGIN}\n`);

const results = [];
for (const spec of PROBES) {
  const result = await probe(spec);
  results.push({ spec, result });
  const status = result.status ? String(result.status).padEnd(3) : "—  ";
  console.log(`${ICON[result.state]} ${(spec.label ?? spec.name).padEnd(22)} ${status} ${result.detail}`);
}

const count = (state) => results.filter((r) => r.result.state === state).length;
const ok = count("ok");
const protectedCount = count("protected");
const warn = count("warn");
const fail = count("fail");

const { onDisk, undeclared, orphaned } = configDrift();

console.log(`\nResumen: ${ok} responden · ${protectedCount} protegidas correctamente · ${warn} avisos · ${fail} fallos`);
console.log(`Funciones en supabase/functions: ${onDisk.length} · declaradas en config.toml: ${onDisk.length - undeclared.length}`);

if (undeclared.length) {
  console.log(
    "\n❌ Sin declarar en supabase/config.toml: " +
      undeclared.join(", ") +
      "\n   Un `supabase functions deploy` les aplicaría verify_jwt = true y rompería las que validan la sesión por su cuenta.",
  );
}
if (orphaned.length) {
  console.log(`\n⚠️  Declaradas pero sin carpeta: ${orphaned.join(", ")}`);
}

if (warn) {
  console.log(
    "\n⚠️  Avisos: las funciones marcadas devuelven datos simulados o se saltaron la prueba. " +
      "Revisa las claves de su upstream (OpenSky, VesselFinder) antes de presentar sus datos como reales.",
  );
}

if (fail || undeclared.length || (strict && warn)) process.exit(1);
console.log("\nTodas las funciones desplegadas responden como se espera.\n");
