#!/usr/bin/env node
/**
 * Agregador de los informes CSP del colector (#168, seguimiento 1).
 *
 * El colector escribe una línea por informe en los Runtime Logs, y ese log rota
 * con el plan. Esta herramienta lee esas líneas y las reduce a
 * `public.csp_reports_daily`: cuántas veces aparece cada par (directiva, origen
 * bloqueado, origen del documento) en cada día. Lo que se quiere responder con
 * ella es qué origen de la política no aparece nunca y puede salir antes de
 * pasar de `Report-Only` a bloqueo.
 *
 * El contrato de la línea lo fija `api/csp-report.ts`:
 *
 *   [csp-report] directive=connect-src blocked=https://api.coingecko.com/api document=https://aitor.alienflow.space disposition=report count=3
 *
 * `count` son los informes iguales que venían en la misma petición y `-` es un
 * campo vacío. El documento ya llega recortado a origen; el bloqueado no, así
 * que aquí se recorta también, que es lo que permite agregar por origen.
 *
 * Uso:
 *   node scripts/csp-agregador.mjs --entrada volcado.jsonl   # o - para stdin
 *   node scripts/csp-agregador.mjs --ventana 24h             # pide los logs a Vercel
 *   ... y --dry-run para imprimir el agregado sin escribir en Supabase
 *
 * Variables:
 *   SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY, para escribir
 *   VERCEL_TOKEN, VERCEL_PROJECT y VERCEL_SCOPE, para --ventana
 *
 * Códigos de salida: 0 hecho · 1 fallo · 2 sin verificar (falta el origen de los
 * datos o con qué escribir; también es rojo, porque un agregador que no puede
 * agregar no está bien).
 *
 * Ojo con las ventanas: cada línea se suma a lo que ya hay. Reagregar una
 * ventana ya agregada cuenta doble, así que quien llama debe usar ventanas que
 * no se solapen — o asumir que el número es una tendencia, no una contabilidad.
 */

import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);

const URL_SUPABASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const CLAVE_SUPABASE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const TOKEN_VERCEL = (process.env.VERCEL_TOKEN || "").trim();
const PROYECTO = (process.env.VERCEL_PROJECT || "ai-tor").trim();
const EQUIPO = (process.env.VERCEL_SCOPE || "alien-flow-space").trim();
const CLI = (process.env.VERCEL_CLI || "vercel@64").trim();

/** Tope de campo que aplica el colector (`MAX_FIELD_CHARS`): más largo no es un origen. */
const MAX_CARACTERES = 512;

/** El RPC rechaza lotes mayores; se trocea aquí para no enterarse por un error de Postgres. */
const LOTE = 500;

/**
 * La línea, anclada a la forma que escribe el colector: cinco campos en orden
 * fijo y el recuento al final. `blocked` y `document` admiten espacios (el
 * colector sólo quita controles), así que el patrón no puede exigir `\S`.
 */
const PATRON_INFORME =
  /^\[csp-report\]\s+directive=(.*?)\s+blocked=(.*?)\s+document=(.*?)\s+disposition=(.*?)\s+count=(\d+)\s*$/;

/**
 * Una línea del log a informe, o null si no es un informe.
 *
 * Se busca el prefijo en vez de exigirlo al principio porque el mensaje puede
 * venir envuelto por el CLI; de ahí en adelante manda el patrón.
 */
export function parseInforme(linea) {
  const texto = String(linea ?? "").trim();
  const inicio = texto.indexOf("[csp-report]");
  if (inicio === -1) return null;

  const encontrado = PATRON_INFORME.exec(texto.slice(inicio));
  if (!encontrado) return null;

  const [, directiva, blocked, document, disposition, count] = encontrado;
  return {
    directiva: directiva.slice(0, MAX_CARACTERES),
    blocked,
    document,
    disposition: disposition.slice(0, MAX_CARACTERES),
    count: Math.max(1, Number.parseInt(count, 10) || 1),
  };
}

/**
 * El origen de un valor del log. Un `http(s)`/`ws(s)` se queda en su origen; lo
 * que no es una URL (`inline`, `eval`, `data:`, `-`) se guarda tal cual, porque
 * perderlo sería perder justo la parte que hay que arreglar.
 */
