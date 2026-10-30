#!/usr/bin/env node
/**
 * Diagnóstico y registro del webhook de AiTor en Telegram.
 *
 * El endpoint /api/telegram-webhook es "fail closed": solo acepta actualizaciones
 * firmadas con el mismo `secret_token` con el que se registró el webhook. Si el
 * secret no está en Vercel o el webhook no se registró con él, el bot contesta
 * 401 a Telegram y se queda mudo. Este script comprueba el estado real según
 * Telegram y (con --set) lo registra correctamente.
 *
 * Uso:
 *   node scripts/telegram-webhook.mjs            # estado (getWebhookInfo)
 *   node scripts/telegram-webhook.mjs --set      # registrar webhook + secret
 *   node scripts/telegram-webhook.mjs --delete   # quitar webhook (polling)
 *
 * Variables (por entorno o en .env / .env.local de la raíz del proyecto):
 *   TELEGRAM_BOT_TOKEN        (obligatoria)
 *   TELEGRAM_WEBHOOK_SECRET   (obligatoria para --set)
 *   PUBLIC_URL                (opcional, por defecto https://aitor.alienflow.space)
 *
 * Nunca imprime tokens ni secretos: solo longitudes y confirmaciones.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    let value = m[2];
    if (/^"(.*)"$/.test(value) || /^'(.*)'$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadDotEnv('.env');
loadDotEnv('.env.local');

const args = new Set(process.argv.slice(2));
const mode = args.has('--set') ? 'set' : args.has('--delete') ? 'delete' : 'status';

if (args.has('--help') || args.has('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*/, ''));
  process.exit(0);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://aitor.alienflow.space').replace(/\/+$/, '');

/** Enmascara cualquier aparición de un valor sensible dentro de un texto. */
const mask = (text) => {
  let out = String(text ?? '');
  for (const secret of [TOKEN, SECRET]) {
    if (secret && secret.length > 6) out = out.split(secret).join('***');
  }
  return out;
};

