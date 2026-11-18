import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendTurn,
  clearThread,
  historyMessages,
  isStale,
  loadThread,
  memoryConfig,
  STALE_HOURS,
  summarizeIfNeeded,
  SUMMARIZE_AFTER,
  WINDOW_TURNS,
  type MemoryConfig,
  type ThreadTurn,
} from "../../supabase/functions/chat/memory";

/**
 * La memoria es lo unico de la fase 3 que corre en cada mensaje: si se rompe,
 * el chat se queda mudo. Estas pruebas fijan las tres cosas que importan y que
 * no se ven mirando el codigo: la ventana (4 turnos), el TTL de contexto (6 h)
 * y que cualquier fallo de Postgres degrade a "sin memoria", nunca a error.
 *
 * `fetch` va simulado: no hay Supabase real ni Deno en esta suite.
 */

const config = (fetchImpl: typeof fetch): MemoryConfig => ({
  url: "https://proyecto.supabase.co",
  serviceKey: "clave-de-servicio",
  fetchImpl,
});

const json = (payload: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => payload,
}) as unknown as Response;

const turn = (id: number, role: "user" | "assistant", content: string): ThreadTurn => ({ id, role, content });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isStale", () => {
  it("un hilo de hace 7 horas está viejo; uno de hace 1 no", () => {
    const now = Date.parse("2026-11-18T20:00:00Z");
    expect(isStale("2026-11-18T13:00:00Z", now)).toBe(true);
    expect(isStale("2026-11-18T19:00:00Z", now)).toBe(false);
    expect(STALE_HOURS).toBe(6);
  });

  it("sin fecha no se considera viejo: no se inventa el estado", () => {
    expect(isStale(null)).toBe(false);
    expect(isStale("no-es-una-fecha")).toBe(false);
  });
});

describe("historyMessages", () => {
  const now = Date.parse("2026-11-18T20:00:00Z");
  const turns = [turn(1, "user", "hola"), turn(2, "assistant", "qué tal")];

  it("un hilo vivo mete resumen y turnos, en ese orden", () => {
    const messages = historyMessages(
      { threadId: "t", summary: "el usuario lleva BTC", lastActiveAt: "2026-11-18T19:55:00Z", turns },
      now,
    );

    expect(messages).toHaveLength(4);
    expect(messages[0].content).toContain("el usuario lleva BTC");
    expect(messages[0].content).toContain("MEMORIA DEL HILO");
    expect(messages.slice(2)).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "qué tal" },
    ]);
  });

  it("un hilo viejo sólo lleva el resumen: un mensaje de hace días no arrastra la charla", () => {
    const messages = historyMessages(
      { threadId: "t", summary: "resumen", lastActiveAt: "2026-11-10T10:00:00Z", turns },
      now,
    );
    expect(messages).toHaveLength(2);
    expect(JSON.stringify(messages)).not.toContain("qué tal");
  });

  it("sin hilo no hay mensajes y no se inventa contexto", () => {
    expect(historyMessages(null, now)).toEqual([]);
    expect(historyMessages({ threadId: null, summary: null, lastActiveAt: null, turns: [] }, now)).toEqual([]);
  });
});

describe("loadThread", () => {
  it("pide el hilo por superficie y chat, y devuelve los turnos en orden", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("chat_threads")) {
        return json([{ id: "hilo-1", summary: "resumen", last_active_at: "2026-11-18T19:00:00Z" }]);
      }
      // PostgREST devuelve los ultimos N en orden descendente.
      return json([turn(3, "assistant", "segunda"), turn(2, "user", "primera")]);
    }) as unknown as typeof fetch;

    const thread = await loadThread({ surface: "telegram", externalId: "-100123" }, config(fetchImpl));

    expect(thread?.threadId).toBe("hilo-1");
    expect(thread?.summary).toBe("resumen");
    expect(thread?.turns.map((entry) => entry.id)).toEqual([2, 3]);
    expect(calls[0]).toContain("surface=eq.telegram");
    expect(calls[0]).toContain("external_id=eq.-100123");
    expect(calls[1]).toContain(`limit=${WINDOW_TURNS}`);
  });

  it("sin configuración no hay memoria y no hay petición", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await loadThread({ surface: "telegram", externalId: "1" }, null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("si Postgres falla devuelve null en vez de lanzar", async () => {
    const fetchImpl = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    expect(await loadThread({ surface: "telegram", externalId: "1" }, config(fetchImpl))).toBeNull();
  });
});

