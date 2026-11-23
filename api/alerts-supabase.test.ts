/**
 * Alertas en Postgres: el módulo de respaldo y la migración que lo sostiene.
 *
 * La migración **no está aplicada**, así que aquí se fija lo que se puede fijar
 * sin un Supabase real: contra qué RPC se habla, con qué claves y con qué
 * números, qué significa cada respuesta, y que ni la falta de service role ni
 * un 404 dejan al bot sin poder seguir con Redis.
 *
 * La segunda mitad lee el `.sql` y comprueba las cerraduras: si alguien quita
 * los `revoke` o el `grant ... to service_role`, la tabla quedaría abierta a la
 * clave anon del bundle y el test se pone rojo antes de aplicar nada.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Alert } from "./_shared/alerts";
import {
  ALERTS_TIMEOUT_MS,
  ALERTS_TTL_SECONDS,
  MAX_ALERTS_PER_CHAT,
  addAlertSupabase,
  alertsUrl,
  deleteAlertsSupabase,
  isSupabaseAlertsConfigured,
  readAlertsSupabase,
} from "./_shared/alerts-supabase";

const URL_DEL_PROYECTO = "https://proyecto.supabase.co";
const CLAVE_DE_SERVICIO = "clave-de-servicio-de-prueba";

const state = vi.hoisted(() => ({
  status: 200,
  answer: null as unknown,
  fetched: [] as { url: string; init: RequestInit }[],
}));

vi.stubGlobal("fetch", (async (url: string, init: RequestInit) => {
  state.fetched.push({ url: String(url), init });
  return new Response(state.answer === null ? "" : JSON.stringify(state.answer), {
    status: state.status,
    headers: { "Content-Type": "application/json" },
  });
}) as unknown as typeof fetch);

const ALERTA: Alert = {
  kind: "price",
  chatId: 42,
  createdAt: "2026-11-23T10:00:00.000Z",
  symbol: "BTC",
  direction: "above",
  price: 95_000,
};

const body = () => JSON.parse(String(state.fetched[0].init.body)) as Record<string, unknown>;
const call = (index = 0) => ({
  url: state.fetched[index].url,
  headers: state.fetched[index].init.headers as Record<string, string>,
});

beforeEach(() => {
  state.status = 200;
  state.answer = null;
  state.fetched = [];
  vi.stubEnv("SUPABASE_URL", URL_DEL_PROYECTO);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", CLAVE_DE_SERVICIO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configuración", () => {
  it("sin service role no hay respaldo y no se llama a Supabase", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isSupabaseAlertsConfigured()).toBe(false);

    await expect(addAlertSupabase(42, ALERTA)).resolves.toEqual({
      ok: false,
      reason: "sin-supabase",
    });
    expect(state.fetched).toHaveLength(0);
  });

  it("la URL sale sin barra final y la clave no se recorta", () => {
    expect(alertsUrl({ SUPABASE_URL: "https://x.supabase.co///" })).toBe("https://x.supabase.co");
    // VITE_SUPABASE_URL es el respaldo que ya usa el webhook.
    expect(alertsUrl({ VITE_SUPABASE_URL: "https://y.supabase.co" })).toBe("https://y.supabase.co");
  });

  it("el techo de la llamada es corto: el respaldo no puede frenar al bot", () => {
    expect(ALERTS_TIMEOUT_MS).toBeLessThanOrEqual(3_000);
  });
});

describe("addAlertSupabase", () => {
  it("manda chat, alerta, tope y caducidad a la RPC con la service role", async () => {
    state.answer = { ok: true, id: "8b6f0f0e-2f7f-4a5e-9a8e-1c6a0b1f2d3c", count: 3 };

    await expect(addAlertSupabase(42, ALERTA)).resolves.toEqual({
      ok: true,
      total: 3,
      id: "8b6f0f0e-2f7f-4a5e-9a8e-1c6a0b1f2d3c",
    });

    expect(call().url).toBe(`${URL_DEL_PROYECTO}/rest/v1/rpc/add_telegram_alert`);
    expect(call().headers.apikey).toBe(CLAVE_DE_SERVICIO);
    expect(call().headers.Authorization).toBe(`Bearer ${CLAVE_DE_SERVICIO}`);
    expect(body()).toEqual({
      p_chat_id: 42,
      p_alert: ALERTA,
      p_max: MAX_ALERTS_PER_CHAT,
      p_ttl_seconds: ALERTS_TTL_SECONDS,
    });
    // Los números del módulo son los del almacén de Redis: si se separan, el
    // tope cambia según dónde caiga la alerta.
    expect(body().p_max).toBe(10);
    expect(body().p_ttl_seconds).toBe(30 * 24 * 3_600);
  });

  it("el tope lo decide la RPC: `limit` es «demasiadas», no un fallo de red", async () => {
    state.answer = { ok: false, reason: "limit", count: 10 };
    await expect(addAlertSupabase(42, ALERTA)).resolves.toEqual({
      ok: false,
      reason: "demasiadas",
    });
  });

  it("una alerta inválida se distingue de un Supabase caído", async () => {
    state.answer = { ok: false, reason: "invalid" };
    await expect(addAlertSupabase(42, ALERTA)).resolves.toEqual({
      ok: false,
      reason: "invalida",
    });
  });

  it("un 404 (migración sin aplicar) es «sin-supabase», no una excepción", async () => {
    state.status = 404;
    state.answer = { message: "Could not find the function" };
    await expect(addAlertSupabase(42, ALERTA)).resolves.toEqual({
      ok: false,
      reason: "sin-supabase",
    });
  });

  it("una respuesta con forma rara no se toma por un sí", async () => {
    for (const answer of [{ ok: true }, { ok: true, count: "3" }, null, "ok", 1]) {
      state.answer = answer;
      await expect(addAlertSupabase(42, ALERTA)).resolves.toEqual({
        ok: false,
        reason: "sin-supabase",
      });
    }
  });
});

describe("readAlertsSupabase", () => {
  it("lee los payloads y descarta filas que no son alertas", async () => {
    state.answer = [
      { id: "uno", payload: ALERTA },
      { id: "dos", payload: { kind: "price", chatId: 42, symbol: "NOPE", direction: "above", price: 1 } },
      { id: "tres", payload: { kind: "quake", chatId: 42, createdAt: "", minMagnitude: 5.5 } },
      { id: "cuatro" },
      null,
    ];

    const alerts = await readAlertsSupabase(42);
    expect(alerts).toEqual([
      ALERTA,
      { kind: "quake", chatId: 42, createdAt: "", minMagnitude: 5.5 },
    ]);
    expect(call().url).toBe(`${URL_DEL_PROYECTO}/rest/v1/rpc/list_telegram_alerts`);
    expect(body()).toEqual({ p_chat_id: 42 });
  });

  it("un chat sin alertas es una lista vacía, no un fallo", async () => {
    state.answer = [];
    await expect(readAlertsSupabase(7)).resolves.toEqual([]);
  });

  it("si Supabase falla devuelve null: no se confunde con «no hay alertas»", async () => {
    state.status = 500;
    state.answer = { message: "boom" };
    await expect(readAlertsSupabase(42)).resolves.toBeNull();
  });
});

describe("deleteAlertsSupabase", () => {
  it("sin id vacía el chat y devuelve cuántas borró", async () => {
    state.answer = 3;
    await expect(deleteAlertsSupabase(42)).resolves.toBe(3);
    expect(call().url).toBe(`${URL_DEL_PROYECTO}/rest/v1/rpc/delete_telegram_alert`);
    expect(body()).toEqual({ p_chat_id: 42, p_id: null });
  });

  it("con id borra una sola", async () => {
    state.answer = 1;
    await expect(
      deleteAlertsSupabase(42, "8b6f0f0e-2f7f-4a5e-9a8e-1c6a0b1f2d3c"),
    ).resolves.toBe(1);
    expect(body().p_id).toBe("8b6f0f0e-2f7f-4a5e-9a8e-1c6a0b1f2d3c");
  });

  it("sin respuesta buena devuelve null", async () => {
    state.answer = { deleted: 3 };
    await expect(deleteAlertsSupabase(42)).resolves.toBeNull();
  });
});

describe("la migración preparada", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20261123120000_telegram_alerts.sql"),
    "utf8",
  );
  const flat = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

  it("crea la tabla con caducidad explícita y las dos consultas indexadas", () => {
    expect(flat).toContain("create table if not exists public.telegram_alerts");
    expect(flat).toContain("expires_at timestamptz not null");
    expect(flat).toContain("on public.telegram_alerts (chat_id, expires_at)");
    expect(flat).toContain("on public.telegram_alerts (expires_at)");
  });

  it("cierra la tabla y las funciones a anon y authenticated", () => {
    expect(flat).toContain("alter table public.telegram_alerts enable row level security");
    expect(flat).toContain("revoke all on public.telegram_alerts from anon, authenticated");
    for (const signature of [
      "public.add_telegram_alert(bigint, jsonb, integer, integer)",
      "public.list_telegram_alerts(bigint)",
      "public.delete_telegram_alert(bigint, uuid)",
      "public.prune_telegram_alerts()",
    ]) {
      expect(flat).toContain(`revoke all on function ${signature} from public, anon, authenticated`);
      expect(flat).toContain(`grant execute on function ${signature} to service_role`);
    }
  });

  it("el tope es 10 por chat, con lock y limpieza de caducadas antes de contar", () => {
    expect(flat).toContain("p_max integer default 10");
    expect(flat).toContain("p_ttl_seconds integer default 2592000");
    expect(flat).toContain("pg_advisory_xact_lock(hashtext('telegram_alerts:' || p_chat_id::text))");
    expect(flat.indexOf("delete from public.telegram_alerts")).toBeLessThan(
      flat.indexOf("select count(*) into v_count"),
    );
    expect(flat).toContain("if v_count >= v_max then");
    expect(flat).toContain("'reason', 'limit'");
  });

  it("las cuatro funciones son `security definer` con `search_path` fijo", () => {
    // Sin esto, una función `security definer` puede resolver nombres de
    // objetos contra el `search_path` de quien la llama.
    expect(flat.match(/security definer/g)).toHaveLength(4);
    expect(flat.match(/set search_path = public/g)).toHaveLength(4);
  });
});
