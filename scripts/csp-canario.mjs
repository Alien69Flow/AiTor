#!/usr/bin/env node
/**
 * Canario del circuito de informes CSP (#168).
 *
 * Por qué existe: la política del sitio viaja en modo informe y el histórico es
 * la retención de Runtime Logs. Sin nada que lo sondee, «no hay violaciones» y
 * «el colector no escribe» se leen igual, porque las dos dejan el log vacío.
 * Este script manda un informe sintético con una marca única y exige las dos
 * piezas del circuito: 204 del endpoint y su propia línea `[csp-report]` en el
 * log. La segunda pasada, la diaria, cuenta informes de navegador en 24 h.
 *
 * Uso:
 *   node scripts/csp-canario.mjs --canario     # cada hora
 *   node scripts/csp-canario.mjs --cero-24h    # una vez al día
 *
 * Variables:
 *   CSP_CANARIO_URL  base a sondear (por defecto https://aitor.alienflow.space)
 *   VERCEL_TOKEN     token de sólo lectura para `vercel logs`
 *   VERCEL_PROJECT   proyecto de Vercel (por defecto ai-tor)
 *   VERCEL_SCOPE     equipo de Vercel (por defecto alien-flow-space)
 *
 * Códigos de salida: 0 verde · 1 fallo · 2 sin verificar (falta el token o la
 * consulta de logs no se pudo hacer). El 2 también deja el workflow en rojo: un
 * canario que no puede mirar no está verde.
 */

import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);

const BASE = (process.env.CSP_CANARIO_URL || "https://aitor.alienflow.space").replace(/\/+$/, "");
const TOKEN = (process.env.VERCEL_TOKEN || "").trim();
const PROYECTO = (process.env.VERCEL_PROJECT || "ai-tor").trim();
const EQUIPO = (process.env.VERCEL_SCOPE || "alien-flow-space").trim();
const CLI = (process.env.VERCEL_CLI || "vercel@64").trim();

/** Host de las marcas del canario: es lo que distingue su línea de un informe real. */
export const HOST_CANARIO = "canario.invalid";

const ok = (detail) => ({ status: "ok", detail });
const fail = (detail) => ({ status: "fail", detail });
const skip = (detail) => ({ status: "skip", detail });

/**
 * El informe sintético, en el formato de la Reporting API: es el que el
 * colector normaliza a `directive` / `blocked` / `document` / `disposition`.
 * La marca va en `blocked`, que es lo que acaba en la línea del log.
 */
export function informeCanario(marca) {
  return [
    {
      type: "csp-violation",
      body: {
        effectiveDirective: "connect-src",
        blockedURL: `https://${HOST_CANARIO}/${marca}`,
        documentURL: `${BASE}/canario`,
        disposition: "report",
      },
    },
  ];
}

/**
 * Qué dice el código de estado del endpoint. Un 404 aquí no es un fallo de red:
 * es que no hay colector, y conviene decirlo con esas palabras porque es
 * exactamente el estado del circuito con el colector retirado.
 */
export function veredictoSonda(status) {
  if (status === 204) return ok("204: el colector acepta el informe");
  if (status === 404) {
    return fail("404: no hay colector en /api/csp-report; el circuito de #168 no está desplegado");
  }
  if (status === 429) {
    return fail("429: el cubo del colector recorta; un canario cada hora no debería agotarlo");
  }
  return fail(`HTTP ${status}: se esperaba 204`);
}

/**
 * `vercel logs --json` imprime JSON por línea, y el mensaje cae en `message`,
 * en `text` o en el objeto entero según la versión y el tipo de entrada. Se
 * aceptan las tres formas y el texto plano, que el CLI también escribe.
 */
export function lineasDeLog(salida) {
  const lineas = [];
  for (const cruda of String(salida).split("\n")) {
    const texto = cruda.trim();
    if (!texto) continue;
    try {
      const entrada = JSON.parse(texto);
      if (typeof entrada?.message === "string") lineas.push(entrada.message);
      else if (typeof entrada?.text === "string") lineas.push(entrada.text);
      else lineas.push(JSON.stringify(entrada));
    } catch {
      lineas.push(texto);
    }
  }
  return lineas;
}

/** La línea del canario: la que escribe el colector y la que lleva la marca de esta pasada. */
export function buscarCanario(lineas, marca) {
  return lineas.find((linea) => linea.includes("[csp-report]") && linea.includes(marca)) || null;
}