describe("appendTurn", () => {
  it("da de alta el hilo y guarda los dos lados del turno", async () => {
    const posted: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      posted.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (String(url).includes("on_conflict")) return json([{ id: "hilo-9" }]);
      return json([]);
    }) as unknown as typeof fetch;

    const id = await appendTurn(
      { surface: "telegram", externalId: "42" },
      "me llamo X",
      "encantado",
      config(fetchImpl),
    );

    expect(id).toBe("hilo-9");
    const inserted = posted.find((call) => call.url.endsWith("/chat_turns"));
    expect(inserted?.body).toEqual([
      { thread_id: "hilo-9", role: "user", content: "me llamo X" },
      { thread_id: "hilo-9", role: "assistant", content: "encantado" },
    ]);
    expect(posted.some((call) => call.url.includes("chat_threads?id=eq.hilo-9"))).toBe(true);
  });

  it("recorta el turno al tope de 8000 caracteres que acepta la tabla", async () => {
    const bodies: unknown[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (String(url).includes("on_conflict")) return json([{ id: "hilo-1" }]);
      if (String(url).endsWith("/chat_turns")) bodies.push(JSON.parse(String(init?.body)));
      return json([]);
    }) as unknown as typeof fetch;

    await appendTurn({ surface: "web", externalId: "u1" }, "x".repeat(9000), "", config(fetchImpl));

    const rows = bodies[0] as Array<{ content: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toHaveLength(8000);
  });
});

describe("summarizeIfNeeded", () => {
  it("no resume por debajo del umbral", async () => {
    const summarize = vi.fn();
    const fetchImpl = (async () => json([turn(1, "user", "a"), turn(2, "assistant", "b")])) as unknown as typeof fetch;

    expect(await summarizeIfNeeded("hilo-1", summarize, config(fetchImpl))).toBeNull();
    expect(summarize).not.toHaveBeenCalled();
    expect(SUMMARIZE_AFTER).toBe(12);
  });

  it("al pasar el umbral resume lo viejo, guarda el resumen y borra lo resumido", async () => {
    const turns = Array.from({ length: 14 }, (_, index) =>
      turn(index + 1, index % 2 === 0 ? "user" : "assistant", `turno ${index + 1}`),
    );
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes("chat_turns?thread_id") && method === "GET") return json(turns);
      if (String(url).includes("select=summary")) return json([{ summary: "resumen anterior" }]);
      return json([]);
    }) as unknown as typeof fetch;

    const summarize = vi.fn(async () => "  resumen nuevo con lo importante  ");
    const summary = await summarizeIfNeeded("hilo-1", summarize, config(fetchImpl));

    expect(summary).toBe("resumen nuevo con lo importante");
    // 14 turnos, se conservan los 4 ultimos: el resumen cubre del 1 al 10.
    const [previous, covered] = summarize.mock.calls[0] as unknown as [string | null, ThreadTurn[]];
    expect(previous).toBe("resumen anterior");
    expect(covered).toHaveLength(10);

    const patch = calls.find((call) => call.method === "PATCH");
    expect(patch?.body).toEqual({ summary: "resumen nuevo con lo importante", summary_upto: 10 });
    const del = calls.find((call) => call.method === "DELETE");
    expect(del?.url).toContain("id=in.(1,2,3,4,5,6,7,8,9,10)");
  });

  it("si el resumen sale vacío no se borra nada: mejor guardar turnos que perderlos", async () => {
    const turns = Array.from({ length: 14 }, (_, index) => turn(index + 1, "user", `t${index}`));
    const methods: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      methods.push(method);
      if (String(url).includes("chat_turns?thread_id") && method === "GET") return json(turns);
      return json([{ summary: null }]);
    }) as unknown as typeof fetch;

    const summary = await summarizeIfNeeded("hilo-1", async () => "   ", config(fetchImpl));

    expect(summary).toBeNull();
    expect(methods).not.toContain("DELETE");
    expect(methods).not.toContain("PATCH");
  });
});

describe("clearThread y configuración", () => {
  it("/reset borra el hilo por superficie y chat", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(String(url));
      return json([]);
    }) as unknown as typeof fetch;

    expect(await clearThread({ surface: "telegram", externalId: "7" }, config(fetchImpl))).toBe(true);
    expect(urls[0]).toContain("surface=eq.telegram");
    expect(urls[0]).toContain("external_id=eq.7");
  });

  it("sin SUPABASE_URL ni SERVICE_ROLE no hay memoria (y el chat sigue)", () => {
    expect(memoryConfig()).toBeNull();
    expect(memoryConfig({ url: "https://x.supabase.co", serviceKey: "k" })).toMatchObject({
      url: "https://x.supabase.co",
      serviceKey: "k",
    });
  });
});
