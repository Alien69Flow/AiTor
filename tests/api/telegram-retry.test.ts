/**
 * Reintentos de Telegram, de punta a punta.
 *
 * Telegram vuelve a entregar la misma actualización cuando el webhook tarda
 * (el turno del modelo tarda entre 6 y 22 s). Antes, cada reintento se procesaba
 * otra vez: el usuario recibía la respuesta dos veces y, con la memoria del
 * hilo, el turno quedaba guardado dos veces.
 *
 * Aquí no se prueba `claimUpdate` en aislado —eso está en
 * `api/update-dedupe.test.ts`— sino el contrato del handler completo con un
 * Redis de mentira que respeta la semántica de `SET … NX`: mismo `update_id`
 * dos veces → un solo mensaje; `update_id` nuevo → se contesta.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const SSE = [
  'data: {"choices":[{"delta":{"content":"hola desde el núcleo"}}]}',
  "",
  "data: [DONE]",
  "",
].join("\n");

interface Call {
  status: number;
  body: string;
}

/** Carga el handler con un entorno concreto (lee process.env al importarse). */
async function load() {
  vi.resetModules();
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.VERCEL_ENV;
  const module = await import("../../api/telegram-webhook");
  return module.default as unknown as (req: unknown, res: unknown) => Promise<unknown>;
}

function invoke(handler: (req: unknown, res: unknown) => Promise<unknown>, body: unknown) {
  return new Promise<Call>((resolve) => {
    const req = {
      method: "POST",
      body,
      headers: {},
      socket: { remoteAddress: "198.51.100.4" },
    };
    const res = {
      statusCode: 0,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send(payload: string) {
        resolve({ status: this.statusCode, body: payload });
      },
      json(payload: unknown) {
        resolve({ status: this.statusCode, body: JSON.stringify(payload) });
      },
      end() {
        resolve({ status: this.statusCode, body: "" });
      },
    };
    void handler(req, res);
  });
}

const TELEGRAM_OK = (result: unknown) =>
  new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/** Telegram contesta ok a sendMessage; la función de chat devuelve un SSE. */
function stubNetwork() {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/sendMessage")) return TELEGRAM_OK(true);
    if (String(url).includes("/sendChatAction")) return TELEGRAM_OK(true);
    return new Response(SSE, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const update = (text: string, updateId = 1) => ({
  update_id: updateId,
  message: {
    message_id: 7,
    date: 1_700_000_000,
    chat: { id: 4242, type: "private" },
    from: { id: 4242, is_bot: false, first_name: "Tester" },
    text,
  },
});

/**
 * Redis de mentira con la misma semántica que `SET key 1 NX EX n`: la primera
 * reserva gana; mientras la clave exista, la segunda devuelve nil.
 */
function fakeRedis(): Set<string> {
  const claimed = new Set<string>();
  vi.doMock("../../api/_shared/redis.js", () => ({
    isRedisConfigured: () => true,
    scopedKey: (key: string) => key,
    redisCommand: async (args: (string | number)[]) => {
      const key = String(args[1] ?? "");
      if (claimed.has(key)) return null;
      claimed.add(key);
      return "OK";
    },
  }));
  return claimed;
}

const sentMessages = (fetchMock: ReturnType<typeof stubNetwork>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("/sendMessage"));

afterEach(() => {
  vi.doUnmock("../../api/_shared/redis.js");
  vi.unstubAllGlobals();
});

describe("reintentos de Telegram", () => {
  it("el mismo update_id no produce una segunda respuesta ni ensucia el hilo", async () => {
    const claimed = fakeRedis();
    const fetchMock = stubNetwork();
    const handler = await load();

    const first = await invoke(handler, update("hola"));
    const retry = await invoke(handler, update("hola"));

    expect(first.status).toBe(200);
    // El reintento se acepta con 200 para que Telegram deje de insistir…
    expect(retry.status).toBe(200);
    // …pero no se vuelve a contestar ni se guarda un segundo turno.
    expect(sentMessages(fetchMock)).toHaveLength(1);
    expect(claimed.size).toBe(1);
    // La clave reservada es la del update, no una global.
    expect([...claimed][0]).toContain("aitor:tg:update:1");
  });

  it("un update_id nuevo sí se procesa", async () => {
    fakeRedis();
    const fetchMock = stubNetwork();
    const handler = await load();

    await invoke(handler, update("hola", 1));
    await invoke(handler, update("otra cosa", 2));

    expect(sentMessages(fetchMock)).toHaveLength(2);
  });

  it("sin Redis se procesa igual: mejor respuesta doble que silencio", async () => {
    const fetchMock = stubNetwork();
    const handler = await load();

    await invoke(handler, update("hola"));
    await invoke(handler, update("hola"));

    expect(sentMessages(fetchMock)).toHaveLength(2);
  });
});
