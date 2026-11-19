/**
 * Deduplicación de actualizaciones de Telegram.
 *
 * Lo que se fija aquí es la parte que no se puede probar desde fuera sin
 * Telegram ni Upstash: la reserva es atómica (`SET … NX` con caducidad), el
 * reintento no vuelve a procesar, y un fallo de Redis NO deja al usuario sin
 * respuesta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  reply: "OK" as string | null,
  failure: null as Error | null,
  calls: [] as (string | number)[][],
}));

vi.mock("./_shared/redis.js", () => ({
  isRedisConfigured: () => state.configured,
  scopedKey: (key: string) => `preview:abc12345:${key}`,
  redisCommand: async (args: (string | number)[]) => {
    state.calls.push(args);
    if (state.failure) throw state.failure;
    return state.reply;
  },
}));

import { claimUpdate, UPDATE_TTL_SECONDS, updateKey } from "./_shared/update-dedupe";

beforeEach(() => {
  state.configured = true;
  state.reply = "OK";
  state.failure = null;
  state.calls = [];
});

describe("claimUpdate", () => {
  it("la primera entrega gana la reserva con NX y caducidad", async () => {
    await expect(claimUpdate(42)).resolves.toBe(true);

    const [command, key, value, nx, ex, ttl] = state.calls[0] ?? [];
    expect(command).toBe("SET");
    expect(String(key)).toContain("42");
    expect(value).toBe("1");
    expect(nx).toBe("NX");
    expect(ex).toBe("EX");
    expect(ttl).toBe(String(UPDATE_TTL_SECONDS));
  });

  it("el reintento de Telegram no se procesa otra vez", async () => {
    // Redis devuelve nil cuando NX no pudo escribir: la clave ya existía.
    state.reply = null;
    await expect(claimUpdate(42)).resolves.toBe(false);
  });

  it("sin Redis se procesa igual, para no dejar al usuario sin respuesta", async () => {
    state.configured = false;
    await expect(claimUpdate(42)).resolves.toBe(true);
    expect(state.calls).toHaveLength(0);
  });

  it("si Redis falla también se procesa", async () => {
    state.failure = new Error("Redis HTTP 503");
    await expect(claimUpdate(42)).resolves.toBe(true);
  });

  it("un update_id que no es un entero positivo no consulta Redis", async () => {
    await expect(claimUpdate(Number.NaN)).resolves.toBe(true);
    await expect(claimUpdate(0)).resolves.toBe(true);
    expect(state.calls).toHaveLength(0);
  });

  it("la reserva caduca en minutos, no en un día", () => {
    // Telegram reintenta en segundos o minutos: la ventana cubre eso y no deja
    // una clave por mensaje durante 24 h en el Redis de caché.
    expect(UPDATE_TTL_SECONDS).toBe(600);
    expect(UPDATE_TTL_SECONDS).toBeLessThanOrEqual(15 * 60);
  });

  it("la clave lleva el prefijo del entorno", () => {
    expect(updateKey(7)).toBe("preview:abc12345:aitor:tg:update:7");
  });
});
