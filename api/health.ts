/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * `GET /api/health` — frescura de datos, no solo "el servidor responde".
 *
 * El /health del backend devuelve un texto fijo: dice que el proceso vive, no
 * que los datos estén al día. Este endpoint responde la otra pregunta, que es
 * la que rompe dashboards: ¿qué fuente dejó de publicar, y desde cuándo?
 *
 * Contrato:
 *  - Cuatro estados por dataset: OK, STALE (publicó, pero hace demasiado),
 *    EMPTY (no hay marca de frescura), ERROR (Redis no se pudo leer).
 *    "Empty" y "error" NUNCA se colapsan en uno.
 *  - El veredicto va en el JSON (`status`), no en el código HTTP: un monitor
 *    HTTP no debe parpadear porque un seeder va 10 minutos tarde. Solo un
 *    Redis inalcanzable devuelve 503.
 *  - `?compact=1` es público (uptime monitors). El detalle con claves y
 *    umbrales exige `x-api-key: OPERATOR_KEY`.
 *  - `upstreams` dice si Telegram y la función `chat` están vivos. Va SIEMPRE,
 *    también sin Redis: es la información que hace falta para depurar el bot.
 *  - Nunca se cachea.
 */

import { sendError, sendJson } from "./_shared/http.js";
import { isRedisConfigured, readSeedMetas } from "./_shared/redis.js";
import { applyCors } from "./_shared/cors.js";
import type { ApiRequest, ApiResponse } from "./_shared/types.js";

export const maxDuration = 15;

type Criticality = "critical" | "standard";

interface Dataset {
  /** Clave del dato; la marca se lee de `seed-meta:<key>`. */
  key: string;
  label: string;
  /** Minutos tras los cuales el dato se considera viejo. */
  maxStaleMin: number;
  criticality: Criticality;
}

/**
 * Registro de datasets. Añade uno por cada publicador real: si no está aquí,
 * su caída es invisible. Una clave listada que nadie escribe aparecerá como
 * EMPTY para siempre y dará una falsa alarma.
 */
export const DATASETS: Dataset[] = [
  { key: "osint:gdelt:v1", label: "Conflictos (GDELT GKG)", maxStaleMin: 30, criticality: "critical" },
  { key: "aviation:traffic:v1", label: "Tráfico aéreo", maxStaleMin: 15, criticality: "standard" },
  { key: "maritime:traffic:v1", label: "Tráfico marítimo", maxStaleMin: 30, criticality: "standard" },
  { key: "market:crypto:v1", label: "Cripto", maxStaleMin: 10, criticality: "standard" },
  { key: "prediction:markets:v1", label: "Mercados de predicción", maxStaleMin: 30, criticality: "standard" },
  { key: "orbital:satellites:v1", label: "Satélites (TLE)", maxStaleMin: 720, criticality: "standard" },
  { key: "seismic:events:v1", label: "Terremotos", maxStaleMin: 60, criticality: "standard" },
  { key: "weather:grid:v1", label: "Meteo", maxStaleMin: 120, criticality: "standard" },
];

type CheckStatus = "OK" | "STALE" | "EMPTY" | "ERROR";

interface Check {
  key: string;
  label: string;
  status: CheckStatus;
  ageMin: number | null;
  maxStaleMin: number;
  recordCount: number | null;
  criticality: Criticality;
}

function classify(dataset: Dataset, meta: { fetchedAt?: string; recordCount?: number } | null): Check {
  const base = {
    key: dataset.key,
    label: dataset.label,
    maxStaleMin: dataset.maxStaleMin,
    criticality: dataset.criticality,
  };
  if (!meta) return { ...base, status: "EMPTY", ageMin: null, recordCount: null };
  const fetchedAt = meta.fetchedAt ? Date.parse(meta.fetchedAt) : Number.NaN;
  if (!Number.isFinite(fetchedAt)) return { ...base, status: "EMPTY", ageMin: null, recordCount: null };
  const ageMin = Math.round((Date.now() - fetchedAt) / 60_000);
  return {
    ...base,
    status: ageMin > dataset.maxStaleMin ? "STALE" : "OK",
    ageMin,
    recordCount: typeof meta.recordCount === "number" ? meta.recordCount : null,
  };
}

