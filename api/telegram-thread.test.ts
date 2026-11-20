/**
 * El hilo, de punta a punta.
 *
 * Cuatro cosas se comprueban aquí y no en un test unitario del helper:
 *  1. Con qué clave se llama al chat (la JWT, nunca la publicable).
 *  2. Que la memoria del hilo va delante del mensaje nuevo en el prompt.
 *  3. Que el turno se guarda sólo cuando la respuesta salió bien.
 *  4. Que el hilo se guarda en Redis bajo el token opaco `tg_…`, sin tocar
 *     Postgres ni pedir ninguna migración.
 *
 * El `fetch` simulado sólo atiende Telegram y la función `chat`: si el webhook
 * intentara leer PostgREST, esas llamadas aparecerían como una URL inesperada.
 * Redis es un objeto en memoria con la semántica de comandos que usa el módulo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

const JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma-de-prueba-suficientemente-larga";
const PUBLISHABLE = "sb_publishable_abc123";

interface FakeRedis {
  hashes: Map<string, Record<string, string>>;
  expires: Array<{ key: string; seconds: number }>;
  reads: string[];
  writes: Array<{ key: string; fields: Record<string, string> }>;
  configured: boolean;
  fail: boolean;
}

const fake = vi.hoisted(() => {
  const state: FakeRedis = {
    hashes: new Map(),
    expires: [],
    reads: [],
    writes: [],
    configured: true,
    fail: false,
  };

  const apply = (command: (string | number)[]): unknown => {
    if (state.fail) throw new Error("Redis caído");
    const name = String(command[0]).toUpperCase();
    const key = String(command[1]);

    if (name === "HGETALL") {
      state.reads.push(key);
      return { ...(state.hashes.get(key) ?? {}) };
    }
    if (name === "HSET") {
      const fields: Record<string, string> = {};
      const pairs = command.slice(2);
      for (let index = 0; index < pairs.length; index += 2) {
        fields[String(pairs[index])] = String(pairs[index + 1]);
      }
      state.hashes.set(key, { ...(state.hashes.get(key) ?? {}), ...fields });
      state.writes.push({ key, fields });
      return Object.keys(fields).length;
    }
    if (name === "EXPIRE") {
      state.expires.push({ key, seconds: Number(command[2]) });
      return 1;
    }
    return null;
  };

  return { state, apply };
});

vi.mock("./_shared/redis.js", () => ({
  isRedisConfigured: () => fake.state.configured,
  scopedKey: (key: string) => key,
  redisCommand: async (args: (string | number)[]) => fake.apply(args),
  redisPipeline: async (commands: (string | number)[][]) => commands.map((command) => fake.apply(command)),
}));

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "MANUS_API_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPERATOR_KEY",
  "VERCEL_ENV",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio";
  process.env.VITE_SUPABASE_ANON_KEY = JWT;
  // La que rompía el bot: presente, y no debe usarse.
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-de-prueba";
  fake.state.hashes.clear();
  fake.state.expires.length = 0;
  fake.state.reads.length = 0;
  fake.state.writes.length = 0;
  fake.state.configured = true;
  fake.state.fail = false;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

function mockRes() {
  const res = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json() {
      return res;
    },
    send() {
      return res;
    },
  };
  return res;
}

const reply = (status: number, text: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  text: async () => text,
  json: async () => JSON.parse(text),
});

const OK_STREAM = 'data: {"choices":[{"delta":{"content":"El mercado sube."}}]}\n\ndata: [DONE]\n\n';

interface Captured {
  chat?: { headers: Record<string, string>; body: Record<string, unknown> };
  /** Todo lo que no sea Telegram ni la función `chat`. */
  unexpected: string[];
}

