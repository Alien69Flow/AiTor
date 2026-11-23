#!/usr/bin/env node
/**
 * Comprobación de punta a punta de la firma del webhook de Telegram.
 *
 * El endpoint es "fail closed": exige la cabecera
 * `X-Telegram-Bot-Api-Secret-Token` con el `secret_token` con el que Telegram
 * registró el webhook. Si la variable no está en Vercel, si llegó mal escrita o
 * si el webhook se registró con otro valor, Telegram recibe 401 en cada entrega
 * y el bot se queda mudo sin que la interfaz lo explique.
 *
 * Este script manda tres entregas al despliegue real —sin firma, con una firma
 * ajena y con la firma correcta— y compara lo que responde cada una con lo que
 * publica el diagnóstico. No llama al modelo ni envía nada a Telegram: el
 * cuerpo es un `edited_message`, que el handler reconoce y descarta con 200.
 *
 * Uso:
 *   node scripts/telegram-signature-check.mjs
 *   node scripts/telegram-signature-check.mjs --url=https://mi-preview.vercel.app
 *
 * Variables (entorno o .env / .env.local de la raíz):
 *   TELEGRAM_WEBHOOK_SECRET   obligatoria; el MISMO valor que tiene Vercel
 *   PUBLIC_URL                opcional, por defecto https://aitor.alienflow.space
 *
 * Nunca imprime el secreto: sólo si está presente, su longitud y un hash corto
 * para poder distinguir dos valores sin revelarlos.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");

/** El mismo alfabeto que acepta el servidor (y Telegram) para `secret_token`. */
export const SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const TIMEOUT_MS = 20_000;

/**
 * Entrega que el handler reconoce y descarta con 200 sin gastar modelo: no
 * lleva `message`, así que cae en la rama de «edits, joins, stickers…».
 */
export function benignUpdate(updateId) {
  return {
    update_id: updateId,
    edited_message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 0, type: "private" },
      text: "comprobación de firma",
    },
  };
}

export function fingerprint(secret) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 8);
}

async function post(url, secret, update, fetchImpl) {
  const headers = { "Content-Type": "application/json" };
  if (secret !== null) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(update),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text().catch(() => "");
    return { status: response.status, body: text.slice(0, 200) };
  } catch (error) {
    return {
      status: 0,
      body: error instanceof Error ? error.message.slice(0, 200) : "sin respuesta",
    };
  }
}

/**
 * Veredicto a partir de las tres respuestas y del diagnóstico GET.
 *
 * `diagnostic` puede venir incompleto (despliegues sin `secretState`): en ese
 * caso se usa `secretConfigured` y, si tampoco está, se dice que no se pudo
 * averiguar en vez de adivinar.
 */
export function judge(probes, diagnostic) {
  const unsigned = probes.unsigned.status;
  const wrong = probes.wrong.status;
  const signed = probes.signed.status;

  if (unsigned === 200 || wrong === 200) {
    return {
      ok: false,
      verdict: "gate-abierto",
      message:
        "El endpoint acepta entregas sin firma (o con una ajena): cualquiera que conozca la URL puede gastar cuota. Revisa el chequeo de x-telegram-bot-api-secret-token antes de nada.",
    };
  }
  if (unsigned !== 401 || wrong !== 401) {
    return {
      ok: false,
      verdict: "sin-401",
      message: `Sin firma devolvió ${unsigned} y con firma ajena ${wrong}; se esperaba 401 en las dos. Mira el log del despliegue: un 5xx es la función caída, no la firma.`,
    };
  }
  if (signed === 200 && /^OK/i.test(probes.signed.body)) {
    return {
      ok: true,
      verdict: "ok",
      message:
        "Firma aceptada: sin firma 401, firma ajena 401 y la correcta 200. La entrega se descartó sin llamar al modelo.",
    };
  }

  const state = diagnostic?.secretState ?? null;
  const configured = diagnostic?.secretConfigured ?? null;
  if (state === "missing" || state === "empty" || state === "too-long" || state === "bad-chars") {
    return {
      ok: false,
      verdict: "sin-variable",
      message: `El despliegue no tiene un TELEGRAM_WEBHOOK_SECRET válido (secreto local: ${state === "bad-chars" ? "válido, pero el de Vercel no" : "válido"}). Defínelo en Vercel (Production) y redespliega: la variable no entra en despliegues anteriores.`,
    };
  }
  if (state === "ok" || configured === true) {
    return {
      ok: false,
      verdict: "secreto-distinto",
      message:
        "Vercel tiene un secreto válido, pero no es el de este entorno: o pones aquí el valor de Vercel, o registras el webhook con el tuyo (`node scripts/telegram-webhook.mjs --set`). Los dos lados tienen que coincidir.",
    };
  }
  return {
    ok: false,
    verdict: "correcto-rechazado",
    message: `La firma correcta devolvió ${signed} y el diagnóstico no dice el estado del secreto (¿no responde?). Revisa GET /api/telegram-webhook y el log del despliegue.`,
  };
}