export function verdictOf(checks: Check[]) {
  const summary = {
    total: checks.length,
    ok: checks.filter((c) => c.status === "OK").length,
    stale: checks.filter((c) => c.status === "STALE").length,
    empty: checks.filter((c) => c.status === "EMPTY").length,
    error: checks.filter((c) => c.status === "ERROR").length,
  };
  const broken = checks.filter((c) => c.status === "EMPTY" || c.status === "ERROR");
  const criticalBroken = broken.filter((c) => c.criticality === "critical");

  const status = criticalBroken.length > 0 ? "UNHEALTHY" : broken.length > 0 ? "DEGRADED" : "HEALTHY";
  const dataStatus = broken.length > 0 ? "CRITICAL" : summary.stale > 0 ? "DEGRADED" : "OK";

  return { status, dataStatus, summary, problems: broken, stale: checks.filter((c) => c.status === "STALE") };
}

// ---------------------------------------------------------------------------
// Upstreams: ¿está vivo lo que no está en Redis?
// ---------------------------------------------------------------------------

/**
 * `UNCONFIGURED` es información, no un fallo: dice qué variable falta. Es
 * distinto de `DOWN`, que significa "está configurado y no responde".
 */
export type UpstreamStatus = "OK" | "DOWN" | "UNCONFIGURED";

export interface Upstream {
  key: "telegram" | "chat";
  label: string;
  status: UpstreamStatus;
  ms: number | null;
  /** Nunca contiene credenciales: sólo usuario, código HTTP o variable que falta. */
  detail: string | null;
}

/** Corto a propósito: health se consulta a menudo y no puede colgarse. */
export const UPSTREAM_TIMEOUT_MS = 2_500;

function env(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * `getMe` sin el token en la respuesta. El token va en la URL que se pide a
 * Telegram, así que el `detail` se construye a mano y nunca lo incluye.
 */
export async function probeTelegram(): Promise<Upstream> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) {
    return { key: "telegram", label: "Bot de Telegram", status: "UNCONFIGURED", ms: null, detail: "falta TELEGRAM_BOT_TOKEN" };
  }
  const started = Date.now();
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: { username?: string }; description?: string }
      | null;
    const ms = Date.now() - started;
    if (!response.ok || !body?.ok) {
      return {
        key: "telegram",
        label: "Bot de Telegram",
        status: "DOWN",
        ms,
        detail: `HTTP ${response.status}${body?.description ? `: ${body.description.slice(0, 80)}` : ""}`,
      };
    }
    return {
      key: "telegram",
      label: "Bot de Telegram",
      status: "OK",
      ms,
      detail: body?.result?.username ? `@${body.result.username}` : "token válido",
    };
  } catch (error) {
    return {
      key: "telegram",
      label: "Bot de Telegram",
      status: "DOWN",
      ms: Date.now() - started,
      detail: error instanceof Error && /timeout|abort/i.test(error.message) ? "sin respuesta a tiempo" : "sin conexión",
    };
  }
}

/**
 * Pregunta a la función `chat` de Supabase por su propio informe. Si contesta
 * con el informe, el camino del bot (webhook → chat → proveedor) está a medias
 * resuelto: al menos la función vive y sabe qué claves tiene.
 */