/** Telegram acepta todo; el chat responde lo que pida el caso. */
function stubFetch(chat: () => unknown): Captured {
  const captured: Captured = { unexpected: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
      const target = String(url);

      if (target.includes("/functions/v1/chat")) {
        captured.chat = {
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        };
        return chat();
      }

      if (target.includes("sendMessage") || target.includes("sendChatAction")) {
        return reply(200, '{"ok":true}');
      }
      if (target.includes("api.telegram.org")) return reply(200, '{"ok":true,"result":{}}');

      captured.unexpected.push(target);
      return reply(200, '{"ok":true,"result":{}}');
    }),
  );
  return captured;
}

function update(text = "y el mercado?") {
  return { message: { chat: { id: 7 }, text } };
}

async function run(body: unknown = update()): Promise<void> {
  const handler = (await import("./telegram-webhook")).default as unknown as Handler;
  await handler(
    {
      method: "POST",
      body,
      headers: { host: "localhost", "x-telegram-bot-api-secret-token": "secreto-de-prueba" },
      socket: { remoteAddress: "203.0.113.9" },
    },
    mockRes(),
  );
}

describe("hilo de Telegram", () => {
  it("llama al chat con la JWT, no con la clave publicable", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    expect(captured.chat?.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(captured.chat?.headers.apikey).toBe(JWT);
    // La service key ya no la usa la memoria: no debe viajar a ningún sitio.
    expect(JSON.stringify(captured.chat?.headers)).not.toContain("clave-de-servicio");
  });

  it("manda un hilo opaco de 128 bits, sin el chat_id", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    const thread = captured.chat?.body.thread as { surface: string; externalId: string };
    expect(thread.surface).toBe("telegram");
    expect(thread.externalId).toMatch(/^tg_[0-9a-f]{32}$/);
    // El chat_id 7 no aparece como valor suelto en lo que se envía al chat.
    expect(JSON.stringify(captured.chat?.body)).not.toContain('"7"');
  });

  it("lee el hilo de Redis bajo el token opaco, no de PostgREST", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    expect(fake.state.reads[0]).toMatch(/^aitor:thread:tg_[0-9a-f]{32}$/);
    expect(captured.unexpected).toEqual([]);
  });

  it("guarda el turno en Redis y lo devuelve como memoria en el siguiente", async () => {
    stubFetch(() => reply(200, OK_STREAM));
    await run(update("me llamo Ana"));

    const clave = fake.state.writes[0]?.key;
    expect(clave).toMatch(/^aitor:thread:tg_[0-9a-f]{32}$/);
    const guardado = fake.state.hashes.get(clave!)!;
    expect(guardado.title).toBe("me llamo Ana");
    expect(JSON.parse(guardado.evidence)).toEqual([
      { role: "user", content: "me llamo Ana" },
      { role: "assistant", content: "El mercado sube." },
    ]);
    expect(fake.state.expires.at(-1)?.seconds).toBeGreaterThan(0);

    // Segundo mensaje: la memoria del hilo va delante del mensaje nuevo.
    const segundo = stubFetch(() => reply(200, OK_STREAM));
    await run(update("y el mercado?"));

    const messages = segundo.chat?.body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain("Título del hilo: me llamo Ana");
    expect(messages.some((message) => message.content === "me llamo Ana")).toBe(true);
    expect(messages.at(-1)).toEqual({ role: "user", content: "y el mercado?" });
  });

  it("no guarda nada si el chat falla", async () => {
    stubFetch(() => reply(401, '{"message":"Invalid API key"}'));
    await run();

    expect(fake.state.writes).toHaveLength(0);
  });

  it("sin Redis la memoria está apagada y el chat sigue", async () => {
    fake.state.configured = false;
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    expect(fake.state.reads).toHaveLength(0);
    expect(fake.state.writes).toHaveLength(0);
    expect((captured.chat?.body.messages as unknown[]).length).toBe(1);
  });

  it("si Redis falla, el chat sigue funcionando sin historial", async () => {
    fake.state.fail = true;
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    expect((captured.chat?.body.messages as unknown[]).length).toBe(1);
  });
});
