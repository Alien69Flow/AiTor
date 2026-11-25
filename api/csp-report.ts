/**
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Colector de informes CSP.
 *
 * `Content-Security-Policy-Report-Only` sin `report-uri`/`report-to` sólo escribe
 * en la consola del visitante. Este handler recibe los dos formatos que mandan
 * los navegadores —`csp-report` (legacy) y la lista de `reports+json` con
 * `{ type: "csp-violation", body }`— y escribe una línea por informe en los logs
 * de la función. No guarda nada: el histórico es la retención de Vercel.
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
 * Primer valor de texto de `names`, en una sola línea y con tope.
 *
 * El cuerpo lo manda cualquiera y estos valores acaban en `console.warn`: un
 * salto de línea dentro de `document-uri` fabricaría líneas de log falsas, y una
 * URL de megabytes llenaría el log con un solo informe.
 */
function pick(source: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = source[name];
    if (typeof value !== "string" || !value) continue;

    let out = "";
    for (const char of value) {
      if (out.length >= MAX_FIELD_CHARS) break;
      const code = char.codePointAt(0) ?? 0;
      out += code < 0x20 || code === 0x7f ? " " : char;
    }
    return out.trim();
  }
  return "";
}

/**
 * Una entrada a la forma que se registra, o null si no es una violación CSP.
 *
 * Tres envoltorios y una sola capa: `body` (Reporting API), `csp-report`
 * (legacy) o el objeto ya plano. `effective-directive` manda; `violated-directive`
 * es el respaldo de los navegadores que sólo mandan ese campo.
 */
function toReport(item: unknown): CspReport | null {
  if (!item || typeof item !== "object") return null;

  const entry = item as Record<string, unknown>;
  // `body` sólo vale si la entrada dice ser una violación CSP: `deprecation` e
  // `intervention` llegan por el mismo `report-to` y no son esto.
  const inner = entry.type === "csp-violation" ? entry.body : (entry["csp-report"] ?? entry);
  if (!inner || typeof inner !== "object") return null;

  const violation = inner as Record<string, unknown>;
  const directive = pick(
    violation,
    "effective-directive",
    "effectiveDirective",
    "violated-directive",
    "violatedDirective",
  );
  const blocked = pick(violation, "blocked-uri", "blockedURL");

  // Sin directiva ni origen bloqueado no hay nada que medir: un `document-uri`
  // solo no dice qué origen falta, así que no es un informe útil.
  if (!directive && !blocked) return null;

  return {
    directive,
    blocked,
    document: pick(violation, "document-uri", "documentURL"),
    disposition: pick(violation, "disposition"),
  };
}

/** De cuerpo a lista plana, en una pasada y con tope. */
export function parseReports(payload: unknown): CspReport[] {
  const items = Array.isArray(payload) ? payload : [payload];
  const reports: CspReport[] = [];

  for (const item of items) {
    if (reports.length >= MAX_REPORTS) break;
    const report = toReport(item);
    if (report) reports.push(report);
  }

  return reports;
}

/** JSON del cuerpo, o null si no es JSON o pasa de `MAX_BODY_BYTES`. */
function decodeBody(body: unknown): unknown {
  // Vercel ya entrega parseado lo que llega como JSON. Ahí el tamaño no se puede
  // medir sin reserializar; lo que acota el daño es `MAX_REPORTS` x `MAX_FIELD_CHARS`.
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
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  // Es público: acepta un POST de cualquiera. El límite evita que un script use
  // el endpoint para escribir el log que queremos leer.
  if (!(await checkRateLimit(req, res, { name: "csp-report", limit: 120, windowSec: 60 }))) return;

  for (const report of parseReports(decodeBody(req.body))) {
    console.warn(
      `[csp-report] directive=${report.directive || "-"} blocked=${report.blocked || "-"} document=${report.document || "-"} disposition=${report.disposition || "-"}`,
    );
  }

  // 204 también sin nada que registrar: el navegador no reintenta un informe, así
  // que un error sólo añadiría ruido al log.
  res.status(204).end();
}
