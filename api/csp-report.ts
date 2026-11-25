/**
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Colector de informes CSP.
 *
 * `Content-Security-Policy-Report-Only` sin `report-uri`/`report-to` sólo
 * escribe en la consola del visitante: no se puede medir nada con tráfico real.
 * Este handler es ese destino, y no guarda estado: una línea por informe en los
 * logs de la función (`vercel logs | grep csp-report`).
 *
 * Dos formatos, y los dos con una sola capa de envoltorio:
 *
 *  · `application/csp-report` (legacy, `report-uri`): `{ "csp-report": { … } }`,
 *    claves en kebab-case.
 *  · `application/reports+json` (Reporting API, `report-to`): lista de
 *    `{ type: "csp-violation", body: { … } }`, claves en camelCase.
 */
import { checkRateLimit } from "./_shared/rate-limit.js";
import type { ApiRequest, ApiResponse } from "./_shared/types.js";

/** Un cuerpo mayor que esto no es un informe; es alguien probando el endpoint. */
const MAX_BODY_BYTES = 8 * 1024;

/** Tope de informes por petición: un array enorme no debe llenar el log. */
const MAX_REPORTS = 20;

/** Un campo más largo que esto no aporta: para agregar orígenes sobra. */
const MAX_FIELD_CHARS = 512;

export interface CspReport {
  directive: string;
  disposition: string;
  blocked: string;
  document: string;
}

/**
 * Un campo en una sola línea y con tope.
 *
 * El cuerpo lo manda cualquiera y estos valores acaban en `console.warn`: un
 * salto de línea dentro de `document-uri` fabricaría líneas de log falsas, y
 * una URL de megabytes llenaría el log con un solo informe.
 */
function oneLine(value: string): string {
  let out = "";
  for (const char of value) {
    if (out.length >= MAX_FIELD_CHARS) break;
    const code = char.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : char;
  }
  return out.trim();
}

/** Primer valor de texto no vacío de `names`, ya saneado. */
function pick(source: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" && value) return oneLine(value);
  }
  return "";
}

/**
 * El objeto que lleva los campos del informe, ya desenvuelto.
 *
 * Los navegadores mandan tres formas y ninguna anida más de una capa: el `body`
 * de la Reporting API, el `csp-report` del formato legacy, o el objeto plano.
 */
function violationOf(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object") return null;

  const entry = item as Record<string, unknown>;
  // `body` sólo cuenta si la entrada dice ser una violación CSP: `deprecation` e
  // `intervention` también llegan por `report-to` y no son esto.
  const inner = entry.type === "csp-violation" ? entry.body : (entry["csp-report"] ?? entry);
  return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : null;
}

/**
 * Una violación a la forma que se registra, o null si no tiene ni un campo
 * reconocible.
 *
 * `effective-directive` es el nombre de la directiva (`script-src-elem`);
 * `violated-directive` es el respaldo de los navegadores viejos y trae la
 * directiva entera, así que sólo se usa si no hay `effective`.
 */
function toReport(violation: Record<string, unknown>): CspReport | null {
  const directive = pick(
    violation,
    "effective-directive",
    "effectiveDirective",
    "violated-directive",
    "violatedDirective",
  );
  const blocked = pick(violation, "blocked-uri", "blockedURL");
  const document = pick(violation, "document-uri", "documentURL");

  if (!directive && !blocked && !document) return null;

  return { directive, disposition: pick(violation, "disposition"), blocked, document };
}

/**
 * De cuerpo a lista plana, en una pasada y con tope.
 *
 * Exportada para poder probarla sin levantar la función: la forma del cuerpo la
 * decide el navegador, no nosotros.
 */
export function parseReports(payload: unknown): CspReport[] {
  const items = Array.isArray(payload) ? payload : [payload];
  const reports: CspReport[] = [];

  for (const item of items) {
    if (reports.length >= MAX_REPORTS) break;
    const violation = violationOf(item);
    if (!violation) continue;
    const report = toReport(violation);
    if (report) reports.push(report);
  }

  return reports;
}

/** JSON del cuerpo, o null si no es JSON o pasa de `MAX_BODY_BYTES`. */
function decodeBody(body: unknown): unknown {
  // Vercel ya entrega parseado lo que llega como JSON. Ahí no se puede medir el
  // cuerpo sin volver a serializarlo, así que el daño lo acotan `MAX_REPORTS` y
  // `MAX_FIELD_CHARS` (el tamaño de la petición lo limita la plataforma).
  if (body && typeof body === "object" && !(body instanceof Uint8Array)) return body;

  const raw =
    typeof body === "string"
      ? body
      : body instanceof Uint8Array
        ? new TextDecoder().decode(body)
        : "";
  if (!raw || new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  // El endpoint es público: acepta un POST de cualquiera. El límite evita que un
  // script lo use para escribir el log que queremos leer.
  const allowed = await checkRateLimit(req, res, { name: "csp-report", limit: 120, windowSec: 60 });
  if (!allowed) return;

  for (const report of parseReports(decodeBody(req.body))) {
    // Una línea por informe, con lo mínimo para poder agregar orígenes: la
    // directiva que saltó y el host que no estaba contemplado.
    console.warn(
      `[csp-report] directive=${report.directive || "-"} blocked=${report.blocked || "-"} document=${report.document || "-"} disposition=${report.disposition || "-"}`,
    );
  }

  // 204 también cuando no hay nada que registrar: el navegador no reintenta un
  // informe, así que un error sólo añadiría ruido al log.
  res.status(204).end();
}
