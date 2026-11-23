/**
 * Las alertas cuando no hay Redis: Postgres como respaldo.
 *
 * El almacén normal es el hash `aitor:alerts` (`api/_shared/alerts.ts`). Este
 * módulo es el mismo contrato contra `public.telegram_alerts`, cuya migración
 * (`supabase/migrations/20261123120000_telegram_alerts.sql`) queda preparada y
 * **sin aplicar**: hasta que se aplique, la RPC responde 404 y todo esto
 * devuelve `null` / «sin-supabase», exactamente como si no hubiera respaldo.
 *
 * Tres decisiones que vienen de la migración y conviene tener presentes aquí:
 *
 *  · El tope de 10 se aplica **en la RPC**, con un lock por chat. Contar aquí y
 *    escribir después dejaría pasar 11 con dos altas simultáneas.
 *  · La caducidad es explícita (`expires_at`): la RPC limpia lo caducado del
 *    chat antes de contar, así que un aviso viejo no gasta cupo.
 *  · Todo va con `service_role`. Nunca con la anon: escribir aquí decide a
 *    quién avisa el bot, y la anon es pública.
 *
 * Ninguna función lanza: un fallo de Supabase es `null` o «sin-supabase», y el
 * que llama decide qué hacer (seguir como si no hubiera respaldo).
 */

import { sanitizeAlerts, type Alert } from "./alerts.js";

const ADD_RPC = "/rest/v1/rpc/add_telegram_alert";
const LIST_RPC = "/rest/v1/rpc/list_telegram_alerts";
const DELETE_RPC = "/rest/v1/rpc/delete_telegram_alert";

/** Techo para no convertir el respaldo en una espera. */
export const ALERTS_TIMEOUT_MS = 2_500;

/** Los mismos números que `alerts.ts`; la RPC los recibe explícitos. */
export const MAX_ALERTS_PER_CHAT = 10;
export const ALERTS_TTL_SECONDS = 30 * 24 * 3_600;

export type AlertStoreResult =
  | { ok: true; total: number; id: string | null }
  | { ok: false; reason: "sin-supabase" | "demasiadas" | "invalida" };

/** URL del proyecto, sin barra final. Misma elección que el webhook. */
export function alertsUrl(env: Record<string, string | undefined>): string {
  return (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

/** La clave con la que se puede escribir. Sin ella no hay respaldo. */
export function alertsKey(env: Record<string, string | undefined>): string {
  return (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/** `true` sólo con las dos cosas: URL y service role. */
export function isSupabaseAlertsConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(alertsUrl(env) && alertsKey(env));
}

async function rpc(
  path: string,
  body: Record<string, unknown>,
  env: Record<string, string | undefined>,
): Promise<unknown | null> {
  const url = alertsUrl(env);
  const key = alertsKey(env);
  if (!url || !key) return null;

  try {
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ALERTS_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[alertas] Supabase respondió ${response.status}: se sigue sin respaldo`);
      return null;
    }
    return await response.json().catch(() => null);
  } catch (error) {
    console.warn(
      "[alertas] no se pudo hablar con Supabase:",
      error instanceof Error ? error.message : "error desconocido",
    );
    return null;
  }
}

/**
 * Añade una alerta con el tope y la caducidad de la RPC.
 *
 * `"sin-supabase"` significa «no se pudo» (sin configurar, caído, 404 porque la
 * migración no está aplicada): el que llama puede seguir con Redis.
 * `"demasiadas"` e `"invalida"` son respuestas de negocio y no deben reintentarse.
 */
export async function addAlertSupabase(
  chatId: number,
  alert: Alert,
  env: Record<string, string | undefined> = process.env,
): Promise<AlertStoreResult> {
  const answer = (await rpc(
    ADD_RPC,
    {
      p_chat_id: chatId,
      p_alert: alert,
      p_max: MAX_ALERTS_PER_CHAT,
      p_ttl_seconds: ALERTS_TTL_SECONDS,
    },
    env,
  )) as { ok?: unknown; reason?: unknown; count?: unknown; id?: unknown } | null;

  if (!answer || typeof answer !== "object") return { ok: false, reason: "sin-supabase" };
  if (answer.ok !== true) {
    if (answer.reason === "limit") return { ok: false, reason: "demasiadas" };
    if (answer.reason === "invalid") return { ok: false, reason: "invalida" };
    // Una RPC que contesta algo que no se entiende no es un sí.
    return { ok: false, reason: "sin-supabase" };
  }
  if (typeof answer.count !== "number" || !Number.isFinite(answer.count)) {
    return { ok: false, reason: "sin-supabase" };
  }
  return {
    ok: true,
    total: answer.count,
    id: typeof answer.id === "string" ? answer.id : null,
  };
}

/**
 * Alertas vivas de un chat, ya saneadas.
 *
 * `null` = no se pudo leer (sin configurar, caído, migración sin aplicar). Un
 * array —aunque esté vacío— es una lectura buena; no se pueden confundir.
 */
export async function readAlertsSupabase(
  chatId: number,
  env: Record<string, string | undefined> = process.env,
): Promise<Alert[] | null> {
  const answer = await rpc(LIST_RPC, { p_chat_id: chatId }, env);
  if (!Array.isArray(answer)) return null;

  // PostgREST devuelve las columnas de la tabla; la alerta está en `payload`.
  const payloads: unknown[] = [];
  for (const row of answer) {
    if (row && typeof row === "object" && "payload" in row) {
      payloads.push((row as { payload: unknown }).payload);
    }
  }
  return sanitizeAlerts(payloads);
}

/**
 * Borra una alerta, o todas las del chat si no se pasa `id` (`/alerta borra`).
 *
 * Devuelve cuántas borró; `null` si no se pudo hablar con Supabase.
 */
export async function deleteAlertsSupabase(
  chatId: number,
  id: string | null = null,
  env: Record<string, string | undefined> = process.env,
): Promise<number | null> {
  const answer = await rpc(
    DELETE_RPC,
    { p_chat_id: chatId, p_id: id },
    env,
  );
  if (typeof answer !== "number" || !Number.isFinite(answer)) return null;
  return answer;
}
