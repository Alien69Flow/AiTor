/**
 * Lectura de `/api/health?compact=1` para la página pública `/estado`.
 *
 * La vista compacta existe para poder publicarla: trae veredicto, recuento,
 * problemas y upstreams, y **no** trae claves, detalles ni umbrales. Aquí se
 * parsea a tipos y se separa «no hay datos» de «el veredicto es malo»: si la
 * petición no llega, la página lo dice, no pinta un verde por defecto.
 */

export type HealthVerdict = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNCONFIGURED";
export type DataStatus = "OK" | "DEGRADED" | "CRITICAL" | "UNKNOWN";
export type UpstreamStatus = "OK" | "DOWN" | "UNCONFIGURED";

export interface HealthUpstream {
  key: string;
  label: string;
  status: UpstreamStatus;
}

export interface HealthProblem {
  label: string;
  status: string;
}

export interface HealthSummary {
  total: number;
  ok: number;
  stale: number;
  empty: number;
  error: number;
}

export interface HealthSnapshot {
  status: HealthVerdict;
  dataStatus: DataStatus;
  /** Hora a la que el servidor hizo la comprobación. */
  checkedAt: string;
  /** `null` cuando no hay nada que medir (sin almacén). */
  summary: HealthSummary | null;
  problems: HealthProblem[];
  upstreams: HealthUpstream[];
  /** Sólo en `UNCONFIGURED`: qué falta. Variables, nunca valores. */
  detail: string | null;
  /** Hora de esta lectura en el navegador, para calcular la antigüedad. */
  receivedAt: number;
}

export interface HealthUnavailable {
  kind: "unavailable";
  /** Frase corta para la persona que mira la página. */
  reason: string;
  /** Código del servidor (`redis_down`, `unauthorized`…), si lo mandó. */
  code: string | null;
  requestId: string | null;
  upstreams: HealthUpstream[];
}

export type HealthRead = { kind: "ok"; snapshot: HealthSnapshot } | HealthUnavailable;

export const HEALTH_ENDPOINT = "/api/health?compact=1";

const VERDICTS: readonly string[] = ["HEALTHY", "DEGRADED", "UNHEALTHY", "UNCONFIGURED"];
const DATA_STATUSES: readonly string[] = ["OK", "DEGRADED", "CRITICAL", "UNKNOWN"];
const UPSTREAM_STATUSES: readonly string[] = ["OK", "DOWN", "UNCONFIGURED"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Acepta sólo lo que la vista compacta promete; lo demás se descarta. */
export function parseUpstreams(raw: unknown): HealthUpstream[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { key, label, status } = entry;
    if (typeof key !== "string" || typeof label !== "string") return [];
    if (typeof status !== "string" || !UPSTREAM_STATUSES.includes(status)) return [];
    return [{ key, label, status: status as UpstreamStatus }];
  });
}

export function parseProblems(raw: unknown): HealthProblem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { label, status } = entry;
    if (typeof label !== "string" || typeof status !== "string") return [];
    return [{ label, status }];
  });
}

export function parseSummary(raw: unknown): HealthSummary | null {
  if (!isRecord(raw)) return null;
  const total = numberOrNull(raw.total);
  const ok = numberOrNull(raw.ok);
  const stale = numberOrNull(raw.stale);
  const empty = numberOrNull(raw.empty);
  const error = numberOrNull(raw.error);
  if (total === null || ok === null || stale === null || empty === null || error === null) return null;
  return { total, ok, stale, empty, error };
}

/**
 * Convierte el JSON (ya parseado) en una instantánea utilizable. Devuelve
 * `null` si no trae ni veredicto ni hora: preferimos el estado vacío a enseñar
 * una página con huecos.
 */
export function parseHealthSnapshot(raw: unknown, now = Date.now()): HealthSnapshot | null {
  if (!isRecord(raw)) return null;
  const { status, dataStatus, checkedAt } = raw;
  if (typeof status !== "string" || !VERDICTS.includes(status)) return null;
  if (typeof checkedAt !== "string" || Number.isNaN(Date.parse(checkedAt))) return null;

  return {
    status: status as HealthVerdict,
    dataStatus:
      typeof dataStatus === "string" && DATA_STATUSES.includes(dataStatus)
        ? (dataStatus as DataStatus)
        : "UNKNOWN",
    checkedAt,
    summary: parseSummary(raw.summary),
    problems: parseProblems(raw.problems),
    upstreams: parseUpstreams(raw.upstreams),
    detail: typeof raw.detail === "string" ? raw.detail : null,
    receivedAt: now,
  };
}

/**
 * Pide la salud compacta. Nunca lanza: cualquier fallo se devuelve como
 * `unavailable` con el motivo, que es lo que la página necesita para no mentir.
 */
export async function readHealth(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<HealthRead> {
  let response: Response;
  try {
    response = await fetchImpl(HEALTH_ENDPOINT, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      kind: "unavailable",
      reason: "La petición no llegó al servidor.",
      code: null,
      requestId: null,
      upstreams: [],
    };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const record = isRecord(body) ? body : {};
    return {
      kind: "unavailable",
      reason:
        response.status === 503
          ? "El servidor contestó que no puede leer su almacén."
          : `El servidor contestó HTTP ${response.status}.`,
      code: typeof record.code === "string" ? record.code : null,
      requestId: typeof record.requestId === "string" ? record.requestId : null,
      upstreams: parseUpstreams(record.upstreams),
    };
  }

  const snapshot = parseHealthSnapshot(body, Date.now());
  if (!snapshot) {
    return {
      kind: "unavailable",
      reason: "La respuesta no tenía el formato de la vista compacta.",
      code: null,
      requestId: null,
      upstreams: [],
    };
  }
  return { kind: "ok", snapshot };
}

/** «hace 12 s» / «hace 4 min» / «hace 2 h»; nunca una cifra negativa. */
export function formatAge(fromMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - fromMs) / 1000));
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}
