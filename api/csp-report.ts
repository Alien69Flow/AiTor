/**
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Colector de informes CSP.
 *
 * `Content-Security-Policy-Report-Only` sin `report-uri`/`report-to` sólo escribe
 * en la consola del visitante. Este handler recibe los dos formatos que mandan
 * los navegadores —`csp-report` (legacy) y la lista de `reports+json` con
 * `{ type: "csp-violation", body }`— agrupa los informes de cada petición por
 * directiva y origen, y escribe una línea por grupo con su cuenta en los logs de
 * la función. No guarda nada: el histórico es la retención de Vercel.
 */
import { checkRateLimit } from "./_shared/rate-limit.js";
import type { ApiRequest, ApiResponse } from "./_shared/types.js";

/** Un cuerpo mayor que esto no es un informe; es alguien probando el endpoint. */
const MAX_BODY_BYTES = 8 * 1024;

/** Tope de informes por petición: un array enorme no debe llenar el log. */
const MAX_REPORTS = 20;

/** Un campo más largo que esto no aporta: para agregar orígenes sobra. */
const MAX_FIELD_CHARS = 512;

/** Por dónde llegó el informe: `reports+json`, `csp-report` o el objeto plano. */
export type CspVia = "reporting" | "legacy" | "plano";

export interface CspReport {
  directive: string;
  disposition: string;
  blocked: string;
  document: string;
  via: CspVia;
}

/** Un grupo de informes iguales dentro de una petición, con cuántos eran. */
interface CspGroup extends CspReport {
  count: number;
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
 * El origen del documento: esquema, host y puerto, nada más.
 *
 * `document-uri` llega con la URL que el navegador tiene abierta, y el secreto
 * puede ir en cualquier parte: en la query (`?token=…`), en el fragmento
 * (`#access_token=…`), en la propia ruta (`/auth/callback/<codigo>`, como en
 * los enlaces de recuperación) o en el **userinfo** (`https://ana:s3creto@host/`,
 * que es como algunas herramientas dejan credenciales en una URL copiada).
 * Quedarse con el origen no deja nada que recortar ni que adivinar, y por eso el
 * userinfo se descarta antes de formarlo: el origen es esquema, host y puerto,
 * no quién llamó.
 *
 * Se parsea con una expresión regular y no con `new URL`: no lanza con basura y
 * no depende del runtime. Si el valor no es una URL absoluta con autoridad no hay
 * origen que registrar y se devuelve vacío, porque media URL con un token dentro
 * es peor que un `-`.
 */
function originOnly(value: string): string {
  const match = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)/i.exec(value);
  if (!match) return "";

  const scheme = match[1];
  const authority = match[2];
  // El userinfo es lo que va antes de la última `@` de la autoridad: el host no
  // puede contener una `@`, así que quedarse con lo que va después descarta
  // usuario y contraseña de una vez, sin parsear el primero. Si no queda host
  // (`https://ana:s3creto@/`) no hay origen que registrar.
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return host ? `${scheme}${host}` : "";
}

/**
 * Lo bloqueado, en la forma en que la política puede actuar sobre ello.
 *
 * Si es una URL se queda en su origen: la política se escribe por origen
 * (`connect-src https://…supabase.co`), así que la ruta no cambia ninguna
 * decisión y la query es donde viaja la firma de una URL de Storage
 * (`…/object/sign/bucket/f.pdf?token=<jwt>`).
 *
 * Aplicar `originOnly` a todo rompería `inline` y `eval`: ninguno de los dos
 * tiene autoridad, así que saldrían como `-`, y son justo lo que dice si falta
 * `'unsafe-inline'` o `'unsafe-eval'` en la política. Por eso lo que no es una
 * URL se registra tal cual.
 */
function blockedOrigin(value: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? originOnly(value) : value;
}

