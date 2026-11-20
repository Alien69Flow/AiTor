/**
 * Dedupe de updates sin Redis: la reserva en Postgres.
 *
 * Lo que se fija aquí es lo que no se puede ver desde fuera sin Telegram ni un
 * Supabase real: la llamada es a `reserve_telegram_update` con la service role,
 * un `false` de la RPC descarta el reintento, y ni la falta de claves ni una
 * caída de Supabase dejan al usuario sin respuesta.
 *
 * También se fija lo que NO cambia: con Redis configurado, Supabase no se toca.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: false,
  reply: "OK" as string | null,
  commands: 0,
  fetched: [] as { url: string; init: RequestInit }[],
  answer: true as boolean,
  status: 200,
}));

vi.mock("./_shared/redis.js", () => ({
  isRedisConfigured: () => state.configured,
  scopedKey: (key: string) => key,
  redisCommand: async () => {
    state.commands += 1;
    return state.reply;
  },
}));

vi.stubGlobal("fetch", (async (url: string, init: RequestInit) => {
  state.fetched.push({ url: String(url), init });
  if (state.status !== 200) return new Response("error", { status: state.status });
  return new Response(JSON.stringify(state.answer), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as unknown as typeof fetch);

import { claimUpdate } from "./_shared/update-dedupe";
import {
  isSupabaseDedupeConfigured,
  RESERVATION_TIMEOUT_MS,
  reservationUrl,
} from "./_shared/update-dedupe-supabase";

const URL_DEL_PROYECTO = "https://proyecto.supabase.co";
const CLAVE_DE_SERVICIO = "clave-de-servicio-de-prueba";

beforeEach(() => {
  state.configured = false;
  state.reply = "OK";
  state.commands = 0;
  state.fetched = [];
  state.answer = true;
  state.status = 200;
  vi.stubEnv("SUPABASE_URL", URL_DEL_PROYECTO);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", CLAVE_DE_SERVICIO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function cuerpoDeLaReserva(): Record<string, unknown> {
  const init = state.fetched[0]?.init;
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

describe("claimUpdate sin Redis, con Supabase", () => {
  it("la primera entrega reserva el update en Postgres", async () => {
    await expect(claimUpdate(42)).resolves.toBe(true);

    expect(state.fetched).toHaveLength(1);
    expect(state.fetched[0]?.url).toBe(`${URL_DEL_PROYECTO}/rest/v1/rpc/reserve_telegram_update`);
    expect(cuerpoDeLaReserva()).toEqual({ p_update_id: 42, p_ttl_seconds: 600 });

    const headers = state.fetched[0]?.init.headers as Record<string, string>;
    // Service role, nunca la anon del bundle: escribir aquí decide qué mensajes
    // se contestan.
    expect(headers.apikey).toBe(CLAVE_DE_SERVICIO);
    expect(headers.Authorization).toBe(`Bearer ${CLAVE_DE_SERVICIO}`);
    expect(state.commands).toBe(0);
  });

  it("el reintento de Telegram no se procesa otra vez", async () => {
    // La RPC devuelve `false` cuando otra entrega tiene la reserva viva.
    state.answer = false;
    await expect(claimUpdate(42)).resolves.toBe(false);
    expect(state.fetched).toHaveLength(1);
  });

  it("se le puede pedir otra ventana, y viaja en la reserva", async () => {
    await claimUpdate(7, 90);
    expect(cuerpoDeLaReserva()).toEqual({ p_update_id: 7, p_ttl_seconds: 90 });
  });

  it("sin service role no hay respaldo y se procesa igual", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(claimUpdate(42)).resolves.toBe(true);
    expect(state.fetched).toHaveLength(0);
  });

  it("si Supabase falla también se procesa", async () => {
    state.status = 503;

    await expect(claimUpdate(42)).resolves.toBe(true);
    expect(state.fetched).toHaveLength(1);
  });

  it("una respuesta que no es booleana no se interpreta como reserva", async () => {
    state.answer = "ok" as unknown as boolean; // la RPC devuelve boolean; esto no
    await expect(claimUpdate(42)).resolves.toBe(true);
  });

  it("un update_id que no es un entero positivo no llega a la red", async () => {
    await expect(claimUpdate(Number.NaN)).resolves.toBe(true);
    await expect(claimUpdate(0)).resolves.toBe(true);
    expect(state.fetched).toHaveLength(0);
  });
});

describe("El camino de Redis no cambia", () => {
  it("con Redis configurado, la reserva se pide a Redis y nunca a Supabase", async () => {
    state.configured = true;

    await expect(claimUpdate(42)).resolves.toBe(true);
    expect(state.commands).toBe(1);
    expect(state.fetched).toHaveLength(0);
  });

  it("con Redis configurado, un reintento lo descarta Redis", async () => {
    state.configured = true;
    state.reply = null;

    await expect(claimUpdate(42)).resolves.toBe(false);
    expect(state.fetched).toHaveLength(0);
  });
});

describe("Configuración del respaldo", () => {
  it("pide URL y service role: con una sola no está configurado", () => {
    expect(isSupabaseDedupeConfigured({ SUPABASE_URL: URL_DEL_PROYECTO, SUPABASE_SERVICE_ROLE_KEY: "x" })).toBe(true);
    expect(isSupabaseDedupeConfigured({ SUPABASE_URL: URL_DEL_PROYECTO })).toBe(false);
    expect(isSupabaseDedupeConfigured({ SUPABASE_SERVICE_ROLE_KEY: "x" })).toBe(false);
    expect(isSupabaseDedupeConfigured({})).toBe(false);
  });

  it("acepta la URL heredada y quita la barra final", () => {
    expect(reservationUrl({ VITE_SUPABASE_URL: `${URL_DEL_PROYECTO}/` })).toBe(URL_DEL_PROYECTO);
    // SUPABASE_URL manda cuando existe, igual que en el webhook.
    expect(reservationUrl({ SUPABASE_URL: "https://a.supabase.co", VITE_SUPABASE_URL: URL_DEL_PROYECTO }))
      .toBe("https://a.supabase.co");
  });

  it("la espera máxima es corta: el dedupe no puede frenar la respuesta", () => {
    expect(RESERVATION_TIMEOUT_MS).toBeLessThanOrEqual(3_000);
  });
});