export async function probeChat(): Promise<Upstream> {
  const base = env("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/+$/, "");
  const key = env("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
  const missing = [base ? null : "SUPABASE_URL", key ? null : "SUPABASE_ANON_KEY"].filter(
    (name): name is string => Boolean(name),
  );
  if (missing.length > 0) {
    return { key: "chat", label: "Chat (Supabase)", status: "UNCONFIGURED", ms: null, detail: `falta ${missing.join(" y ")}` };
  }
  const started = Date.now();
  try {
    const response = await fetch(`${base}/functions/v1/chat?health=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const ms = Date.now() - started;
    if (!response.ok) {
      return { key: "chat", label: "Chat (Supabase)", status: "DOWN", ms, detail: `HTTP ${response.status}` };
    }
    const body = (await response.json().catch(() => null)) as
      | { status?: string; models?: { available?: boolean }[] }
      | null;
    if (!body || typeof body.status !== "string") {
      // La función desplegada puede ser anterior a `?health=1`: responde, pero
      // no con un informe. Se dice tal cual en vez de inventar un estado.
      return { key: "chat", label: "Chat (Supabase)", status: "OK", ms, detail: "responde, sin informe de salud (redesplegar chat)" };
    }
    const ready = Array.isArray(body.models) ? body.models.filter((model) => model.available).length : null;
    return {
      key: "chat",
      label: "Chat (Supabase)",
      status: "OK",
      ms,
      detail: ready === null ? body.status : `${body.status}: ${ready} modelos con clave`,
    };
  } catch (error) {
    return {
      key: "chat",
      label: "Chat (Supabase)",
      status: "DOWN",
      ms: Date.now() - started,
      detail: error instanceof Error && /timeout|abort/i.test(error.message) ? "sin respuesta a tiempo" : "sin conexión",
    };
  }
}

/** Las dos sondas en paralelo; ninguna lanza. */
export async function probeUpstreams(): Promise<Upstream[]> {
  return Promise.all([probeTelegram(), probeChat()]);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res, { publicRead: true })) return;

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/health", `https://${host}`);
  const compact = url.searchParams.get("compact") === "1";
  const checkedAt = new Date().toISOString();

  // Siempre, con o sin Redis: es lo que dice por qué el bot no contesta.
  const upstreams = await probeUpstreams();
  const upstreamView = compact
    ? upstreams.map(({ key, label, status }) => ({ key, label, status }))
    : upstreams;

  if (!isRedisConfigured()) {
    sendJson(req, res, 200, {
      status: "UNCONFIGURED",
      dataStatus: "UNKNOWN",
      checkedAt,
      detail: "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_*) no están definidas",
      upstreams: upstreamView,
    });
    return;
  }

  const operatorKey = process.env.OPERATOR_KEY || "";
  const provided = String(req.headers["x-api-key"] || "");
  if (!compact && (!operatorKey || provided !== operatorKey)) {
    sendError(res, 401, { error: "operator key required for detailed health", code: "unauthorized" });
    return;
  }

  let metas: Awaited<ReturnType<typeof readSeedMetas>>;
  try {
    metas = await readSeedMetas(DATASETS.map((dataset) => dataset.key));
  } catch (error) {
    console.error("[health] redis unreachable", error);
    sendError(
      res,
      503,
      { error: "redis unreachable", code: "redis_down", requestId: checkedAt, upstreams: upstreamView },
      { "Retry-After": "5" },
    );
    return;
  }

  const checks = DATASETS.map((dataset) => classify(dataset, metas.get(dataset.key) ?? null));
  const verdict = verdictOf(checks);

  if (compact) {
    // Público: solo lo accionable, sin claves internas ni umbrales.
    sendJson(req, res, 200, {
      status: verdict.status,
      dataStatus: verdict.dataStatus,
      checkedAt,
      summary: verdict.summary,
      problems: verdict.problems.map((check) => ({ label: check.label, status: check.status })),
      upstreams: upstreamView,
    });
    return;
  }

  sendJson(req, res, 200, {
    status: verdict.status,
    dataStatus: verdict.dataStatus,
    checkedAt,
    summary: verdict.summary,
    checks,
    problems: verdict.problems,
    stale: verdict.stale,
    upstreams: upstreamView,
  });
}
