/**
 * `/alerta` dentro del webhook, de punta a punta.
 *
 * La lógica de las alertas ya tenía pruebas (`api/alerts.test.ts`), y el cron
 * también (`api/cron/price-alerts.test.ts`). Lo que nunca se había ejercitado es
 * el cableado: qué contesta el bot cuando alguien escribe `/alerta`, qué se
 * guarda exactamente, qué pasa con el undécimo aviso y qué se dice cuando no hay
 * Redis.
 *
 * Se ejecuta el handler de verdad (`api/telegram-webhook.ts`) con un Redis de
 * mentira que entiende los comandos que usan `alerts.ts` y `update-dedupe.ts`
 * (`HGET`, `HSET`, `HDEL`, `EXPIRE`, `SET … NX`). Lo único simulado es Telegram.
 *
 * El campo del hash es el token opaco del hilo (`tg_` + HMAC del chat), no el
 * `chat_id`: se comprueba aquí para que un cambio de esa clave no pase callado.
 */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const CHAT = 4242;
const TOKEN = "test-token";
const ALERTS_KEY = "aitor:alerts";

interface FakeRedis {
  hash: Map<string, string>;
  claimed: Set<string>;
  commands: (string | number)[][];
}

/**
 * Redis de mentira: el hash de alertas y la reserva de `update_id`.
 * Con `configured: false` imita el despliegue sin Redis de verdad.
 */
function fakeRedis(options: { configured?: boolean; failWrites?: boolean } = {}): FakeRedis {
  const hash = new Map<string, string>();
  const claimed = new Set<string>();
  const commands: (string | number)[][] = [];

  vi.doMock("../../api/_shared/redis.js", () => ({
    isRedisConfigured: () => options.configured ?? true,
    scopedKey: (key: string) => key,
    redisCommand: async (args: (string | number)[]) => {
      commands.push(args);
      const command = String(args[0]).toUpperCase();
      if (command === "SET") {
        const key = String(args[1]);
        if (claimed.has(key)) return null;
        claimed.add(key);
        return "OK";
      }
      if (command === "HGETALL") return [...hash.entries()].flat();
      if (command === "HGET") return hash.get(String(args[2])) ?? null;
      if (command === "HSET") {
        if (options.failWrites) throw new Error("Redis HTTP 500");
        hash.set(String(args[2]), String(args[3]));
        return 1;
      }
      if (command === "HDEL") return hash.delete(String(args[2])) ? 1 : 0;
      if (command === "EXPIRE") return 1;
      return null;
    },
  }));

  return { hash, claimed, commands };
}

/** El mismo token que calcula el webhook: `tg_` + HMAC del chat. */
const threadToken = (chatId = CHAT) =>
  `tg_${createHmac("sha256", TOKEN).update(`aitor-thread:${chatId}`).digest("hex").slice(0, 32)}`;

/** Carga el handler con un entorno concreto (lee `process.env` al importarse). */
async function load(token: string = TOKEN) {
  vi.resetModules();
  process.env.TELEGRAM_BOT_TOKEN = token;
  process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-de-prueba";
  delete process.env.VERCEL_ENV;
  const module = await import("../../api/telegram-webhook");
  return module.default as unknown as (req: unknown, res: unknown) => Promise<unknown>;
}

interface Call {
  status: number;
  body: string;
}

