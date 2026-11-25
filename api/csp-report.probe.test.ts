// Sonda temporal: verifica el handler con los dos formatos de cuerpo.
// No se queda en el repo.
import { describe, expect, it, vi } from "vitest";
import handler from "./csp-report";

function mockRes() {
  const headers: Record<string, unknown> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: unknown) {
      headers[name.toLowerCase()] = value;
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
  return { res, headers };
}

const post = (body: string, contentType: string) => ({
  method: "POST",
  headers: {
    "content-type": contentType,
    "x-forwarded-for": "203.0.113.9",
    "user-agent": "csp-probe",
  },
  body,
});

const lines = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((call) => String(call[0]));

describe("sonda: POST real al handler", () => {
  it("GET responde 405", async () => {
    const { res } = mockRes();
    await handler({ method: "GET", headers: {} } as never, res as never);
    console.log(`[probe] GET status=${res.statusCode} body=${JSON.stringify(res.body)}`);
    expect(res.statusCode).toBe(405);
  });

  it("application/csp-report responde 204 y una línea", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { res, headers } = mockRes();

    const legacy = JSON.stringify({
      "csp-report": {
        "document-uri": "https://aitor.alienflow.space/dashboard",
        "blocked-uri": "https://pnyigikagdxqaogbiift.supabase.co/rest/v1/rpc",
        "effective-directive": "connect-src",
        disposition: "report",
      },
    });

    await handler(post(legacy, "application/csp-report") as never, res as never);

    const found = lines(warn);
    console.log(`[probe] legacy status=${res.statusCode} lines=${found.length} rateLimitMode=${String(headers["x-ratelimit-mode"])}`);
    for (const line of found) console.log(`[probe] log ${line}`);

    expect(res.statusCode).toBe(204);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("directive=connect-src");
  });

  it("application/reports+json responde 204 y una línea por informe válido", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { res } = mockRes();

    const reporting = JSON.stringify([
      {
        type: "csp-violation",
        body: {
          documentURL: "https://aitor.alienflow.space/",
          blockedURL: "https://telegram.org/js/telegram-web-app.js",
          effectiveDirective: "script-src-elem",
          disposition: "report",
        },
      },
      { type: "deprecation", body: { id: "foo", message: "bar" } },
      {
        type: "csp-violation",
        body: {
          documentURL: "https://aitor.alienflow.space/",
          blockedURL: "wss://relay.walletconnect.com",
          effectiveDirective: "connect-src",
          disposition: "report",
        },
      },
    ]);

    await handler(post(reporting, "application/reports+json") as never, res as never);

    const found = lines(warn);
    console.log(`[probe] reports+json status=${res.statusCode} lines=${found.length}`);
    for (const line of found) console.log(`[probe] log ${line}`);

    expect(res.statusCode).toBe(204);
    expect(found).toHaveLength(2);
  });

  it("basura responde 204 sin líneas", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { res } = mockRes();
    await handler(post("no soy json", "application/csp-report") as never, res as never);
    console.log(`[probe] basura status=${res.statusCode} lines=${lines(warn).length}`);
    expect(res.statusCode).toBe(204);
    expect(lines(warn)).toHaveLength(0);
  });
});
