import { describe, expect, it } from "vitest";
import {
  interpretCron,
  interpretHealth,
  interpretMemory,
  interpretWebhook,
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
  it("sin service key no se inventa un verde: queda sin verificar", () => {
    const result = interpretMemory({ configured: false, statuses: [] });
    expect(result.status).toBe("skip");
    expect(result.detail).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("una tabla que no existe (404) es fallo con el nombre del paso", () => {
    const result = interpretMemory({
      configured: true,
      statuses: [{ name: "alta del hilo", status: 404 }],
    });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("alta del hilo");
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

  it("ida y vuelta limpia y borrada es verde", () => {
    const result = interpretMemory({
      configured: true,
      statuses: [],
      saved: true,
      readBack: true,
      cleaned: true,
    });
    expect(result).toEqual({ status: "ok", detail: "ida y vuelta de 2 turnos, y borrada" });
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
