/**
 * La memoria del hilo, sin red ni Supabase real.
 *
 * Fija lo que no se ve leyendo el módulo: la ventana (ocho mensajes), la
 * caducidad (seis horas), el orden en que se piden los turnos a PostgREST y
 * que, sin `SUPABASE_SERVICE_ROLE_KEY`, no se hace ni una petición.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  historyMessages,
  isStale,
  loadThread,
  memoryConfigured,
  normalizeThreadRef,
  saveTurn,
  STALE_HOURS,
  WINDOW_MESSAGES,
} from "./thread-memory";

const TOKEN = `tg_${"a1b2c3d4".repeat(4)}`;
const ref = { surface: "telegram" as const, externalId: TOKEN };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio";
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.unstubAllGlobals();
});

describe("normalizeThreadRef", () => {
  it("acepta el token de su superficie y rechaza los cruces", () => {
    expect(normalizeThreadRef(ref)).toEqual(ref);
    expect(normalizeThreadRef({ surface: "web", externalId: TOKEN })).toBeNull();
    expect(normalizeThreadRef({ surface: "telegram", externalId: "tg_abc" })).toBeNull();
    expect(normalizeThreadRef({ surface: "telegram", externalId: `tg_${"z".repeat(32)}` })).toBeNull();
    expect(normalizeThreadRef(null)).toBeNull();
  });
});

describe("isStale y historyMessages", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("un hilo de hace siete horas está viejo; uno de hace una no", () => {
    expect(isStale("2026-11-20T05:00:00Z", now)).toBe(true);
    expect(isStale("2026-11-20T11:00:00Z", now)).toBe(false);
    expect(isStale(null, now)).toBe(false);
    expect(STALE_HOURS).toBe(6);
  });

  it("un hilo vivo mete sus turnos en orden", () => {
    const messages = historyMessages(
      {
        summary: null,
        lastActiveAt: "2026-11-20T11:59:00Z",
        turns: [
          { role: "user", content: "me llamo Ana" },
          { role: "assistant", content: "encantado" },
        ],
      },
      now,
    );

    expect(messages).toEqual([
      { role: "user", content: "me llamo Ana" },
      { role: "assistant", content: "encantado" },
    ]);
  });

  it("un hilo viejo sólo lleva el resumen, no la charla de hace días", () => {
    const messages = historyMessages(
      {
        summary: "el usuario lleva BTC",
        lastActiveAt: "2026-11-10T10:00:00Z",
        turns: [{ role: "user", content: "hola" }],
      },
      now,
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("el usuario lleva BTC");
    expect(JSON.stringify(messages)).not.toContain("hola");
  });

  it("sin hilo no hay contexto inventado", () => {
    expect(historyMessages(null, now)).toEqual([]);
    expect(historyMessages({ summary: null, lastActiveAt: null, turns: [] }, now)).toEqual([]);
  });
});

describe("loadThread", () => {
  it("pide la cabecera por token, los últimos mensajes y los devuelve en orden", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (String(url).includes("chat_threads")) {
          return {
            ok: true,
            json: async () => [{ id: "hilo-1", summary: "resumen", last_active_at: "2026-11-20T11:00:00Z" }],
          };
        }
        return {
          ok: true,
          // PostgREST: los últimos primero.
          json: async () => [
            { role: "assistant", content: "segunda" },
            { role: "user", content: "primera" },
          ],
        };
      }),
    );

    const thread = await loadThread(ref);

    expect(thread?.summary).toBe("resumen");
    expect(thread?.turns.map((turn) => turn.content)).toEqual(["primera", "segunda"]);
    expect(urls[0]).toContain("surface=eq.telegram");
    expect(urls[0]).toContain(`external_id=eq.${TOKEN}`);
    expect(urls[0]).toContain("select=id,summary,last_active_at");
    expect(urls[1]).toContain(`limit=${WINDOW_MESSAGES}`);
    expect(urls[1]).toContain("order=id.desc");
  });

  it("un hilo que no existe devuelve vacío, no un error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));

    expect(await loadThread(ref)).toEqual({ summary: null, lastActiveAt: null, turns: [] });
  });

  it("si Postgres falla devuelve null en vez de lanzar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin red");
      }),
    );

    expect(await loadThread(ref)).toBeNull();
  });
});

describe("saveTurn", () => {
  it("da de alta el hilo y guarda los dos lados del turno", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
        if (String(url).includes("on_conflict")) {
          return { ok: true, json: async () => [{ id: "hilo-9" }] };
        }
        return { ok: true, json: async () => [] };
      }),
    );

    expect(await saveTurn(ref, "me llamo X", "encantado")).toBe(true);

    expect(calls[0].url).toContain("on_conflict=surface,external_id");
    expect(calls[0].body).toEqual([
      { surface: "telegram", external_id: TOKEN, last_active_at: expect.any(String) },
    ]);
    expect(calls[1].body).toEqual([
      { thread_id: "hilo-9", role: "user", content: "me llamo X" },
      { thread_id: "hilo-9", role: "assistant", content: "encantado" },
    ]);
  });

  it("recorta al tope de 8000 caracteres que acepta la tabla", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("on_conflict")) {
          return { ok: true, json: async () => [{ id: "hilo-1" }] };
        }
        bodies.push(JSON.parse(String(init?.body)));
        return { ok: true, json: async () => [] };
      }),
    );

    await saveTurn(ref, "x".repeat(9000), "");

    const rows = bodies[0] as Array<{ content: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toHaveLength(8000);
  });

  it("sin service key no hay memoria y no se hace ninguna petición", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(memoryConfigured()).toBe(false);
    expect(await loadThread(ref)).toBeNull();
    expect(await saveTurn(ref, "hola", "qué tal")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