/**
 * Una entrada a la forma que se registra, o null si no es una violación CSP.
 *
 * Tres envoltorios y una sola capa: `body` (Reporting API), `csp-report`
 * (legacy) o el objeto ya plano. `effective-directive` manda; `violated-directive`
 * es el respaldo de los navegadores que sólo mandan ese campo. `via` deja dicho
 * por cuál de los tres llegó, que no se deduce del resto de la línea.
 */
function toReport(item: unknown): CspReport | null {
  if (!item || typeof item !== "object") return null;

  const entry = item as Record<string, unknown>;
  // `body` sólo vale si la entrada dice ser una violación CSP: `deprecation` e
  // `intervention` llegan por el mismo `report-to` y no son esto.
  const via: CspVia =
    entry.type === "csp-violation" ? "reporting" : entry["csp-report"] ? "legacy" : "plano";
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
  const blocked = blockedOrigin(pick(violation, "blocked-uri", "blockedURL"));

  // Sin directiva ni origen bloqueado no hay nada que medir: un `document-uri`
  // solo no dice qué origen falta, así que no es un informe útil.
  if (!directive && !blocked) return null;

  return {
    directive,
    blocked,
    document: originOnly(pick(violation, "document-uri", "documentURL")),
    disposition: pick(violation, "disposition"),
    via,
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

/**
 * Los informes de una petición agrupados por directiva y origen, con su cuenta.
 *
 * Veinte avisos del mismo par (directiva, origen) son un dato, no veinte líneas:
 * el navegador repite el mismo informe mientras el recurso siga en la página, y
 * eso llenaba el log con ruido idéntico. Se agrupa sobre los campos ya saneados,
 * así que dos valores que sólo difieren en caracteres de control caen juntos, que
 * es lo correcto: son el mismo aviso.
 *
 * `document`, `disposition` y `via` son los del primer informe del grupo: la
 * cuenta es del par (directiva, origen), y las páginas se reparten entre
 * peticiones. Un lote llega por un solo canal, así que `via` no cambia dentro
 * de un grupo.
 */
export function groupReports(reports: CspReport[]): CspGroup[] {
  const groups = new Map<string, CspGroup>();

  for (const report of reports) {
    // Los campos saneados no llevan controles, así que el separador no puede
    // aparecer dentro de un valor y pegar dos claves distintas.
    const key = `${report.directive}\u0000${report.blocked}`;
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      continue;
    }
    groups.set(key, { ...report, count: 1 });
  }

  return [...groups.values()];
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

  let reports = parseReports(decodeBody(req.body));

  // Vercel no parsea `application/csp-report` ni `application/reports+json`:
  // deja `req.body` vacio y el JSON sin leer en el stream de la peticion, asi
  // que el colector se quedaria mudo justo en produccion. Se lee el crudo solo
  // cuando lo que ya llego no produce ni un informe (vacio, `{}` o un
  // envoltorio ajeno).
  if (reports.length === 0) {
    reports = parseReports(decodeBody(await readRawBody(req)));
  }

  for (const group of groupReports(reports)) {
    console.warn(
      `[csp-report] directive=${group.directive || "-"} blocked=${group.blocked || "-"} document=${group.document || "-"} disposition=${group.disposition || "-"} via=${group.via} count=${group.count}`,
    );
  }

  // 204 también sin nada que registrar: el navegador no reintenta un informe, así
  // que un error sólo añadiría ruido al log.
  res.status(204).end();
}

/**
 * Cuerpo crudo de la peticion, que es donde Vercel deja los tipos que no
 * sabe parsear. Devuelve vacio si el stream ya estaba consumido (el cuerpo
 * llego parseado) o si pasa del tope: en los dos casos no hay informe que
 * rescatar.
 */
async function readRawBody(req: unknown): Promise<string> {
  const source = req as unknown as Record<symbol, unknown>;
  if (typeof source[Symbol.asyncIterator] !== 'function') return '';

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of req as unknown as AsyncIterable<Uint8Array | string>) {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    size += bytes.length;
    if (size > MAX_BODY_BYTES) return '';
    chunks.push(bytes);
  }

  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(raw);
}