export function formatReport({ url, secret, probes, diagnostic, result }) {
  const rows = [
    ["sin firma", probes.unsigned],
    ["firma ajena", probes.wrong],
    ["firma correcta", probes.signed],
  ];
  const lines = [
    "AiTor · firma del webhook",
    `URL        ${url}`,
    `Secreto    presente (${secret.length} caracteres, sha256 ${fingerprint(secret)}) — nunca se imprime`,
    `Diagnóstico ${diagnostic?.secretState ? `secretState=${diagnostic.secretState}` : diagnostic?.secretConfigured === undefined ? "sin respuesta" : `secretConfigured=${diagnostic.secretConfigured}`}`,
    "",
    "COMPROBACIÓN      ESTADO   CUERPO",
    ...rows.map(([label, probe]) => {
      const expected = label === "firma correcta" ? 200 : 401;
      const mark = probe.status === expected ? "✅" : "❌";
      return `${label.padEnd(16)} ${String(probe.status).padEnd(8)} ${mark} ${probe.body.replace(/\s+/g, " ").slice(0, 60)}`;
    }),
    "",
    `${result.ok ? "✅" : "❌"}  ${result.message}`,
  ];
  return lines.join("\n");
}

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

export async function main(argv = process.argv.slice(2), fetchImpl = globalThis.fetch) {
  loadDotEnv(".env");
  loadDotEnv(".env.local");

  const flag = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const base = (flag("url") || process.env.PUBLIC_URL || "https://aitor.alienflow.space").replace(/\/+$/, "");
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();

  if (!SECRET_PATTERN.test(secret)) {
    console.error(
      "Falta TELEGRAM_WEBHOOK_SECRET en este entorno (o no cumple A-Za-z0-9_-). " +
        "Es el MISMO valor que hay que tener en Vercel; genéralo con `openssl rand -hex 32` " +
        "y ponlo en .env.local para esta comprobación.",
    );
    return 2;
  }

  const update = benignUpdate(Date.now());
  const endpoint = `${base}/api/telegram-webhook`;
  const [unsigned, wrong, signed] = [
    await post(endpoint, null, update, fetchImpl),
    await post(endpoint, "firma-ajena", update, fetchImpl),
    await post(endpoint, secret, update, fetchImpl),
  ];

  let diagnostic = null;
  try {
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.json().catch(() => null);
    if (body && typeof body === "object") {
      diagnostic = {
        secretConfigured: body.secretConfigured,
        secretState: body.secretState ?? null,
      };
    }
  } catch {
    diagnostic = null;
  }

  const probes = { unsigned, wrong, signed };
  const result = judge(probes, diagnostic);
  console.log(formatReport({ url: endpoint, secret, probes, diagnostic, result }));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