async function telegram(method, payload) {
  if (!TOKEN) {
    console.error('✖ Falta TELEGRAM_BOT_TOKEN (entorno o .env / .env.local).');
    process.exit(2);
  }
  const url = `https://api.telegram.org/bot${TOKEN}/${method}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`✖ Sin respuesta de api.telegram.org: ${mask(err?.message || err)}`);
    process.exit(2);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta no JSON */
  }
  if (!data || data.ok !== true) {
    console.error(`✖ Telegram ${method} falló (HTTP ${res.status}): ${mask(data?.description || 'sin detalle')}`);
    process.exit(1);
  }
  return data.result;
}

function printInfo(info) {
  console.log('── Estado del webhook (según Telegram) ─────────────────');
  console.log(`URL registrada : ${info.url || '(ninguna — el bot no recibe nada)'}`);
  console.log(`Actualizaciones pendientes : ${info.pending_update_count ?? 0}`);
  if (info.last_error_date) {
    const when = new Date(info.last_error_date * 1000).toISOString();
    console.log(`Último error   : ${when}`);
    console.log(`Detalle        : ${mask(info.last_error_message)}`);
  } else {
    console.log('Último error   : ninguno registrado');
  }
  if (info.last_synchronization_error_date) {
    console.log(
      `Último fallo de sincronización : ${new Date(info.last_synchronization_error_date * 1000).toISOString()}`,
    );
  }
  console.log('───────────────────────────────────────────────────────');
}

async function main() {
  if (mode === 'delete') {
    await telegram('deleteWebhook', { drop_pending_updates: false });
    console.log('✔ Webhook eliminado. El bot queda sin recepción (modo polling).');
    return;
  }

  if (mode === 'set') {
    if (!SECRET) {
      console.error(
        '✖ Falta TELEGRAM_WEBHOOK_SECRET. Genéralo y guárdalo también como secreto de Vercel:\n' +
          '    node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"\n' +
          '    vercel env add TELEGRAM_WEBHOOK_SECRET production',
      );
      process.exit(2);
    }
    const expected = `${PUBLIC_URL}/api/telegram-webhook`;
    const info = await telegram('setWebhook', {
      url: expected,
      secret_token: SECRET,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    });
    console.log(`✔ Webhook registrado en ${expected}`);
    console.log('  (secret_token configurado; el mismo valor debe existir en Vercel)');
    const after = await telegram('getWebhookInfo', {});
    printInfo(after);
    if (info.url !== expected) {
      console.error('✖ La URL registrada no coincide con la esperada.');
      process.exit(1);
    }

    // El registro en Telegram y la variable en Vercel son dos mitades del mismo
    // secreto. Se comprueba el endpoint desde fuera, sin token del bot: una
    // petición con la firma correcta y otra sin firma. Con la firma, un 401
    // significa que Vercel tiene OTRO valor y el bot está mudo desde ya; sin
    // firma, un 200 significa que el endpoint sigue abierto (la variable aún no
    // ha llegado a Vercel o falta el redeploy).
    const probe = async (headers) => {
      try {
        const res = await fetch(expected, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: '{}',
        });
        return res.status;
      } catch {
        return null;
      }
    };
    const signed = await probe({ 'x-telegram-bot-api-secret-token': SECRET });
    const unsigned = await probe({});

    if (signed === 401) {
      console.error(
        '✖ El endpoint rechaza la firma que acabas de registrar: en Vercel hay un\n' +
          '  TELEGRAM_WEBHOOK_SECRET distinto (o ninguno de los dos coincide). Mientras\n' +
          '  siga así Telegram recibirá 401 y el bot quedará mudo. Copia el valor de\n' +
          '  TELEGRAM_WEBHOOK_SECRET de tu .env a las variables de Vercel (Production)\n' +
          '  y vuelve a desplegar; o re-registra con el valor que ya tenga Vercel.',
      );
      process.exit(1);
    }
    if (unsigned === 401) {
      console.log('✔ Endpoint cerrado: rechaza las peticiones sin firma (401).');
    } else if (unsigned === 200) {
      console.log(
        '→ El endpoint sigue aceptando peticiones sin firma (200). El registro en\n' +
          '  Telegram ya lleva el secreto, así que sólo falta la otra mitad: añade\n' +
          '  TELEGRAM_WEBHOOK_SECRET a las variables de Vercel (Production) con el mismo\n' +
          '  valor y despliega. Orden seguro: Telegram primero (el bot sigue\n' +
          '  respondiendo), Vercel después (cierra el endpoint sin cortar el servicio).',
      );
    } else {
      console.log(`→ No pude comprobar el endpoint (respuesta ${unsigned ?? 'sin red'}).`);
    }
    return;
  }

  const info = await telegram('getWebhookInfo', {});
  printInfo(info);

  const expected = `${PUBLIC_URL}/api/telegram-webhook`;
  if (!info.url) {
    console.log('→ Acción: registra el webhook con  node scripts/telegram-webhook.mjs --set');
    process.exit(1);
  }
  if (info.url !== expected) {
    console.log(`→ Aviso: la URL registrada no es ${expected}. Corregir con --set.`);
    process.exit(1);
  }
  if (info.last_error_message && /401|unauthorized/i.test(info.last_error_message)) {
    console.log(
      '→ Causa: el endpoint devuelve 401. O TELEGRAM_WEBHOOK_SECRET no está en Vercel, ' +
        'o el webhook no se registró con ese secret_token. Re-registra con --set y ' +
        'verifica el secreto en Vercel (producción).',
    );
    process.exit(1);
  }
  if (info.pending_update_count > 0 && info.last_error_message) {
    console.log('→ Hay actualizaciones acumuladas con errores: revisa el detalle de arriba.');
    process.exit(1);
  }
  console.log('✔ Webhook apunta donde debe. Si sigue sin responder, revisa los logs de Vercel de /api/telegram-webhook.');
}

main();
