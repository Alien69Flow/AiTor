/**
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Colector de informes CSP.
 *
 * `Content-Security-Policy-Report-Only` no envía nada a ningún sitio por sí
 * sola: sin `report-uri`/`report-to` los avisos sólo aparecen en la consola del
 * navegador de cada visitante, así que no se puede medir qué orígenes usa el
 * sitio de verdad. Este handler es ese destino.
 *
 * Dos formatos, a propósito:
 *
 *  · `application/csp-report` (legacy, `report-uri`): un objeto
 *    `{ "csp-report": { … } }` con claves en kebab-case.
 *  · `application/reports+json` (Reporting API, `report-to`): una lista de
 *    `{ type: "csp-violation", body: { … } }` con claves en camelCase.
 *
 * No guarda nada en base de datos: escribe una línea por informe en los logs de
 * la función, que es donde se puede agregar (`vercel logs | grep csp-report`).
 * Sin infraestructura nueva y sin PII más allá de las URLs que el navegador ya
 * manda.
 */
import { checkRateLimit } from "./_shared/rate-limit.js";
import type { ApiRequest, ApiResponse } from "./_shared/types.js";

/** Un cuerpo mayor que esto no es un informe; es alguien probando el endpoint. */
const MAX_BODY_BYTES = 8 * 1024;

/** Tope de líneas por petición: un array enorme no debe llenar el log. */
const MAX_REPORTS_PER_REQUEST = 20;

export interface CspReport {
  directive: string;
  disposition: string;
  blocked: string;
  document: string;
}

function pick(source: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/**
 * Normaliza cualquiera de los dos formatos a una lista plana.
 *
 * Exportada para poder probarla sin levantar la función: la forma del cuerpo la
 * decide el navegador, no nosotros.
 */
export function parseReports(payload: unknown): CspReport[] {
  if (Array.isArray(payload)) return payload.flatMap((entry) => parseReports(entry));
  if (!payload || typeof payload !== "object") return [];

  const entry = payload as Record<string, unknown>;
  // Reporting API: { type: "csp-violation", body: { … } }
  if (entry.type === "csp-violation" && entry.body) return parseReports(entry.body);

  // Legacy envuelve el informe; el moderno a veces ya viene plano.
  const inner = entry["csp-report"] ?? entry;
  if (!inner || typeof inner !== "object") return [];

  const violation = inner as Record<string, unknown>;
  const directive = pick(
    violation,
    "effective-directive",
    "effectiveDirective",
    "violated-directive",
    "violatedDirective",
  );
  const blocked = pick(violation, "blocked-uri", "blockedURL");
  const document = pick(violation, "document-uri", "documentURL");

  // Si no queda ni un campo reconocible, no es un informe: no se registra.
  if (!directive && !blocked && !document) return [];

  return [{ directive, disposition: pick(violation, "disposition"), blocked, document }];
}

/** Cuerpo crudo (string o bytes) a JSON. Lanza si no es JSON; el caller decide. */
function decodeBody(body: unknown): unknown {
  if (body && typeof body === "object" && !(body instanceof Uint8Array)) return body;
  const raw =
    typeof body === "string"
      ? body
      : body instanceof Uint8Array
        ? new TextDecoder().decode(body)
        : "";
  if (!raw || raw.length > MAX_BODY_BYTES) return null;
  return JSON.parse(raw);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  // El endpoint es público: acepta un POST de cualquiera. El límite evita que
  // un script lo use para escribir el log que queremos leer.
  const allowed = await checkRateLimit(req, res, {
    name: "csp-report",
    limit: 120,
    windowSec: 60,
  });
  if (!allowed) return;

  let payload: unknown = null;
  try {
    payload = decodeBody(req.body);
  } catch {
    payload = null;
  }

  const reports = parseReports(payload).slice(0, MAX_REPORTS_PER_REQUEST);
  for (const report of reports) {
    // Una línea por informe, con lo mínimo para poder agregar orígenes:
    // la directiva que saltó y el host que no estaba contemplado.
    console.warn(
      `[csp-report] directive=${report.directive || "-"} blocked=${report.blocked || "-"} document=${report.document || "-"} disposition=${report.disposition || "-"}`,
    );
  }

  // 204 también cuando no hay nada que registrar: el navegador no reintenta un
  // informe, así que un error sólo añadiría ruido al log.
  res.status(204).end();
}
