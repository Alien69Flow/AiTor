import { describe, expect, it } from "vitest";
import {
  interpretCron,
  interpretHealth,
  interpretKnowledge,
  interpretMemory,
  interpretSenal,
  interpretWebhook,
  renderTable,
  summarize,
} from "./verify-production.mjs";

/**
 * La sonda de producción decide si una fase del ROADMAP se puede dar por hecha.
 * Si traduce mal una respuesta, el ROADMAP miente otra vez. Aquí se fijan las
 * traducciones sin red: verde, aviso, fallo y "no se pudo comprobar".
 */

describe("webhook", () => {
  const sano = {
    ok: true,
    registration: "ya-registrado",
    secretConfigured: true,
    bot: { username: "Alien69Bot" },
    webhook: { matchesExpected: true, pendingUpdates: 0, lastErrorMessage: null },
  };

  it("registrado, al día y con firma es verde", () => {
    expect(interpretWebhook(200, sano)).toEqual({
      status: "ok",
      detail: "@Alien69Bot · ya-registrado · firma activa",
    });
  });

  it("sin firma funciona pero avisa: es la Fase 8", () => {
    const result = interpretWebhook(200, { ...sano, secretConfigured: false });
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("TELEGRAM_WEBHOOK_SECRET");
  });

  it("una URL distinta o entregas pendientes son fallo", () => {
    expect(
      interpretWebhook(200, { ...sano, webhook: { ...sano.webhook, matchesExpected: false } }).status,
    ).toBe("fail");
    expect(
      interpretWebhook(200, { ...sano, webhook: { ...sano.webhook, pendingUpdates: 4 } }).status,
    ).toBe("fail");
  });

  it("un 500 no se confunde con verde", () => {
    expect(interpretWebhook(500, null).status).toBe("fail");
  });
});

describe("salud", () => {
  it("UNCONFIGURED es un aviso, no un fallo del endpoint", () => {
    const result = interpretHealth(200, {
      status: "UNCONFIGURED",
      upstreams: [{ key: "telegram", status: "OK" }],
    });
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("Redis");
  });

  it("un upstream caído se ve en el detalle", () => {
    const result = interpretHealth(200, {
      status: "HEALTHY",
      upstreams: [{ key: "chat", status: "DOWN" }],
    });
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("chat");
  });

  it("sin veredicto es fallo", () => {
    expect(interpretHealth(503, null).status).toBe("fail");
    expect(interpretHealth(200, { hola: 1 }).status).toBe("fail");
  });
});

describe("cron", () => {
  it("sin secreto, 401 es la única respuesta correcta", () => {
    expect(interpretCron(401, { error: "Unauthorized" })).toEqual({
      status: "ok",
      detail: "protegido: 401 sin Authorization",
    });
    expect(interpretCron(200, { ok: true }).status).toBe("fail");
    expect(interpretCron(500, null).status).toBe("fail");
  });

  it("con secreto, sin Redis no puede disparar nada", () => {
    const result = interpretCron(200, { ok: true, checked: 0, reason: "sin-redis" }, { withSecret: true });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("Redis");
  });

  it("con secreto y fuentes caídas, aviso con el recuento", () => {
    const result = interpretCron(
      200,
      { ok: true, checked: 3, fired: 0, delivered: 0, failures: ["sin-sismos"] },
      { withSecret: true },
    );
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("3 avisos");
    expect(result.detail).toContain("sin-sismos");
  });

  it("una ejecución limpia es verde", () => {
    const result = interpretCron(
      200,
      { ok: true, checked: 2, fired: 1, delivered: 1 },
      { withSecret: true },
    );
    expect(result).toEqual({ status: "ok", detail: "2 avisos · 1 disparados · 1 entregados" });
  });
});