function invoke(handler: (req: unknown, res: unknown) => Promise<unknown>, text: string, updateId = 1) {
  const body = {
    update_id: updateId,
    message: {
      message_id: 7,
      date: 1_700_000_000,
      chat: { id: CHAT, type: "private" },
      from: { id: CHAT, is_bot: false, first_name: "Tester" },
      text,
    },
  };
  return new Promise<Call>((resolve) => {
    const req = {
      method: "POST",
      body,
      headers: { "x-telegram-bot-api-secret-token": "secreto-de-prueba" },
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

/** Telegram acepta todo; `/alerta` no habla con el modelo. */
function stubTelegram() {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

interface SentMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
}

function sentMessages(fetchMock: ReturnType<typeof stubTelegram>): SentMessage[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

const storedAlerts = (redis: FakeRedis, token = threadToken()) => {
  const raw = redis.hash.get(token);
  return raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
};

const alerta = (overrides: Record<string, unknown> = {}) => ({
  chatId: CHAT,
  symbol: "BTC",
  direction: "above",
  price: 100_000,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

afterEach(() => {
  vi.doUnmock("../../api/_shared/redis.js");
  vi.unstubAllGlobals();
  delete process.env.TELEGRAM_BOT_TOKEN;
});

describe("/alerta crea el aviso", () => {
  it("guarda la alerta bajo el token del hilo y contesta con el umbral", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const handler = await load();

    const { status } = await invoke(handler, "/alerta BTC > 95000");

    expect(status).toBe(200);
    const [sent] = sentMessages(fetchMock);
    expect(sent.chat_id).toBe(CHAT);
    expect(sent.text).toContain("Aviso creado");
    expect(sent.text).toContain("BTC");
    expect(sent.text).toContain("≥");
    // El umbral va formateado en es-ES, no como el número crudo.
    expect(sent.text).toContain("95.000");

    // Se guarda en el hash de alertas, con el token del hilo como campo…
    expect([...redis.hash.keys()]).toEqual([threadToken()]);
    // …y el chat sólo dentro del valor, que es lo que necesita el cron.
    const [stored] = storedAlerts(redis);
    expect(stored).toMatchObject({
      chatId: CHAT,
      symbol: "BTC",
      direction: "above",
      price: 95_000,
    });
    expect(typeof stored.createdAt).toBe("string");

    // Un aviso temporal: el hash caduca solo.
    const expire = redis.commands.find((args) => String(args[0]).toUpperCase() === "EXPIRE");
    expect(expire?.[1]).toBe(ALERTS_KEY);
  });

  it("entiende las otras formas del comando y el < de bajada", async () => {
    const redis = fakeRedis();
    stubTelegram();
    const handler = await load();

    await invoke(handler, "/alerta eth <= 2.5k", 1);
    await invoke(handler, "/alerta@Alien69Bot SOL < 120", 2);

    const stored = storedAlerts(redis);
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ symbol: "ETH", direction: "below", price: 2_500 });
    expect(stored[1]).toMatchObject({ symbol: "SOL", direction: "below", price: 120 });
  });
});

describe("/alerta rechaza lo que no entiende", () => {
  it("sin comparador contesta el formato y no guarda nada", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const handler = await load();

    const { status } = await invoke(handler, "/alerta BTC 95000");

    expect(status).toBe(200);
    const [sent] = sentMessages(fetchMock);
    expect(sent.text).toContain("Formato:");
    expect(sent.text).toContain("/alerta BTC &gt; 95000");
    // La ayuda nombra los símbolos que sí tienen precio.
    expect(sent.text).toContain("BTC, ETH, SOL");
    expect(redis.hash.size).toBe(0);
  });

  it("un símbolo sin precio no crea una alerta que nunca dispararía", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const handler = await load();

    await invoke(handler, "/alerta DOGE > 1");

    expect(sentMessages(fetchMock)[0].text).toContain("Formato:");
    expect(redis.hash.size).toBe(0);
  });

  it("un precio que no es un número positivo tampoco", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const handler = await load();

    await invoke(handler, "/alerta BTC > 0", 1);
    await invoke(handler, "/alerta BTC > gratis", 2);

    const sent = sentMessages(fetchMock);
    expect(sent).toHaveLength(2);
    expect(sent.every((message) => message.text.includes("Formato:"))).toBe(true);
    expect(redis.hash.size).toBe(0);
  });
});

describe("/alerta respeta el tope", () => {
  it("con 9 avisos, el décimo entra y se guarda", async () => {
    const redis = fakeRedis();
    stubTelegram();
    redis.hash.set(threadToken(), JSON.stringify(Array.from({ length: 9 }, () => alerta())));
    const handler = await load();

    await invoke(handler, "/alerta BTC > 200000");

    expect(storedAlerts(redis)).toHaveLength(10);
  });

  it("con 10 avisos no crea el undécimo y lo dice", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const before = JSON.stringify(Array.from({ length: 10 }, () => alerta()));
    redis.hash.set(threadToken(), before);
    const handler = await load();

    const { status } = await invoke(handler, "/alerta BTC > 200000");

    expect(status).toBe(200);
    const [sent] = sentMessages(fetchMock);
    expect(sent.text).toContain("Ya tienes 10 avisos");
    expect(sent.text).toContain("máximo");
    // Lo guardado no cambia: ni se añade ni se reescribe.
    expect(redis.hash.get(threadToken())).toBe(before);
  });
});

