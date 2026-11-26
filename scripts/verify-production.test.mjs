import { describe, expect, it } from "vitest";
import { interpretWebhook } from "./verify-production.mjs";

/** Un informe como el que sirve producción, con lo que cada caso quiera cambiar. */
function payload(patch = {}) {
  return {
    ok: true,
    secretConfigured: true,
    registration: "registrado-con-secreto",
    bot: { id: 1845273703, username: "Alien69Bot" },
    webhook: { matchesExpected: true, pendingUpdates: 0 },
    ...patch,
  };
}

describe("interpretWebhook", () => {
  it("sin TELEGRAM_WEBHOOK_SECRET es un fallo, no un aviso", () => {
    // El estado real de producción el 26-nov: URL correcta, cero pendientes y
    // ninguna firma. Con ⚠️ pasaba por «parcial» y el bot estaba mudo.
    const result = interpretWebhook(200, payload({ secretConfigured: false }));

    expect(result.status).toBe("fail");
    expect(result.detail).toContain("TELEGRAM_WEBHOOK_SECRET");
  });

  it("con firma, URL correcta y sin entregas es verde", () => {
    const result = interpretWebhook(200, payload());

    expect(result.status).toBe("ok");
    expect(result.detail).toContain("@Alien69Bot");
    expect(result.detail).toContain("firma activa");
  });

  it("una URL registrada distinta es un fallo", () => {
    const result = interpretWebhook(200, payload({ webhook: { matchesExpected: false, pendingUpdates: 0 } }));

    expect(result.status).toBe("fail");
    expect(result.detail).toContain("URL registrada distinta");
  });

  it("un despliegue que no expone matchesExpected tampoco pasa", () => {
    // Sin el campo no hay prueba de que apunte donde debe: no es un `true`.
    const result = interpretWebhook(200, payload({ webhook: { pendingUpdates: 0 } }));

    expect(result.status).toBe("fail");
    expect(result.detail).toContain("URL registrada distinta");
  });

  it("un 401 anotado por Telegram es un fallo", () => {
    const result = interpretWebhook(
      200,
      payload({
        webhook: {
          matchesExpected: true,
          pendingUpdates: 0,
          lastErrorMessage: "Wrong response from the webhook: 401 Unauthorized",
        },
      }),
    );

    expect(result.status).toBe("fail");
    expect(result.detail).toContain("último envío con error");
  });

  it("las entregas pendientes se dicen con su número", () => {
    const result = interpretWebhook(200, payload({ webhook: { matchesExpected: true, pendingUpdates: 3 } }));

    expect(result.status).toBe("fail");
    expect(result.detail).toContain("3 entregas pendientes");
  });

  it("un HTTP distinto de 200 sin cuerpo es un fallo", () => {
    expect(interpretWebhook(500, null).status).toBe("fail");
    expect(interpretWebhook(200, { ok: false, error: "sin token" }).detail).toContain("sin token");
  });
});
