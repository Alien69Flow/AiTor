/**
 * Sin `TELEGRAM_WEBHOOK_SECRET` el webhook está abierto, y es a propósito.
 *
 * El 401 por actualización sin firma sólo tiene sentido cuando hay un secreto
 * con el que comparar. Si la variable no llegó al despliegue, la alternativa
 * elegida es aceptar la actualización con una cuota por IP y dejarlo dicho en
 * los logs: se prefirió un bot abierto a un bot mudo sin avisar a nadie.
 *
 * Esta suite fija ese contrato —200 dentro de la cuota, 429 al agotarla y
 * ningún 401 en todo el recorrido— para que nadie lo cierre «por seguridad»
 * y devuelva al bot al silencio. Lo que se prueba es la puerta, no el envío:
 * `telegram-webhook.failure.test.ts` cubre la conversación.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

function mockRes() {
  let status = 0;
  let sent: string | null = null;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    json() {
      return res;
    },
    send(payload: unknown) {
      sent = String(payload);
      return res;
    },
  };
  return { res, snap: () => ({ status, sent }) };
}

/** Telegram dice que sí a todo: aquí interesa la puerta, no lo que se envía. */
function stubTelegram() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => '{"ok":true,"result":{"id":1,"username":"bot","url":""}}',
      json: async () => ({ ok: true, result: { id: 1, username: "bot", url: "" } }),
    })),
  );
}

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "MANUS_API_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "OPERATOR_KEY",
  "VERCEL_ENV",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  // Token sí, secreto no: es exactamente el despliegue que dejó al bot mudo.
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

/** El módulo se carga después de fijar el entorno: lee `process.env` al importarse. */
async function loadHandler(): Promise<Handler> {
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

const IP = "203.0.113.10";

/**
 * Un sticker: llega `message` pero sin `text`, así que el handler reconoce la
 * actualización sin llamar al modelo. La puerta ya se ha cruzado (o no) cuando
 * se decide eso, que es justo lo que este fichero mide.
 */
const update = {
  update_id: 1,
  message: { message_id: 1, chat: { id: 7 }, sticker: { file_id: "AgAD-de-prueba" } },
};

const post = (headers: Record<string, string> = {}, ip = IP) =>
  ({
    method: "POST",
    body: update,
    headers: { host: "localhost", "x-forwarded-for": ip, ...headers },
    socket: { remoteAddress: ip },
  }) as never;

describe("sin TELEGRAM_WEBHOOK_SECRET el webhook acepta actualizaciones sin firma", () => {
  it("contesta 200 y lo deja dicho en el log, en vez de 401", async () => {
    stubTelegram();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(post(), res);

    expect(snap().status).toBe(200);
    expect(snap().sent).toBe("OK");
    // El fail open no es silencioso: si se acepta sin firma, se avisa.
    const logged = warn.mock.calls.map((call) => call.join(" ")).join(" ");
    expect(logged).toContain("TELEGRAM_WEBHOOK_SECRET");
  });

  it("una cabecera de firma inventada no se convierte en 401", async () => {
    stubTelegram();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(post({ "x-telegram-bot-api-secret-token": "firma-que-nadie-compara" }), res);

    // No hay secreto con el que comparar: la cabecera no puede ser «incorrecta».
    expect(snap().status).toBe(200);
  });

  it("la cuota por IP corta con 429 y nunca con 401", async () => {
    stubTelegram();
    const handler = await loadHandler();
    const flood = "198.51.100.7";
    const statuses: number[] = [];

    for (let i = 0; i < 30; i += 1) {
      const { res, snap } = mockRes();
      await handler(post({}, flood), res);
      statuses.push(snap().status);
    }

    expect(statuses).toHaveLength(30);
    expect(statuses.every((status) => status === 200)).toBe(true);

    const over = mockRes();
    await handler(post({}, flood), over.res);

    expect(over.snap().status).toBe(429);
    // El punto de la suite: en todo el recorrido no aparece ni un 401.
    expect([...statuses, over.snap().status]).not.toContain(401);
  });

  it("agotar la cuota de una IP no castiga a otra", async () => {
    stubTelegram();
    const handler = await loadHandler();
    const flood = "198.51.100.8";

    for (let i = 0; i < 30; i += 1) {
      await handler(post({}, flood), mockRes().res);
    }

    const other = mockRes();
    await handler(post({}, "198.51.100.9"), other.res);

    expect(other.snap().status).toBe(200);
  });
});
