#!/usr/bin/env node
/**
 * Aplica al webhook de Telegram los cambios de `/alerta` (movimiento, sismos y
 * GDELT) partiendo de la versión de `main`.
 *
 * Existe porque el fichero son 965 líneas y no siempre hay forma de subirlo
 * entero; el script reconstruye el resultado desde `main` con cuatro cambios
 * anclados y **verifica el SHA del blob** antes de tocar el repositorio. Si el
 * hash no es el esperado, no commitea nada: así no se puede publicar una
 * variante a medias.
 *
 * Uso: `node scripts/apply-alertas-webhook.mjs` (con `DRY=1` sólo comprueba).
 */
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const TARGET = "api/telegram-webhook.ts";
/** El blob que tiene que salir. Cualquier otro significa que el ancla cambió. */
const EXPECTED = "9d4c89f25b92fb2a6d59fd98effb84f5c0d1184e";

const DRY = process.env.DRY === "1";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

function blobSha(buffer) {
  return createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}

const EDITS = [
  [
    'import { addAlert, MAX_ALERTS_PER_CHAT, parseAlertCommand, SYMBOL_IDS } from "./_shared/alerts.js";',
    [
      "import {",
      "  addAlert,",
      "  buildAlert,",
      "  formatCreated,",
      "  MAX_ALERTS_PER_CHAT,",
      "  parseAlertCommand,",
      "  SYMBOL_IDS,",
      '} from "./_shared/alerts.js";',
    ].join("\n"),
  ],
  [
    "\\n/help - Esta lista",
    "\\n/alerta BTC +5% - Aviso si se mueve ese porcentaje en 24 h"
      + "\\n/alerta sismos 5.5 - Aviso si hay un sismo de esa magnitud o más"
      + "\\n/alerta gdelt ARMEDCONFLICT - Aviso si aparece un evento nuevo del tema"
      + "\\n/help - Esta lista",
  ],
  [
    "\\nSímbolos: ${symbols}.",
    "\\nMovimiento: <code>/alerta BTC +5%</code> (o <code>-5%</code>)."
      + "\\nSismos: <code>/alerta sismos 5.5</code>."
      + "\\nNoticias: <code>/alerta gdelt ARMEDCONFLICT</code>."
      + "\\nSímbolos: ${symbols}.",
  ],
  [
    [
      "        const result = await addAlert(thread.externalId, {",
      "          chatId,",
      "          symbol: parsed.symbol,",
      "          direction: parsed.direction,",
      "          price: parsed.price,",
      "          createdAt: new Date().toISOString(),",
      "        });",
    ].join("\n"),
    ["        const alert = buildAlert(parsed, chatId);", "        const result = await addAlert(thread.externalId, alert);"].join(
      "\n",
    ),
  ],
  [
    [
      '          const arrow = parsed.direction === "above" ? "≥" : "≤";',
      "          await sendTelegramMessage(",
      "            chatId,",
      '            `✅ Aviso creado: ${parsed.symbol} ${arrow} $${parsed.price.toLocaleString("es-ES")}. Te escribo cuando lo cruce.`,',
      "          );",
    ].join("\n"),
    "          await sendTelegramMessage(chatId, formatCreated(alert));",
  ],
];

function apply(source) {
  let text = source;
  for (const [from, to] of EDITS) {
    const at = text.indexOf(from);
    if (at === -1) throw new Error(`ancla no encontrada: ${JSON.stringify(from.slice(0, 60))}`);
    if (text.indexOf(from, at + 1) !== -1) throw new Error(`ancla repetida: ${JSON.stringify(from.slice(0, 60))}`);
    text = text.slice(0, at) + to + text.slice(at + from.length);
  }
  return text;
}

// Se parte siempre de `main`: así el script es idempotente aunque la rama ya
// tenga una versión aplicada (o, como pasó, una a medias).
git("checkout", "origin/main", "--", TARGET);
const before = await readFile(TARGET, "utf8");
const after = apply(before);
const buffer = Buffer.from(after, "utf8");
const sha = blobSha(buffer);
console.log(`${TARGET}: ${sha}`);

if (sha !== EXPECTED) {
  console.error(`el blob no es el esperado (${EXPECTED}); no se toca la rama`);
  process.exit(1);
}

if (DRY) {
  console.log("DRY=1: comprobado y sin publicar");
  process.exit(0);
}

await writeFile(TARGET, after, "utf8");
git("add", TARGET);
git("commit", "-m", "feat(alertas): /alerta acepta movimiento, sismos y GDELT");
git("push", "origin", "HEAD:refs/heads/feat/alertas-datos");
