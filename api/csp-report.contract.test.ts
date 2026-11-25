import { describe, expect, it, vi } from "vitest";
import handler from "./csp-report";

/**
 * Contrato HTTP del colector, congelado tal y como lo confirmó la sonda contra
 * el despliegue: el código de respuesta y una línea `[csp-report]` por informe
 * válido. `parseReports` no puede probar esto —el 204 y el formato de la línea
 * los pone el handler—, así que aquí entra el cuerpo crudo con su
 * `Content-Type`, como lo manda el navegador.
 */

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader() {
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

/** Petición como la manda el navegador: cuerpo crudo y su `Content-Type`. */
async function call(raw: string | undefined, contentType: string, method = "POST") {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const res = mockRes();

  const req = {
    method,
    headers: {
      "content-type": contentType,
      "x-forwarded-for": "203.0.113.77",
      "user-agent": "csp-contract-test",
    },
    body: raw,
  };

  await handler(req as never, res as never);
  const lines = warn.mock.calls.map((entry) => String(entry[0]));
  warn.mockRestore();

  return { status: res.statusCode, body: res.body, lines };
}

describe("handler: contrato HTTP", () => {
  it("application/csp-report responde 204 y escribe una línea", async () => {
    const { status, lines } = await call(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://aitor.alienflow.space/hub",
          "blocked-uri": "https://cdn.example/x.js",
          "effective-directive": "script-src-elem",
          disposition: "report",
        },
      }),
      "application/csp-report",
    );

    expect(status).toBe(204);
    expect(lines).toEqual([
      "[csp-report] directive=script-src-elem blocked=https://cdn.example/x.js document=https://aitor.alienflow.space disposition=report count=1",
    ]);
  });

  it("application/reports+json responde 204 y escribe una línea por informe", async () => {
    const { status, lines } = await call(
      JSON.stringify([
        {
          type: "csp-violation",
          body: {
            documentURL: "https://aitor.alienflow.space/hub",
            blockedURL: "https://api.coingecko.com/api",
            effectiveDirective: "connect-src",
            disposition: "report",
          },
        },
        {
          type: "csp-violation",
          body: {
            documentURL: "https://aitor.alienflow.space/hub",
            blockedURL: "https://fonts.gstatic.com/s/x.woff2",
            effectiveDirective: "font-src",
            disposition: "report",
          },
        },
      ]),
      "application/reports+json",
    );

    expect(status).toBe(204);
    expect(lines).toEqual([
      "[csp-report] directive=connect-src blocked=https://api.coingecko.com/api document=https://aitor.alienflow.space disposition=report count=1",
      "[csp-report] directive=font-src blocked=https://fonts.gstatic.com/s/x.woff2 document=https://aitor.alienflow.space disposition=report count=1",
    ]);
  });

  it("en un lote, el `deprecation` se descarta y el resto se registra", async () => {
    const { status, lines } = await call(
      JSON.stringify([
        {
          type: "deprecation",
          body: {
            id: "dep-1",
            message: "esto no es una violación CSP",
            sourceFile: "https://aitor.alienflow.space/app.js",
          },
        },
        {
          type: "csp-violation",
          body: {
            documentURL: "https://aitor.alienflow.space/hub",
            blockedURL: "https://x.example/a.png",
            effectiveDirective: "img-src",
            disposition: "report",
          },
        },
      ]),
      "application/reports+json",
    );

    expect(status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      "[csp-report] directive=img-src blocked=https://x.example/a.png document=https://aitor.alienflow.space disposition=report count=1",
    );
    expect(lines[0]).not.toContain("deprecation");
  });

  it("un cuerpo que no es JSON responde 204 y no escribe nada", async () => {
    const { status, lines } = await call("no soy json", "application/csp-report");

    expect(status).toBe(204);
    expect(lines).toHaveLength(0);
  });

  it("GET responde 405 y no escribe nada", async () => {
    const { status, body, lines } = await call(undefined, "application/csp-report", "GET");

    expect(status).toBe(405);
    expect(body).toEqual({ error: "method not allowed" });
    expect(lines).toHaveLength(0);
  });
});