describe("/alerta lista y borra", () => {
  it("numera los avisos guardados, con su nombre corto", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    redis.hash.set(
      threadToken(),
      JSON.stringify([alerta(), alerta({ symbol: "ETH", price: 2_500 })]),
    );
    const handler = await load();

    const { status } = await invoke(handler, "/alerta lista");

    expect(status).toBe(200);
    const [sent] = sentMessages(fetchMock);
    expect(sent.text).toContain("2 de 10");
    expect(sent.text).toContain("1. BTC ≥ $100.000");
    expect(sent.text).toContain("2. ETH ≥ $2500");
    expect(sent.text).toContain("/alerta borra 2");
    // Listar no reescribe el hash.
    expect(redis.commands.some((args) => ["HSET", "HDEL"].includes(String(args[0]).toUpperCase()))).toBe(false);
  });

  it("sin avisos lo dice y no crea una entrada vacía", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const handler = await load();

    await invoke(handler, "/alerta lista");

    expect(sentMessages(fetchMock)[0].text).toContain("No tienes avisos");
    expect(redis.hash.size).toBe(0);
  });

  it("borra el número pedido y deja el resto en el hash", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    redis.hash.set(
      threadToken(),
      JSON.stringify([alerta({ price: 100 }), alerta({ price: 200 }), alerta({ price: 300 })]),
    );
    const handler = await load();

    await invoke(handler, "/alerta borra 2");

    expect(sentMessages(fetchMock)[0].text).toBe("✅ Aviso cancelado: BTC ≥ $200.");
    const stored = storedAlerts(redis);
    expect(stored.map((item) => item.price)).toEqual([100, 300]);
  });

  it("al borrar el último, la entrada del hash desaparece", async () => {
    const redis = fakeRedis();
    stubTelegram();
    redis.hash.set(threadToken(), JSON.stringify([alerta()]));
    const handler = await load();

    await invoke(handler, "/alerta borra 1");

    expect(redis.hash.has(threadToken())).toBe(false);
    expect(redis.hash.size).toBe(0);
  });

  it("un número fuera de rango no toca lo guardado y dice el rango", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const before = JSON.stringify([alerta({ price: 100 }), alerta({ price: 200 })]);
    redis.hash.set(threadToken(), before);
    const handler = await load();

    await invoke(handler, "/alerta borra 9");

    expect(sentMessages(fetchMock)[0].text).toContain("entre 1 y 2");
    expect(redis.hash.get(threadToken())).toBe(before);
  });

  it("sin número pide cuál cancelar en vez del formato de creación", async () => {
    const redis = fakeRedis();
    const fetchMock = stubTelegram();
    const before = JSON.stringify([alerta(), alerta({ price: 200 })]);
    redis.hash.set(threadToken(), before);
    const handler = await load();

    await invoke(handler, "/alerta borra");

    const [sent] = sentMessages(fetchMock);
    expect(sent.text).toContain("Dime qué aviso cancelar");
    expect(sent.text).not.toContain("Formato:");
    expect(redis.hash.get(threadToken())).toBe(before);
  });

  it("sin Redis lo dice en vez de fingir la lista", async () => {
    fakeRedis({ configured: false });
    const fetchMock = stubTelegram();
    const handler = await load();

    await invoke(handler, "/alerta lista");

    expect(sentMessages(fetchMock)[0].text).toContain("falta Redis");
  });
});

describe("/alerta sin almacén", () => {
  it("sin Redis lo dice en vez de fingir que la creó", async () => {
    const redis = fakeRedis({ configured: false });
    const fetchMock = stubTelegram();
    const handler = await load();

    const { status } = await invoke(handler, "/alerta BTC > 95000");

    expect(status).toBe(200);
    const [sent] = sentMessages(fetchMock);
    expect(sent.text).toContain("falta Redis");
    expect(sent.text).toContain("KV_REST_API_URL");
    expect(redis.hash.size).toBe(0);
  });

  it("si Redis falla al escribir, tampoco afirma que la creó", async () => {
    fakeRedis({ failWrites: true });
    const fetchMock = stubTelegram();
    const handler = await load();

    await invoke(handler, "/alerta BTC > 95000");

    expect(sentMessages(fetchMock)[0].text).toContain("No puedo guardar alertas");
  });
});
