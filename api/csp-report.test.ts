import { describe, expect, it } from "vitest";
import { parseReports } from "./csp-report";

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
    const notReports: unknown[] = [{}, { type: "deprecation" }, { type: "csp-violation" }, null, "texto", 42];

    for (const payload of notReports) expect(parseReports(payload)).toEqual([]);
  });

  it("corta en el tope de informes por petición", () => {
    const entries = Array.from({ length: 50 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src" } }));

    expect(parseReports(entries)).toHaveLength(20);
  });
});
