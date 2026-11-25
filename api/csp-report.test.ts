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
      // Del documento sólo queda el origen: ni ruta, ni query, ni fragmento.
      document: "https://aitor.alienflow.space",
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

  it("sanea los campos: sin saltos de línea, sin secretos en el documento y con tope", () => {
    const [withControl, withToken, longBlocked] = parseReports([
      { "csp-report": { "effective-directive": "img-src", "blocked-uri": "https://x.example/a.png\n[csp-report] directive=fake blocked=fake" } },
      {
        "csp-report": {
          "effective-directive": "img-src",
          "blocked-uri": "https://x.example/a.png",
          "document-uri": "https://aitor.alienflow.space/auth/callback/abc123?token=secreto#access_token=mala",
        },
      },
      { "csp-report": { "effective-directive": "img-src", "blocked-uri": `https://x.example/${"a".repeat(1000)}` } },
    ]);

    // Un `\n` en un campo no puede fabricar una línea de log falsa.
    expect(withControl.blocked).toBe("https://x.example/a.png [csp-report] directive=fake blocked=fake");
    // El secreto puede ir en la ruta, no sólo en la query: del documento queda el origen.
    expect(withToken.document).toBe("https://aitor.alienflow.space");
    // El tope de 512 sigue aplicándose a los campos que se registran enteros.
    expect(longBlocked.blocked.length).toBe(512);
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
    expect(lines[0]).toContain("count=1");
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

  it("un array enorme se corta en 20 informes: 20 grupos distintos", async () => {
    const reports = Array.from({ length: 200 }, (_, index) => ({
      type: "csp-violation",
      body: { effectiveDirective: "img-src", blockedURL: `https://x.example/${index}.png` },
    }));

    const { status, lines } = await run(reports);

    expect(status).toBe(204);
    expect(lines).toHaveLength(20);
    expect(lines.every((line) => line.endsWith("count=1"))).toBe(true);
  });

  it("agrupa por directiva y origen: los repetidos son una línea con su cuenta", async () => {
    const repeated = (directive: string, blocked: string, times: number) =>
      Array.from({ length: times }, () => ({
        type: "csp-violation",
        body: { effectiveDirective: directive, blockedURL: blocked },
      }));

    const { status, lines } = await run([
      ...repeated("img-src", "https://x.example/a.png", 3),
      ...repeated("connect-src", "https://y.example/api", 2),
    ]);

    expect(status).toBe(204);
    // Dos pares (directiva, origen) → dos líneas, no cinco.
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("[csp-report] directive=img-src blocked=https://x.example/a.png document=- disposition=- count=3");
    expect(lines[1]).toBe("[csp-report] directive=connect-src blocked=https://y.example/api document=- disposition=- count=2");

    // El tope de informes se aplica antes de agrupar: 25 repeticiones cuentan 20.
    const capped = await run(repeated("img-src", "https://x.example/a.png", 25));

    expect(capped.lines).toHaveLength(1);
    expect(capped.lines[0]).toContain("count=20");
  });

  it("JSON roto responde 204 y no registra ni lanza", async () => {
    const { status, lines } = await run("{ no soy json");

    expect(status).toBe(204);
    expect(lines).toHaveLength(0);
  });

  it("no registra la ruta ni la query del documento: un token en la URL no llega al log", async () => {
    const { status, lines } = await run({
      "csp-report": {
        "effective-directive": "img-src",
        "blocked-uri": "https://x.example/a.png",
        "document-uri": "https://aitor.alienflow.space/auth/callback/abc123?token=secreto-de-prueba#frag",
      },
    });

    expect(status).toBe(204);
    expect(lines).toHaveLength(1);
    // La línea entera, para que el formato no se mueva sin que salte esta prueba.
    expect(lines[0]).toBe(
      "[csp-report] directive=img-src blocked=https://x.example/a.png document=https://aitor.alienflow.space disposition=- count=1",
    );
    expect(lines[0]).not.toContain("token=");
    expect(lines[0]).not.toContain("/auth/callback");
  });
});