/**
 * Informes que no son del canario. Su línea horaria no puede contar: si contara,
 * «cero informes en 24 h» no saltaría nunca y la alerta sería decorativa.
 */
export function contarInformes(lineas) {
  return lineas.filter((linea) => linea.includes("[csp-report]") && !linea.includes(HOST_CANARIO)).length;
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Los Runtime Logs del proyecto. El token va por entorno (`VERCEL_TOKEN`), que
 * es lo que lee el CLI: no se pasa por argumento para que no acabe en la lista
 * de procesos ni en un mensaje de error.
 */
async function leerLogs({ since, query }) {
  if (!TOKEN) return skip("falta VERCEL_TOKEN: sin token no se pueden leer los Runtime Logs");
  try {
    const { stdout } = await ejecutar(
      "npx",
      [
        "--yes",
        CLI,
        "logs",
        "--json",
        "--since",
        since,
        "--query",
        query,
        "--project",
        PROYECTO,
        "--scope",
        EQUIPO,
      ],
      { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
    );
    return { status: "ok", lineas: lineasDeLog(stdout) };
  } catch (error) {
    const detalle = String(error?.stderr || error?.message || error)
      .trim()
      .split("\n")
      .slice(-3)
      .join(" · ");
    return skip(`vercel logs falló: ${detalle.slice(0, 300)}`);
  }
}

/** Una pasada del canario: enviar, comprobar el 204 y encontrar su línea. */
async function sonda() {
  const marca = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  let status;
  try {
    const respuesta = await fetch(`${BASE}/api/csp-report`, {
      method: "POST",
      headers: { "content-type": "application/reports+json" },
      body: JSON.stringify(informeCanario(marca)),
      signal: AbortSignal.timeout(20_000),
    });
    status = respuesta.status;
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    return fail(`no se pudo enviar el informe a ${BASE}/api/csp-report: ${motivo}`);
  }

  const veredicto = veredictoSonda(status);
  if (veredicto.status !== "ok") return veredicto;

  // La línea no está en el log en el mismo instante en que el handler contesta:
  // el índice de Vercel tarda segundos. Se sondea seis veces (un minuto).
  for (let intento = 1; intento <= 6; intento += 1) {
    const logs = await leerLogs({ since: "15m", query: marca });
    if (logs.status !== "ok") return logs;
    const linea = buscarCanario(logs.lineas, marca);
    if (linea) return ok(`204 y su línea en el log: ${linea.slice(0, 200)}`);
    if (intento < 6) await esperar(10_000);
  }
  return fail(`204 pero ninguna línea [csp-report] con ${marca} en 15 minutos de log`);
}

/**
 * La alerta diaria. Cero informes de navegador en 24 h significa que el circuito
 * no está midiendo, no que el sitio esté limpio; por eso es un fallo y no un
 * aviso.
 *
 * Ojo con el plan de Vercel: cuánto se puede mirar hacia atrás depende de él. Si
 * `vercel logs` no acepta 24 h, el script sale 2 (sin verificar) en vez de
 * inventarse un cero.
 */
async function cero() {
  const logs = await leerLogs({ since: "24h", query: "csp-report" });
  if (logs.status !== "ok") return logs;
  const informes = contarInformes(logs.lineas);
  if (informes === 0) {
    return fail("cero informes en 24 h: nadie reporta (¿la cabecera dejó de enviarse o el colector no escribe?)");
  }
  return ok(`${informes} líneas [csp-report] de navegadores en 24 h`);
}

const USO = "uso: node scripts/csp-canario.mjs --canario | --cero-24h";

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(USO);
    return;
  }
  if (args.has("--canario") === args.has("--cero-24h")) {
    console.error(`${USO}\n(el modo es obligatorio y sólo uno)`);
    process.exitCode = 2;
    return;
  }

  const resultado = args.has("--canario") ? await sonda() : await cero();
  const etiqueta = { ok: "OK", fail: "FALLO", skip: "SIN VERIFICAR" }[resultado.status];
  console.log(`[csp-canario] ${etiqueta} · ${resultado.detail}`);
  process.exitCode = resultado.status === "ok" ? 0 : resultado.status === "fail" ? 1 : 2;
}

if (process.argv[1] && process.argv[1].endsWith("csp-canario.mjs")) {
  main().catch((error) => {
    console.error(`[csp-canario] SIN VERIFICAR · ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