export function origen(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "-";

  try {
    const url = new URL(texto);
    if (["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return url.origin;
    return texto.slice(0, MAX_CARACTERES);
  } catch {
    // No es una URL: se guarda el valor entero, con el tope de la columna.
    return texto.slice(0, MAX_CARACTERES);
  }
}

/**
 * Las filas agregadas: una por (día, directiva, origen bloqueado, origen del
 * documento), con el recuento sumado y la ventana ensanchada.
 *
 * Un informe sin fecha válida se descarta: sin fecha no hay día, y un día
 * inventado es peor que un informe perdido — el que llama puede contarlos.
 */
export function agregar(entradas) {
  const filas = new Map();

  for (const entrada of entradas) {
    if (!entrada || typeof entrada.directiva !== "string" || !entrada.directiva) continue;
    const cuando =
      entrada.cuando instanceof Date && !Number.isNaN(entrada.cuando.getTime())
        ? entrada.cuando
        : null;
    if (!cuando) continue;

    const dia = cuando.toISOString().slice(0, 10);
    const blocked = origen(entrada.blocked);
    const document = origen(entrada.document);
    const clave = [dia, entrada.directiva, blocked, document].join("\u0000");
    const fila = filas.get(clave);

    if (fila) {
      fila.count += entrada.count;
      if (cuando < fila.first_seen) fila.first_seen = cuando;
      if (cuando > fila.last_seen) fila.last_seen = cuando;
      continue;
    }

    filas.set(clave, {
      dia,
      directiva: entrada.directiva,
      blocked_origen: blocked,
      document_origen: document,
      count: entrada.count,
      first_seen: cuando,
      last_seen: cuando,
    });
  }

  return [...filas.values()].map((fila) => ({
    ...fila,
    first_seen: fila.first_seen.toISOString(),
    last_seen: fila.last_seen.toISOString(),
  }));
}

/**
 * `vercel logs --json` imprime JSON por línea, y el mensaje cae en `message`,
 * en `text` o en el objeto entero según la versión. La fecha, si viene, es
 * `timestamp` en milisegundos.
 */
export function lineasDeLog(salida) {
  const lineas = [];

  for (const cruda of String(salida).split("\n")) {
    const texto = cruda.trim();
    if (!texto) continue;

    try {
      const entrada = JSON.parse(texto);
      const mensaje =
        typeof entrada?.message === "string"
          ? entrada.message
          : typeof entrada?.text === "string"
            ? entrada.text
            : JSON.stringify(entrada);
      lineas.push({ mensaje, cuando: fechaDe(entrada) });
    } catch {
      lineas.push({ mensaje: texto, cuando: null });
    }
  }

  return lineas;
}

function fechaDe(entrada) {
  for (const valor of [entrada?.timestamp, entrada?.date, entrada?.createdAt]) {
    if (typeof valor === "number" && Number.isFinite(valor)) return new Date(valor);
    if (typeof valor === "string") {
      const fecha = new Date(valor);
      if (!Number.isNaN(fecha.getTime())) return fecha;
    }
  }
  return null;
}

/**
 * De líneas de log a entradas para `agregar`.
 *
 * Una línea sin fecha se cuenta al momento de la pasada y se devuelve cuántas
 * eran: si el CLI cambiara y dejara de mandar `timestamp`, el agregado seguiría
 * saliendo, y quien lea el recuento del log sabe que ese día es aproximado.
 */
export function informesDeLineas(lineas, ahora = new Date()) {
  const entradas = [];
  let sinFecha = 0;

  for (const linea of lineas) {
    const informe = parseInforme(linea?.mensaje);
    if (!informe) continue;

    let cuando = linea.cuando instanceof Date ? linea.cuando : null;
    if (!cuando || Number.isNaN(cuando.getTime())) {
      cuando = ahora;
      sinFecha += 1;
    }

    entradas.push({ ...informe, cuando });
  }

  return { entradas, sinFecha };
}

/** Lotes del tamaño que acepta el RPC. */
export function trocear(filas, tamano = LOTE) {
  const lotes = [];
  for (let i = 0; i < filas.length; i += tamano) lotes.push(filas.slice(i, i + tamano));
  return lotes;
}

const USO =
  "uso: node scripts/csp-agregador.mjs --entrada <fichero|-> | --ventana <1h|24h> [--dry-run]";

const esperar = null;

async function leerEntrada(ruta) {
  if (ruta !== "-") return readFile(ruta, "utf8");

  const trozos = [];
  for await (const trozo of process.stdin) trozos.push(trozo);
  return Buffer.concat(trozos).toString("utf8");
}

async function leerVentana(ventana) {
  if (!TOKEN_VERCEL) return { status: "skip", detail: "falta VERCEL_TOKEN: no se pueden leer los Runtime Logs" };

  try {
    const { stdout } = await ejecutar(
      "npx",
      [
        "--yes",
        CLI,
        "logs",
        "--json",
        "--since",
        ventana,
        "--query",
        "csp-report",
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
    return { status: "skip", detail: `vercel logs falló: ${detalle.slice(0, 300)}` };
  }
}

async function enviarFilas(filas) {
  let enviadas = 0;

  for (const lote of trocear(filas)) {
    const respuesta = await fetch(`${URL_SUPABASE}/rest/v1/rpc/record_csp_reports`, {
      method: "POST",
      headers: {
        apikey: CLAVE_SUPABASE,
        Authorization: `Bearer ${CLAVE_SUPABASE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_filas: lote }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 300).replace(/\s+/g, " ");
      throw new Error(`record_csp_reports respondió ${respuesta.status}: ${detalle}`);
    }

    // La RPC devuelve cuántas filas aceptó; se ignora el número y se cuenta lo
    // que se mandó, que es lo que se puede volver a mandar sin perderse.
    await respuesta.json().catch(() => null);
    enviadas += lote.length;
  }

  return enviadas;
}

function imprimirTabla(filas) {
  const ordenadas = [...filas].sort((a, b) => b.count - a.count);
  const visibles = ordenadas.slice(0, 20);

  console.log(`[csp-agregado] ${filas.length} filas (día · directiva · bloqueado → documento · count)`);
  for (const fila of visibles) {
    console.log(
      `  ${fila.dia}  ${fila.directiva}  ${fila.blocked_origen} → ${fila.document_origen}  ×${fila.count}`,
    );
  }
  if (ordenadas.length > visibles.length) {
    console.log(`  … y ${ordenadas.length - visibles.length} más`);
  }
}

async function main() {
  const valorDe = (nombre) => {
    const indice = process.argv.indexOf(nombre);
    return indice === -1 ? null : (process.argv[indice + 1] ?? null);
  };

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(USO);
    return;
  }

  const entrada = valorDe("--entrada");
  const ventana = valorDe("--ventana");
  const seco = process.argv.includes("--dry-run");

  if (Boolean(entrada) === Boolean(ventana)) {
    console.error(`${USO}\n(el origen es obligatorio y sólo uno: --entrada o --ventana)`);
    process.exitCode = 2;
    return;
  }

  let lineas;
  if (entrada) {
    lineas = lineasDeLog(await leerEntrada(entrada));
  } else {
    const logs = await leerVentana(ventana);
    if (logs.status !== "ok") {
      console.log(`[csp-agregado] SIN VERIFICAR · ${logs.detail}`);
      process.exitCode = 2;
      return;
    }
    lineas = logs.lineas;
  }

  const { entradas, sinFecha } = informesDeLineas(lineas);
  const filas = agregar(entradas);

  console.log(`[csp-agregado] ${entradas.length} informes en ${lineas.length} líneas`);
  if (sinFecha > 0) {
    console.log(`[csp-agregado] ${sinFecha} informes sin fecha: se cuentan al día de hoy`);
  }

  if (filas.length === 0) {
    console.log("[csp-agregado] OK · ninguna línea [csp-report]: no hay nada que escribir");
    return;
  }

  imprimirTabla(filas);

  if (seco) {
    console.log("[csp-agregado] OK · --dry-run: no se ha escrito en Supabase");
    return;
  }

  if (!URL_SUPABASE || !CLAVE_SUPABASE) {
    console.log("[csp-agregado] SIN VERIFICAR · faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
    console.error("  (usa --dry-run si sólo querías ver el agregado)");
    process.exitCode = 2;
    return;
  }

  try {
    const enviadas = await enviarFilas(filas);
    console.log(`[csp-agregado] OK · ${enviadas} filas escritas en csp_reports_daily`);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    console.log(`[csp-agregado] FALLO · ${motivo}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith("csp-agregador.mjs")) {
  main().catch((error) => {
    console.error(`[csp-agregado] SIN VERIFICAR · ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
