/**
 * Reverifica las cámaras de `src/lib/live-signals.ts` y deja el resultado en
 * `src/lib/live-status.generated.ts`, que la app lee para marcar las que han
 * dejado de emitir.
 *
 *   npm run verify:live            # comprueba y reescribe el módulo
 *   npm run verify:live -- --dry-run   # comprueba y muestra, sin tocar archivos
 *
 * Se ejecuta semanalmente desde `.github/workflows/verify-live.yml`. Una cámara
 * estacional (osos, pingüinos, otoño) deja de emitir sin que nadie toque la
 * lista; esto lo detecta y lo publica, en vez de que el reproductor lo descubra
 * usuario a usuario.
 *
 * Salvaguarda: si más del 60 % de las sondas quedan «unknown», se considera un
 * fallo de red de la máquina que ejecuta el script y **no se escribe nada**. Es
 * preferible un estado viejo a marcar sesenta cámaras como apagadas porque el
 * runner no tenía salida a YouTube.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIVE_SIGNALS } from "../src/lib/live-signals";
import {
  LIVE,
  OFFLINE,
  UNKNOWN,
  classifyProbe,
  looksLikeNetworkFailure,
  probeSignal,
  renderStatusModule,
  type ProbeResult,
} from "./live-probe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, "../src/lib/live-status.generated.ts");
const OUT_LABEL = "src/lib/live-status.generated.ts";

// Ciento cuarenta cámaras son muchas páginas de YouTube seguidas: con menos
// paralelismo y una pausa por sonda se evita el 429 que dejaba media lista «sin
// poder comprobar».
const CONCURRENCY = 2;
const DELAY_MS = 350;
const dryRun = process.argv.includes("--dry-run");

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const MARK = { [LIVE]: "●", [OFFLINE]: "○", [UNKNOWN]: "?" } as const;

async function main() {
  const queue = [...LIVE_SIGNALS];
  const results: ProbeResult[] = [];

  console.log(`Verificando ${queue.length} cámaras (${CONCURRENCY} a la vez)…\n`);

  const worker = async () => {
    for (;;) {
      const signal = queue.shift();
      if (!signal) return;
      const result = await probeSignal(signal);
      const state = classifyProbe(result);
      results.push(result);
      const detail =
        state === UNKNOWN
          ? ` (oembed ${result.http.oembed ?? "error"}, watch ${result.http.watch ?? "error"})`
          : "";
      console.log(`${MARK[state]} ${state.padEnd(7)} ${signal.id.padEnd(34)} ${signal.label}${detail}`);
      await sleep(DELAY_MS);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  // Mismo orden que la lista original, para que el diff sea legible.
  const order = new Map(LIVE_SIGNALS.map((signal, index) => [signal.id, index]));
  results.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const counts = { live: 0, offline: 0, unknown: 0 };
  for (const result of results) {
    const state = classifyProbe(result);
    if (state === LIVE) counts.live += 1;
    else if (state === OFFLINE) counts.offline += 1;
    else counts.unknown += 1;
  }

  console.log(
    `\n${counts.live} emitiendo · ${counts.offline} sin emisión · ${counts.unknown} sin poder comprobar`,
  );

  if (looksLikeNetworkFailure(results)) {
    console.error(
      "\nMás del 60 % de las sondas no se pudieron completar: parece un fallo de red de esta máquina.\n" +
        `No se ha modificado ${OUT_LABEL}.`,
    );
    process.exitCode = 2;
    return;
  }

  const newlyOffline = results.filter(
    (result) => classifyProbe(result) === OFFLINE && LIVE_SIGNALS.find((signal) => signal.id === result.id)?.liveAtBuild,
  );
  if (newlyOffline.length > 0) {
    console.log("\nDejaron de emitir desde la última curación de la lista:");
    for (const result of newlyOffline) {
      const signal = LIVE_SIGNALS.find((entry) => entry.id === result.id);
      console.log(`  - ${result.id} · ${signal?.label ?? ""} (${signal?.source ?? ""})`);
    }
  }

  const now = new Date();
  const checkedOn = now.toISOString().slice(0, 10);
  const content = renderStatusModule(checkedOn, now.toISOString(), results);

  let previous = "";
  try {
    previous = readFileSync(OUT_PATH, "utf8");
  } catch {
    previous = "";
  }

  if (dryRun) {
    console.log(`\n--dry-run: no se escribe ${OUT_LABEL}.`);
    return;
  }

  if (content === previous) {
    console.log(`\nSin cambios: ${OUT_LABEL} sigue al día.`);
    return;
  }

  writeFileSync(OUT_PATH, content, "utf8");
  console.log(`\nEscrito ${OUT_LABEL} (verificado el ${checkedOn}).`);
}

await main();
