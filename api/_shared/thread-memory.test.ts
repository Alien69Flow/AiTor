/**
 * La memoria por capas, sin Redis ni red.
 *
 * Fija lo que no se ve leyendo el módulo: que el hilo es un solo hash bajo el
 * token `tg_…`, que el título se saca del primer mensaje sin gastar modelo, que
 * lo que sale de la ventana cae al resumen, que el TTL se renueva en cada turno
 * y que, sin Upstash, no se hace ni una petición.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Hash {
  [field: string]: string;
}

const fake = vi.hoisted(() => {
  const hashes = new Map<string, Hash>();
  const ttls = new Map<string, number>();
  const state = { configured: true, fail: false, commands: 0 };

  const apply = (command: (string | number)[]): unknown => {
    state.commands += 1;
    if (state.fail) throw new Error("Redis HTTP 500");
    const name = String(command[0]).toUpperCase();
    const key = String(command[1]);
    if (name === "HGETALL") return { ...(hashes.get(key) ?? {}) };
    if (name === "HSET") {
      const hash = hashes.get(key) ?? {};
      const pairs = command.slice(2);
      for (let index = 0; index < pairs.length; index += 2) {
        hash[String(pairs[index])] = String(pairs[index + 1]);
      }
      hashes.set(key, hash);
      return pairs.length / 2;
    }
    if (name === "EXPIRE") {
      ttls.set(key, Number(command[2]));
      return 1;
    }
    return null;
  };

  return { hashes, ttls, state, apply };
});

vi.mock("./redis.js", () => ({
  isRedisConfigured: () => fake.state.configured,
  scopedKey: (key: string) => `prod:${key}`,
  redisCommand: async (args: (string | number)[]) => fake.apply(args),
  redisPipeline: async (commands: (string | number)[][]) => commands.map((command) => fake.apply(command)),
}));

import {
  deriveTitle,
  historyMessages,
  isStale,
  loadThread,
  memoryConfigured,
  normalizeThreadRef,
  rollUpSummary,
  saveSummary,
  saveTurn,
  STALE_HOURS,
  SUMMARY_MAX_CHARS,
  THREAD_TTL_SECONDS,
  threadMemoryKey,
  TITLE_MAX_CHARS,
  WINDOW_MESSAGES,
} from "./thread-memory";

const TOKEN = `tg_${"a1b2c3d4".repeat(4)}`;
const ref = { surface: "telegram" as const, externalId: TOKEN };
const KEY = `prod:aitor:thread:${TOKEN}`;

beforeEach(() => {
  fake.hashes.clear();
  fake.ttls.clear();
  fake.state.configured = true;
  fake.state.fail = false;
  fake.state.commands = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("normalizeThreadRef", () => {
  it("acepta el token de su superficie y rechaza los cruces", () => {
    expect(normalizeThreadRef(ref)).toEqual(ref);
    expect(normalizeThreadRef({ surface: "web", externalId: TOKEN })).toBeNull();
    expect(normalizeThreadRef({ surface: "telegram", externalId: "tg_abc" })).toBeNull();
    expect(normalizeThreadRef({ surface: "telegram", externalId: `tg_${"z".repeat(32)}` })).toBeNull();
    expect(normalizeThreadRef(null)).toBeNull();
  });

  it("la clave de Redis lleva el token opaco y nunca el chat_id", () => {
    expect(threadMemoryKey(ref)).toBe(KEY);
  });
});

describe("capa 0: título", () => {
  it("sale del primer mensaje, sin modelo", () => {
    expect(deriveTitle("  ¿Cómo   va lo de BTC?  ")).toBe("¿Cómo va lo de BTC?");
    expect(deriveTitle("/start")).toBe("start");
    expect(deriveTitle("   ")).toBeNull();
  });

  it("se corta por palabra y avisa con puntos suspensivos", () => {
    const titulo = deriveTitle(`${"palabra ".repeat(30)}fin`);
    expect(titulo!.length).toBeLessThanOrEqual(TITLE_MAX_CHARS + 1);
    expect(titulo!.endsWith("…")).toBe(true);
    // Corta entre palabras: lo que queda antes de los puntos es una palabra entera.
    expect(titulo!.slice(0, -1).trimEnd().endsWith("palabra")).toBe(true);
  });
});

describe("capa 1: resumen", () => {
  it("conserva el resumen anterior delante de lo nuevo", () => {
    const resumen = rollUpSummary("hablamos de ETH", [
      { role: "user", content: "y de SOL" },
      { role: "assistant", content: "SOL va por 180" },
    ]);
    expect(resumen).toContain("hablamos de ETH");
    expect(resumen).toContain("USUARIO: y de SOL");
    expect(resumen).toContain("AI TOR: SOL va por 180");
  });

  it("no inventa resumen si no había nada ni entra nada", () => {
    expect(rollUpSummary(null, [])).toBeNull();
  });

  it("se queda con lo más reciente cuando no cabe", () => {
    const resumen = rollUpSummary("viejo ".repeat(200), [{ role: "assistant", content: "lo último" }]);
    expect(resumen!.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS);
    expect(resumen!.endsWith("lo último")).toBe(true);
    expect(resumen!.startsWith("…")).toBe(true);
  });
});

describe("isStale y composición del prompt", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("un hilo de hace siete horas está viejo; uno de hace una no", () => {
    expect(isStale("2026-11-20T05:00:00Z", now)).toBe(true);
    expect(isStale("2026-11-20T11:00:00Z", now)).toBe(false);
    expect(isStale(null, now)).toBe(false);
    expect(STALE_HOURS).toBe(6);
  });

  it("compone título, resumen y evidencia en ese orden", () => {
    const messages = historyMessages(
      {
        title: "precio de BTC",
        summary: "el usuario sigue BTC",
        lastActiveAt: "2026-11-20T11:59:00Z",
        turns: [{ role: "user", content: "¿y ahora?" }],
      },
      now,
    );

    expect(messages[0].content).toContain("Título del hilo: precio de BTC");
    expect(messages[0].content).toContain("Resumen de lo hablado antes: el usuario sigue BTC");
    expect(messages.at(-1)).toEqual({ role: "user", content: "¿y ahora?" });
  });

  it("un hilo viejo conserva la memoria pero no la evidencia", () => {
    const messages = historyMessages(
      {
        title: "precio de BTC",
        summary: "el usuario sigue BTC",
        lastActiveAt: "2026-11-20T05:00:00Z",
        turns: [{ role: "user", content: "de la semana pasada" }],
      },
      now,
    );
    expect(messages.some((message) => message.content === "de la semana pasada")).toBe(false);
    expect(messages[0].content).toContain("el usuario sigue BTC");
  });

  it("sin hilo no hay contexto", () => {
    expect(historyMessages(null, now)).toEqual([]);
  });
});

describe("escritura y lectura del hilo", () => {
  it("el primer turno crea el hash, pone título y renueva el TTL", async () => {
    expect(await saveTurn(ref, "hola, me llamo Ana", "encantado, Ana")).toBe(true);

    expect(fake.hashes.get(KEY)?.title).toBe("hola, me llamo Ana");
    expect(fake.ttls.get(KEY)).toBe(THREAD_TTL_SECONDS);
    expect(JSON.parse(fake.hashes.get(KEY)!.evidence)).toEqual([
      { role: "user", content: "hola, me llamo Ana" },
      { role: "assistant", content: "encantado, Ana" },
    ]);
  });

  it("el título no cambia con los turnos siguientes", async () => {
    await saveTurn(ref, "hola, me llamo Ana", "encantado");
    await saveTurn(ref, "¿qué hora es?", "las 12");
    expect(fake.hashes.get(KEY)?.title).toBe("hola, me llamo Ana");
  });

  it("loadThread devuelve las tres capas", async () => {
    await saveTurn(ref, "hablamos de BTC", "vamos allá");
    const thread = await loadThread(ref);

    expect(thread?.title).toBe("hablamos de BTC");
    expect(thread?.summary).toBeNull();
    expect(thread?.turns).toHaveLength(2);
    expect(thread?.lastActiveAt).toBeTruthy();
  });

  it("lo que sale de la ventana cae al resumen y no se pierde", async () => {
    for (let turno = 0; turno < 6; turno += 1) {
      await saveTurn(ref, `pregunta ${turno}`, `respuesta ${turno}`);
    }
    const thread = await loadThread(ref);

    expect(thread!.turns).toHaveLength(WINDOW_MESSAGES);
    expect(thread!.turns.at(-1)).toEqual({ role: "assistant", content: "respuesta 5" });
    expect(thread!.summary).toContain("pregunta 0");
    expect(thread!.summary).toContain("respuesta 1");
  });

  it("un hilo vacío se lee como tres capas vacías, no como error", async () => {
    const thread = await loadThread(ref);
    expect(thread).toEqual({ title: null, summary: null, turns: [], lastActiveAt: null });
  });

  it("saveSummary reescribe la capa 1 sin tocar la evidencia", async () => {
    await saveTurn(ref, "hablamos de BTC", "vamos allá");
    expect(await saveSummary(ref, "  el usuario  sigue BTC  ")).toBe(true);

    const thread = await loadThread(ref);
    expect(thread?.summary).toBe("el usuario sigue BTC");
    expect(thread?.turns).toHaveLength(2);
  });
});

describe("degradación sin Upstash", () => {
  it("sin Redis configurado no se hace ni una petición", async () => {
    fake.state.configured = false;
    expect(memoryConfigured()).toBe(false);
    expect(await loadThread(ref)).toBeNull();
    expect(await saveTurn(ref, "hola", "buenas")).toBe(false);
    expect(await saveSummary(ref, "resumen")).toBe(false);
    expect(fake.state.commands).toBe(0);
  });

  it("un error de Redis no lanza: se pierde memoria, no el mensaje", async () => {
    fake.state.fail = true;
    expect(await loadThread(ref)).toBeNull();
    expect(await saveTurn(ref, "hola", "buenas")).toBe(false);
  });
});
