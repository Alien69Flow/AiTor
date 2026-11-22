/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * Caché y frescura sobre Upstash Redis (REST), sin SDK.
 *
 * Variables de entorno: se aceptan los dos juegos de nombres.
 *   Vercel → Storage → Upstash:  KV_REST_API_URL / KV_REST_API_TOKEN
 *   Panel de Upstash:            UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *
 * Si faltan, todo degrada a "sin caché": la web funciona, sólo que cada
 * petición va a la fuente. No lanza en import.
 */

/** Primer valor no vacío de la lista: alias de entorno sin repetir código. */
function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

const REST_URL = firstEnv("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL").replace(/\/+$/, "");
const REST_TOKEN = firstEnv("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");

export const REDIS_TIMEOUT_MS = positiveInt(process.env.REDIS_TIMEOUT_MS, 1_500);
export const REDIS_PIPELINE_TIMEOUT_MS = positiveInt(process.env.REDIS_PIPELINE_TIMEOUT_MS, 4_000);

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return parsed > 0 ? parsed : fallback;
}

export function isRedisConfigured(): boolean {
  return Boolean(REST_URL && REST_TOKEN);
}

function keyPrefix(): string {
  const env = process.env.VERCEL_ENV;
  if (!env || env === "production") return "";
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 8);
  return `${env}:${sha}:`;
}

function finalKey(key: string, raw: boolean): string {
  return raw ? key : `${keyPrefix()}${key}`;
}

/**
 * Clave con el prefijo del entorno: una preview no debe ver ni pisar las
 * claves de producción. Para quien escribe Redis con `redisCommand` directo,
 * que no pasa por `finalKey`.
 */
export function scopedKey(key: string): string {
  return finalKey(key, false);
}

type RedisReply<T> = { result?: T; error?: string };

export async function redisCommand<T = unknown>(
  args: (string | number)[],
  timeoutMs: number = REDIS_TIMEOUT_MS,
): Promise<T> {
  if (!isRedisConfigured()) throw new Error("Redis no configurado");
  const resp = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "aitor-api/1.0 (redis)",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`Redis HTTP ${resp.status}`);
  const data = (await resp.json()) as RedisReply<T>;
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result as T;
}

export async function redisPipeline<T = unknown>(
  commands: (string | number)[][],
  timeoutMs: number = REDIS_PIPELINE_TIMEOUT_MS,
): Promise<(T | null)[]> {
  if (!isRedisConfigured() || commands.length === 0) return commands.map(() => null);
  const resp = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "aitor-api/1.0 (redis)",
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`Redis HTTP ${resp.status}`);
  const rows = (await resp.json()) as RedisReply<T>[];
  return rows.map((row) => (row?.error ? null : (row?.result ?? null)));
}

/**
 * `negative` es distinto de `miss` a propósito: significa "hace poco que esta
 * clave falló, no salgas a la red todavía".
 */
export type CacheRead<T> =
  | { status: "hit"; value: T }
  | { status: "negative" }
  | { status: "miss" }
  | { status: "error"; error: unknown };

const NULL_SENTINEL = { __null: true } as const;

function isNullSentinel(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { __null?: boolean }).__null === true);
}

export async function getJsonStatus<T = unknown>(key: string, raw = false): Promise<CacheRead<T>> {
  if (!isRedisConfigured()) return { status: "miss" };
  try {
    const stored = await redisCommand<string | null>(["GET", finalKey(key, raw)]);
    if (stored == null) return { status: "miss" };
    const parsed = JSON.parse(stored) as unknown;
    if (isNullSentinel(parsed)) return { status: "negative" };
    return { status: "hit", value: parsed as T };
  } catch (error) {
    return { status: "error", error };
  }
}

export async function getJson<T = unknown>(key: string, raw = false): Promise<T | null> {
  const read = await getJsonStatus<T>(key, raw);
  return read.status === "hit" ? read.value : null;
}

export async function setJson(key: string, value: unknown, ttlSeconds: number, raw = false): Promise<void> {
  if (!isRedisConfigured()) return;
  const ttl = Math.max(1, Math.round(ttlSeconds));
  await redisCommand(["SET", finalKey(key, raw), JSON.stringify(value), "EX", String(ttl)]);
}

/** Peticiones en vuelo por isolate: la segunda espera a la primera. */
const inFlight = new Map<string, Promise<unknown>>();

export interface CachedFetchOpts {
  negativeTtlSeconds?: number;
  onError?: "null" | "throw";
  inflightKey?: string;
}