describe("memoria", () => {
  it("sin Redis configurado no se inventa un verde: queda sin verificar", () => {
    const result = interpretMemory({ configured: false, statuses: [] });
    expect(result.status).toBe("skip");
    expect(result.detail).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("un comando que falla (500) es fallo con el nombre del paso", () => {
    const result = interpretMemory({
      configured: true,
      statuses: [{ name: "guardar capas", status: 500 }],
    });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("guardar capas");
  });

  it("guardar sin poder leer de vuelta no es memoria", () => {
    const result = interpretMemory({
      configured: true,
      statuses: [],
      saved: true,
      readBack: false,
      cleaned: true,
    });
    expect(result.status).toBe("fail");
  });

  it("ida y vuelta de las tres capas, borrada, es verde", () => {
    const result = interpretMemory({
      configured: true,
      statuses: [],
      saved: true,
      readBack: true,
      cleaned: true,
    });
    expect(result).toEqual({
      status: "ok",
      detail: "título, resumen y evidencia de ida y vuelta, y borrada",
    });
  });

  it("un borrado que no borra no se da por bueno", () => {
    const result = interpretMemory({
      configured: true,
      statuses: [],
      saved: true,
      readBack: true,
      cleaned: false,
    });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("aitor:thread");
  });
});

describe("conocimiento", () => {
  const sano = {
    knowledgeProbe: {
      blocks: 2,
      samples: [
        { question: "dao", expected: "dao", matched: "dao" },
        { question: "fisica", expected: "physics", matched: "physics" },
        { question: "bitcoin", expected: null, matched: null },
      ],
    },
  };

  it("un despliegue que no expone la sonda queda sin verificar, no en verde", () => {
    expect(interpretKnowledge({ chatProbe: null }).status).toBe("skip");
    expect(interpretKnowledge(null).status).toBe("skip");
  });

  it("sin bloques es fallo: el bot no lleva conocimiento", () => {
    const result = interpretKnowledge({ knowledgeProbe: { blocks: 0, samples: [] } });
    expect(result.status).toBe("fail");
  });

  it("una pregunta que recupera otro bloque es fallo con el par esperado/real", () => {
    const result = interpretKnowledge({
      knowledgeProbe: {
        blocks: 2,
        samples: [
          { question: "dao", expected: "dao", matched: "dao" },
          { question: "fisica", expected: "physics", matched: "dao" },
          { question: "bitcoin", expected: null, matched: null },
        ],
      },
    });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("physics→dao");
  });

  it("mucho cuidado con inyectar contexto fuera de dominio", () => {
    // La pregunta de control existe para esto: si recupera un bloque, el bot
    // está metiendo contexto donde no toca.
    const result = interpretKnowledge({
      knowledgeProbe: {
        blocks: 2,
        samples: [
          { question: "dao", expected: "dao", matched: "dao" },
          { question: "bitcoin", expected: null, matched: "dao" },
        ],
      },
    });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("fuera de dominio recibió dao");
  });

  it("una sonda sin pregunta de control no es verde: sólo demuestra la mitad", () => {
    const result = interpretKnowledge({
      knowledgeProbe: {
        blocks: 2,
        samples: [{ question: "dao", expected: "dao", matched: "dao" }],
      },
    });
    expect(result.status).toBe("skip");
    expect(result.detail).toContain("pregunta de control");
  });

  it("todas las preguntas en su sitio es verde, y lo dice con las dos mitades", () => {
    expect(interpretKnowledge(sano)).toEqual({
      status: "ok",
      detail: "2 bloques · 2/2 de dominio con su bloque · 1 fuera de dominio sin contexto",
    });
  });
});

describe("tabla", () => {
  const results = [
    { id: "memoria", status: "skip", detail: "falta Redis" },
    { id: "webhook", status: "ok", detail: "firma activa" },
  ];

  it("una fila por comprobación con la respuesta directa en HECHO", () => {
    const table = renderTable(results);
    const lines = table.split("\n");
    expect(lines[0]).toContain("COMPROBACIÓN");
    expect(lines[0]).toContain("HECHO");
    expect(table).toContain("sin verificar");
    expect(table).toContain("sí");
    expect(table).toContain("memoria del hilo (Redis)");
    expect(lines).toHaveLength(4);
  });

  it("las columnas quedan alineadas: el detalle empieza donde el encabezado", () => {
    const [head, , ...rows] = renderTable(results).split("\n");
    const start = head.indexOf("DETALLE");
    rows.forEach((row, index) => expect(row.indexOf(results[index].detail)).toBe(start));
  });
});

describe("resumen y código de salida", () => {
  it("un fallo manda sobre todo lo demás", () => {
    expect(summarize([{ status: "ok" }, { status: "fail" }, { status: "skip" }]).exitCode).toBe(1);
  });

  it("sin fallos pero con algo sin verificar devuelve 2", () => {
    const summary = summarize([{ status: "ok" }, { status: "warn" }, { status: "skip" }]);
    expect(summary).toMatchObject({ ok: 1, warn: 1, fail: 0, skip: 1, exitCode: 2 });
  });

  it("todo comprobado devuelve 0", () => {
    expect(summarize([{ status: "ok" }, { status: "warn" }]).exitCode).toBe(0);
  });
});

describe("señal de mercado (fase 9)", () => {
  const signal = {
    symbol: "BTC",
    priceUsd: 61241,
    asOf: "2026-11-23T00:33:47.000Z",
    fetchedAt: "2026-11-23T00:34:28.829Z",
    source: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin",
    sourceName: "CoinGecko",
  };
  const payload = {
    ok: true,
    servedFrom: "api/signal",
    cache: "hit",
    ageSeconds: 12,
    stale: false,
    signal,
  };

  it("verde con precio, fuente, horas y /senal ofrecido por el bot", () => {
    const result = interpretSenal(200, payload, { commands: ["/ayuda", "/senal"] });
    expect(result.status).toBe("ok");
    expect(result.detail).toContain("BTC $61241");
    expect(result.detail).toContain("api.coingecko.com");
    expect(result.detail).toContain("/senal ofrecido por el bot");
  });

  it("404 es fallo: el endpoint no está desplegado", () => {
    expect(interpretSenal(404, null).status).toBe("fail");
  });

  it("la fuente caída se cuenta con su motivo", () => {
    const result = interpretSenal(502, {
      ok: false,
      code: "source",
      reason: "la fuente no respondió: timeout",
    });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("timeout");
  });

  it("sin precio, sin URL de fuente o con horas falsas no hay verde", () => {
    expect(interpretSenal(200, { ok: true, signal: { ...signal, priceUsd: 0 } }).status).toBe("fail");
    expect(interpretSenal(200, { ok: true, signal: { ...signal, source: "api.coingecko.com" } }).status).toBe(
      "fail",
    );
    expect(interpretSenal(200, { ok: true, signal: { ...signal, asOf: "ayer" } }).status).toBe("fail");
  });

  it("un precio viejo es aviso, no verde", () => {
    expect(interpretSenal(200, { ...payload, ageSeconds: 900 }).status).toBe("warn");
  });

  it("si el bot desplegado no ofrece /senal, falla aunque el precio llegue", () => {
    const result = interpretSenal(200, payload, { commands: ["/ayuda", "/estado"] });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("no ofrece /senal");
  });
});
