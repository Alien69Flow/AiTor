/**
 * `GET ?probe=1` del webhook, con `fetch` simulado.
 *
 * Lo que se fija: que sin clave de operador no se llama al modelo (la sonda
 * gratuita sí), que con clave se prueban las dos formas de credencial, y que
 * la respuesta no lleva nunca el valor de la clave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

type ProbeAttemptView = { via: string; status?: number | null };
type ProbeView = {
  keyKind: string;
  conclusion: string;
  note: string | null;
  attempts: ProbeAttemptView[];
};
type KnowledgeSample = { question: string; expected: string | null; matched: string | null };
type KnowledgeView = { blocks: number; samples: KnowledgeSample[] };
type VoiceProbeView = { geminiKeyState: string; geminiVoice: string; note: string | null };
type ProbeBody = {
  chatProbe: ProbeView | null;
  voiceProbe?: VoiceProbeView | null;
  knowledgeProbe?: KnowledgeView | null;
  redis?: { configured: boolean };
  dedupe?: { active: boolean };
};

function mockRes() {
  let status = 0;
  let body: ProbeBody | null = null;
  let sent: string | null = null;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload as ProbeBody;
      return res;
    },
    send(payload: unknown) {
      sent = String(payload);
      return res;
    },
  };
  return { res, snap: () => ({ status, body, sent }) };
}

function response(status: number, text: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

const OPERATOR = "clave-de-operador";
const PUBLISHABLE = "sb_publishable_no_debe_salir";

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "MANUS_API_KEY",
  "OPERATOR_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
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
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  process.env.OPERATOR_KEY = OPERATOR;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

/** Carga el módulo después de fijar el entorno (lee process.env al importarse). */
async function loadHandler(): Promise<Handler> {
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

/** Telegram responde bien; el chat devuelve el estado que se le pida. */
function stubFetch(chatStatus = 401, chatBody = '{"error":"Provider authentication failed."}') {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${String(url)}`);
      if (String(url).includes("api.telegram.org")) {
        return response(200, JSON.stringify({ ok: true, result: { id: 1, username: "bot" } }));
      }
      if (String(url).includes("health=1")) {
        return response(200, JSON.stringify({ status: "ok", models: [] }));
      }
      return response(chatStatus, chatBody);
    }),
  );
  return calls;
}

const req = (url: string, headers: Record<string, string> = {}) =>
  ({ method: "GET", url, headers: { host: "localhost", ...headers } }) as never;

describe("GET /api/telegram-webhook?probe=1", () => {
  it("sin clave de operador sólo hace la comprobación gratuita", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1"), res);
    const body = snap().body!;

    expect(snap().status).toBe(200);
    expect(body.chatProbe!.attempts).toHaveLength(1);
    expect(body.chatProbe!.attempts[0].via).toBe("salud");
    expect(body.chatProbe!.note).toContain("OPERATOR_KEY");
    // Sólo GET al chat: ninguna llamada al modelo.
    expect(calls.filter((call) => call.startsWith("POST") && call.includes("functions/v1/chat"))).toHaveLength(0);
  });

  it("con clave llama al modelo por las dos formas y no filtra la credencial", async () => {
    stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1", { "x-api-key": OPERATOR }), res);
    const body = snap().body!;

    expect(body.chatProbe!.attempts.map((attempt) => attempt.via)).toEqual([
      "salud",
      "como-hoy",
      "solo-apikey",
    ]);
    // Con una publicable en el entorno y ninguna JWT, se usa la JWT del
    // repositorio: es justo el arreglo. Antes se informaba `publishable` y el
    // bot se quedaba mudo.
    expect(body.chatProbe!.keyKind).toBe("jwt");
    expect(body.chatProbe!.conclusion).toContain("rechaza la credencial");
    expect(JSON.stringify(body)).not.toContain(PUBLISHABLE);
  });

  it("si el chat contesta, la conclusión señala al webhook", async () => {
    stubFetch(200, 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1", { "x-api-key": OPERATOR }), res);

    expect(snap().body!.chatProbe!.conclusion).toContain("el fallo está en el webhook");
  });

  it("?probe=1 informa del conocimiento curado sin gastar cuota", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1"), res);
    const probe = snap().body!.knowledgeProbe!;

    expect(probe.blocks).toBeGreaterThan(0);
    // Las dos preguntas de muestra caen en su bloque: si no, `verify:prod`
    // marca la fase de conocimiento como fallo.
    expect(probe.samples.map((sample) => [sample.expected, sample.matched])).toEqual([
      ["dao", "dao"],
      ["physics", "physics"],
      // Control fuera de dominio: si recuperara un bloque, habría contexto
      // inventado y `verify:prod` lo marcaría como fallo.
      [null, null],
    ]);
    expect(calls.filter((call) => call.includes("functions/v1/chat"))).toHaveLength(1);
  });

  it("?probe=1 informa del estado de GEMINI_API_KEY para notas de voz", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1"), res);
    const probe = snap().body!.voiceProbe!;

    expect(probe.geminiKeyState).toBe("missing");
    expect(probe.geminiVoice).toBe("---");
    expect(probe.note).toContain("GEMINI_API_KEY");
    expect(probe.note).toContain("no funcionarán");
    expect(calls.filter((call) => call.includes("generativelanguage.googleapis.com"))).toHaveLength(0);
  });

  it("sin ?probe=1 no se sonda nada", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook"), res);

    expect(snap().body?.chatProbe).toBeNull();
    expect(snap().body?.voiceProbe).toBeNull();
    expect(snap().body?.knowledgeProbe).toBeNull();
    expect(calls.some((call) => call.includes("functions/v1/chat"))).toBe(false);
  });

  it("el marcador de GEMINI_API_KEY se distingue de la falta", async () => {
    process.env.GEMINI_API_KEY = "tu_clave_aqui";
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1"), res);
    const probe = snap().body!.voiceProbe!;

    expect(probe.geminiKeyState).toBe("placeholder");
    expect(probe.geminiVoice).toBe("---");
    expect(probe.note).toContain("marcador de posición");
    expect(probe.note).toContain("no funcionarán");
    expect(calls.filter((call) => call.includes("generativelanguage.googleapis.com"))).toHaveLength(0);
  });

  it("con clave real informa disponible sin filtrar el valor", async () => {
    process.env.GEMINI_API_KEY = "AIzaSoyUnaClaveRealDePrueba1234567890";
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1"), res);
    const probe = snap().body!.voiceProbe!;

    expect(probe.geminiKeyState).toBe("ok");
    expect(probe.geminiVoice).toBe("disponible");
    expect(probe.note).toBeNull();
    expect(JSON.stringify(snap().body!)).not.toContain("AIzaSoyUnaClaveRealDePrueba1234567890");
    expect(calls.filter((call) => call.includes("generativelanguage.googleapis.com"))).toHaveLength(0);
  });

  it("sin ?probe=1 el voiceProbe no aparece", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook"), res);
    expect(snap().body?.voiceProbe).toBeNull();
    expect(calls.some((call) => call.includes("functions/v1/chat"))).toBe(false);
  });

  it("sin Redis el informe dice que el dedupe no está actuando", async () => {
    stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    // Sin `?probe=1`: el estado de Redis se informa siempre, es gratis.
    await handler(req("/api/telegram-webhook"), res);
    const body = snap().body!;

    expect(snap().status).toBe(200);
    expect(body.redis).toEqual({ configured: false });
    // Sin almacén `claimUpdate` deja pasar el reintento a propósito: el dato
    // tiene que decirlo, no dejar creer que la entrega se reservó.
    expect(body.dedupe).toEqual({ active: false });
  });

  it("con las variables de Upstash informa del dedupe sin filtrar sus valores", async () => {
    const redisUrl = "https://redis-de-prueba.upstash.io";
    const redisToken = "token-de-prueba-no-debe-salir";
    process.env.KV_REST_API_URL = redisUrl;
    process.env.KV_REST_API_TOKEN = redisToken;
    stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook"), res);
    const body = snap().body!;

    expect(body.redis).toEqual({ configured: true });
    expect(body.dedupe).toEqual({ active: true });
    const json = JSON.stringify(body);
    expect(json).not.toContain(redisUrl);
    expect(json).not.toContain(redisToken);
  });
});