/**
 * Devuelve el JSON cacheado de `key`; si no está, ejecuta `fetcher` una sola vez.
 *
 * Con `onError: "throw"` el primer llamante recibe la excepción y los siguientes,
 * durante `negativeTtlSeconds`, reciben null SIN volver a salir a la red.
 */
export async function cachedFetchJson<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>,
  opts: CachedFetchOpts = {},
): Promise<T | null> {
  const negativeTtl = opts.negativeTtlSeconds ?? 120;
  const mode = opts.onError ?? "null";

  const cached = await getJsonStatus<T>(key);
  if (cached.status === "hit") return cached.value;
  if (cached.status === "negative") return null;

  const flightKey = opts.inflightKey ?? key;
  const pending = inFlight.get(flightKey);
  if (pending) return pending as Promise<T | null>;

  const work = (async (): Promise<T | null> => {
    try {
      const fresh = await fetcher();
      if (fresh == null) {
        if (negativeTtl > 0) await setJson(key, NULL_SENTINEL, negativeTtl);
        return null;
      }
      if (ttlSeconds > 0) await setJson(key, fresh, ttlSeconds);
      return fresh;
    } catch (error) {
      if (negativeTtl > 0) {
        try {
          await setJson(key, NULL_SENTINEL, negativeTtl);
        } catch {
          /* si Redis también falla, no hay nada que cachear */
        }
      }
      console.warn(`[cache] ${key} falló:`, error instanceof Error ? error.message : error);
      if (mode === "throw") throw error;
      return null;
    } finally {
      inFlight.delete(flightKey);
    }
  })();

  inFlight.set(flightKey, work);
  return work;
}

export interface SeedMeta {
  fetchedAt: string;
  recordCount: number;
  [extra: string]: unknown;
}

export function seedMetaKey(dataKey: string): string {
  return `seed-meta:${dataKey}`;
}

export async function writeDataset(
  dataKey: string,
  data: unknown,
  opts: { ttlSeconds: number; recordCount?: number; extra?: Record<string, unknown> },
): Promise<void> {
  if (!isRedisConfigured()) return;
  const ttl = Math.max(1, Math.round(opts.ttlSeconds));
  const meta: SeedMeta = {
    fetchedAt: new Date().toISOString(),
    recordCount: opts.recordCount ?? (Array.isArray(data) ? data.length : 0),
    ...(opts.extra ?? {}),
  };
  await redisPipeline([
    ["SET", finalKey(dataKey, false), JSON.stringify(data), "EX", String(ttl)],
    ["SET", seedMetaKey(dataKey), JSON.stringify(meta), "EX", String(ttl)],
  ]);
}

export async function writeSeedMeta(
  dataKey: string,
  recordCount: number,
  metaTtlSeconds: number,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!isRedisConfigured()) return;
  const meta: SeedMeta = { fetchedAt: new Date().toISOString(), recordCount, ...extra };
  await redisCommand([
    "SET",
    seedMetaKey(dataKey),
    JSON.stringify(meta),
    "EX",
    String(Math.max(1, Math.round(metaTtlSeconds))),
  ]);
}

/**
 * Deja la marca de frescura que lee `/api/health`, sin escribir los datos.
 *
 * Se llama donde ya se acaba de traer el dato, para que la salud no dependa de
 * que otro proceso (ni el cron de alertas) pase por la caché: el que consultó
 * la fuente deja constancia de cuándo y cuánto trajo, y nada más.
 *
 * No lanza nunca. Si Redis falla o no está configurado, devuelve `false` y el
 * llamante sigue con los datos que ya tiene; la salud lo verá como EMPTY o
 * STALE, que es exactamente lo que pasó.
 */
export async function recordSeed(
  dataKey: string,
  recordCount: number,
  metaTtlSeconds: number,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    await writeSeedMeta(dataKey, recordCount, metaTtlSeconds, extra);
    return true;
  } catch (error) {
    console.warn(
      `[seed] ${dataKey} sin marca:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export async function readSeedMetas(keys: string[]): Promise<Map<string, SeedMeta | null>> {
  const out = new Map<string, SeedMeta | null>();
  if (keys.length === 0) return out;
  if (!isRedisConfigured()) {
    for (const key of keys) out.set(key, null);
    return out;
  }
  const values = await redisCommand<(string | null)[]>(["MGET", ...keys.map(seedMetaKey)]);
  keys.forEach((key, index) => {
    const raw = values?.[index];
    if (!raw) {
      out.set(key, null);
      return;
    }
    try {
      out.set(key, JSON.parse(raw) as SeedMeta);
    } catch {
      out.set(key, null);
    }
  });
  return out;
}
