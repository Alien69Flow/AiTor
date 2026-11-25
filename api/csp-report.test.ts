import { describe, expect, it, vi } from "vitest";
import handler, { parseReports } from "./csp-report";

describe("parseReports", () => {
  it("lee el formato legacy de report-uri (application/csp-report)", () => {
    const [report] = parseReports({
      "csp-report": {
        "document-uri": "https://aitor.alienflow.space/",
        "blocked-uri": "https://cdn.example/x.js",
        "effective-directive": "script-src-elem",
        disposition: "report",
      },
    });

    expect(report).toMatchObject({
      directive: "script-src-elem",
      blocked: "https://cdn.example/x.js",
      document: "https://aitor.alienflow.space/",
      disposition: "report",
    });
  });

  it("lee el formato de la Reporting API (lista con type y body)", () => {
    const reports = parseReports([
      {
        type: "csp-violation",
        body: {
          documentURL: "https://aitor.alienflow.space/",
          blockedURL: "https://pnyigikagdxqaogbiift.supabase.co/rest/v1",
          effectiveDirective: "connect-src",
          disposition: "report",
        },
      },
    ]);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      directive: "connect-src",
      blocked: "https://pnyigikagdxqaogbiift.supabase.co/rest/v1",
    });
  });

  it("cae a violated-directive cuando el navegador no manda effective", () => {
    const [report] = parseReports({
      "blocked-uri": "wss://relay.walletconnect.com",
      "violated-directive": "connect-src",
    });

    expect(report).toMatchObject({ directive: "connect-src", blocked: "wss://relay.walletconnect.com" });
  });

  it("descarta lo que no es un informe, sin lanzar", () => {
    const notReports: unknown[] = [
      {},
      { type: "deprecation" },
      { type: "csp-violation" },
      // Un documento solo no dice qué origen falta: no se registra.
      { "document-uri": "https://aitor.alienflow.space/" },
      null,
      "texto",
      42,
    ];

    for (const payload of notReports) expect(parseReports(payload)).toEqual([]);
  });

  it("corta en el tope de informes por petición", () => {
    const entries = Array.from({ length: 50 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src" } }));

    expect(parseReports(entries)).toHaveLength(20);
  });

  it("sanea los campos: ni saltos de línea ni URLs sin tope en el log", () => {
    const [report] = parseReports({
      "csp-report": {
        "effective-directive": "img-src",
        "blocked-uri": "https://x.example/a.png\n[csp-report] directive=fake blocked=fake",
        "document-uri": `https://aitor.alienflow.space/${"a".repeat(1000)}`,
      },
    });

    expect(report.blocked).toBe("https://x.example/a.png [csp-report] directive=fake blocked=fake");
    expect(report.document.length).toBe(512);
  });
});

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

/** Un informe legacy de `pad` caracteres de relleno, para forzar el tope de cuerpo. */
function legacyBody(pad: number): string {
  return JSON.stringify({
    "csp-report": {
      "effective-directive": "img-src",
      "blocked-uri": "https://x.example/a.png",
      ...(pad > 0 ? { pad: "a".repeat(pad) } : {}),
    },
  });
}

/** Ejecuta el handler y devuelve el código y las líneas de log que escribió. */
async function run(body: unknown, method = "POST") {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { res } = mockRes();

  const req = {
    method,
    headers: {
      "content-type": "application/csp-report",
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "csp-test",
    },
    body,
  };

  await handler(req as never, res as never);
  const lines = warn.mock.calls.map((call) => String(call[0]));
  warn.mockRestore();

  return { status: res.statusCode, lines };
}

describe("handler", () => {
  it("sólo acepta POST", async () => {
    expect((await run(undefined, "GET")).status).toBe(405);
  });

  it("registra el informe legacy como una línea", async () => {
    const { status, lines } = await run(legacyBody(0));

    expect(status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("directive=img-src");
    expect(lines[0]).toContain("blocked=https://x.example/a.png");
  });

  it("por debajo de 8 KiB entra y justo en el tope también", async () => {
    const { lines } = await run(legacyBody(8_000 - legacyBody(0).length));

    expect(new TextEncoder().encode(legacyBody(8_000 - legacyBody(0).length)).length).toBeLessThanOrEqual(8 * 1024);
    expect(lines).toHaveLength(1);
  });

  it("por encima de 8 KiB no registra nada, ni como texto ni como bytes", async () => {
    const big = legacyBody(9_000);

    expect((await run(big)).lines).toHaveLength(0);
    expect((await run(new TextEncoder().encode(big))).lines).toHaveLength(0);
  });

  it("un array enorme de informes se corta en 20 líneas", async () => {
    const reports = Array.from({ length: 200 }, () => ({
      type: "csp-violation",
      body: { effectiveDirective: "img-src", blockedURL: "https://x.example/a.png" },
    }));

    const { status, lines } = await run(reports);

    expect(status).toBe(204);
    expect(lines).toHaveLength(20);
  });

  it("JSON roto responde 204 y no registra ni lanza", async () => {
    const { status, lines } = await run("{ no soy json");

    expect(status).toBe(204);
    expect(lines).toHaveLength(0);
  });
});
