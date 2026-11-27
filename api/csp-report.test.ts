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
      // Lo bloqueado también se queda en su origen: la política se edita por
      // origen y la ruta sólo añade ruido (y, en una URL firmada, el token).
      blocked: "https://cdn.example",
      // Del documento sólo queda el origen: ni ruta, ni query, ni fragmento.
      document: "https://aitor.alienflow.space",
      disposition: "report",
      via: "legacy",
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
      blocked: "https://pnyigikagdxqaogbiift.supabase.co",
      via: "reporting",
    });
  });

  it("cae a violated-directive cuando el navegador no manda effective", () => {
    const [report] = parseReports({
      "blocked-uri": "wss://relay.walletconnect.com",
      "violated-directive": "connect-src",
    });

    expect(report).toMatchObject({
      directive: "connect-src",
      blocked: "wss://relay.walletconnect.com",
      via: "plano",
    });
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

  it("sanea los campos: sin saltos de línea, con tope y con lo bloqueado en su origen", () => {
    const [withControl, withToken, longDirective, longBlocked] = parseReports([
      {
        "csp-report": {
          "effective-directive": "img-src",
          "blocked-uri": "https://x.example/a.png",
          disposition: "report\n[csp-report] directive=fake blocked=fake",
        },
      },
      {
        "csp-report": {
          "effective-directive": "img-src",
          "blocked-uri": "https://x.example/a.png",
          "document-uri": "https://aitor.alienflow.space/auth/callback/abc123?token=secreto#access_token=mala",
        },
      },
      { "csp-report": { "effective-directive": "i".repeat(1000), "blocked-uri": "https://x.example/a.png" } },
      { "csp-report": { "effective-directive": "img-src", "blocked-uri": `https://x.example/${"a".repeat(1000)}?token=secreto` } },
    ]);

    // Un `\n` en un campo que se registra entero no puede fabricar una línea de log falsa.
    expect(withControl.disposition).toBe("report [csp-report] directive=fake blocked=fake");
    // El secreto puede ir en la ruta, no sólo en la query: del documento queda el origen.
    expect(withToken.document).toBe("https://aitor.alienflow.space");
    // El tope de 512 sigue aplicándose a los campos que se registran enteros.
    expect(longDirective.directive.length).toBe(512);
    // Lo bloqueado se queda en el origen: ni ruta, ni el `?token=` de la cola.
    expect(longBlocked.blocked).toBe("https://x.example");
  });

  it("conserva los marcadores de blocked-uri y recorta las URL a su origen", () => {
    const blocked = (value: string) =>
      parseReports({ "csp-report": { "effective-directive": "script-src", "blocked-uri": value } })[0]
        .blocked;

    // Ninguno de los dos tiene autoridad: recortarlos los dejaría en `-`, que es
    // justo lo que dice si falta `'unsafe-inline'` o `'unsafe-eval'`.
    expect(blocked("inline")).toBe("inline");
    expect(blocked("eval")).toBe("eval");
    expect(blocked("data:text/html;base64,PHNjcmlwdD4=")).toBe("data:text/html;base64,PHNjcmlwdD4=");
    expect(blocked("blob:https://aitor.alienflow.space/9f8a")).toBe("blob:https://aitor.alienflow.space/9f8a");
    // Una URL firmada pierde ruta y query: el token no llega al log y dos firmas
    // del mismo origen cuentan como un solo aviso.
    expect(blocked("https://xyz.supabase.co/storage/v1/object/sign/bucket/f.pdf?token=jwt")).toBe(
      "https://xyz.supabase.co",
    );
  });

  it("descarta el userinfo del documento antes de formar el origen", () => {
    const document = (documentUri: string) => {
      const [report] = parseReports({
        "csp-report": {
          "effective-directive": "img-src",
          "blocked-uri": "https://x.example/a.png",
          "document-uri": documentUri,
        },
      });
      return report.document;
    };

    // `user:pass@` es credencial, no origen: ni el usuario ni la contraseña.
    expect(document("https://ana:s3creto@aitor.alienflow.space/hub")).toBe("https://aitor.alienflow.space");
    // Con usuario y sin contraseña, igual: la `@` sola ya separa userinfo.
    expect(document("https://ana@aitor.alienflow.space/hub?token=x")).toBe("https://aitor.alienflow.space");
    // Esquema y puerto sobreviven: son el origen, y no se recorta de más.
    expect(document("http://ana:s3creto@localhost:3000/")).toBe("http://localhost:3000");
    // Sin userinfo la salida es la de siempre.
    expect(document("https://aitor.alienflow.space/hub")).toBe("https://aitor.alienflow.space");
    // Sin host detrás de la `@` no hay origen que registrar.
    expect(document("https://ana:s3creto@/hub")).toBe("");
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
    expect(lines[0]).toContain("blocked=https://x.example");
    expect(lines[0]).toContain("via=legacy");
    expect(lines[0]).toContain("count=1");
  });

  it("marca por qué vía llegó el informe: reporting, legacy o plano", async () => {
    const reporting = await run([
      { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://x.example/a.png" } },
    ]);
    const legacy = await run({
      "csp-report": { "effective-directive": "img-src", "blocked-uri": "https://x.example/a.png" },
    });
    const plano = await run({ "effective-directive": "img-src", "blocked-uri": "https://x.example/a.png" });

    expect(reporting.lines[0]).toContain("via=reporting");
    expect(legacy.lines[0]).toContain("via=legacy");
    expect(plano.lines[0]).toContain("via=plano");
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
    // Todos comparten origen, así que ahora colapsan en una sola línea con su
    // cuenta: el tope de 20 informes sigue mordiendo (count=20), no 200.
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("count=20");
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
    // Dos pares (directiva, origen) → dos líneas, no cinco. La ruta del recurso
    // bloqueado no separa grupos: se recorta antes de agrupar.
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("[csp-report] directive=img-src blocked=https://x.example document=- disposition=- via=reporting count=3");
    expect(lines[1]).toBe("[csp-report] directive=connect-src blocked=https://y.example document=- disposition=- via=reporting count=2");

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
      "[csp-report] directive=img-src blocked=https://x.example document=https://aitor.alienflow.space disposition=- via=legacy count=1",
    );
    expect(lines[0]).not.toContain("token=");
    expect(lines[0]).not.toContain("/auth/callback");
  });

  it("el userinfo del documento no llega al log", async () => {
    const { status, lines } = await run({
      "csp-report": {
        "effective-directive": "img-src",
        "blocked-uri": "https://x.example/a.png",
        "document-uri": "https://ana:s3creto@aitor.alienflow.space/hub",
      },
    });

    expect(status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      "[csp-report] directive=img-src blocked=https://x.example document=https://aitor.alienflow.space disposition=- via=legacy count=1",
    );
    expect(lines[0]).not.toContain("s3creto");
    expect(lines[0]).not.toContain("ana@");
  });

  it("una URL firmada de lo bloqueado no deja el token en el log", async () => {
    const { lines } = await run({
      "csp-report": {
        "effective-directive": "img-src",
        "blocked-uri": "https://xyz.supabase.co/storage/v1/object/sign/bucket/f.pdf?token=jwt-de-prueba",
      },
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      "[csp-report] directive=img-src blocked=https://xyz.supabase.co document=- disposition=- via=legacy count=1",
    );
    expect(lines[0]).not.toContain("token=");
    expect(lines[0]).not.toContain("/storage/v1");
  });
});
