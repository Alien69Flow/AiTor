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

  it("acepta el informe ya plano y cae a violated-directive si falta effective", () => {
    const [report] = parseReports({ "blocked-uri": "wss://relay.walletconnect.com", "violated-directive": "connect-src" });

    expect(report).toMatchObject({ directive: "connect-src", blocked: "wss://relay.walletconnect.com" });
  });

  it("descarta lo que no es un informe", () => {
    expect(parseReports({})).toEqual([]);
    expect(parseReports({ type: "deprecation" })).toEqual([]);
    expect(parseReports(null)).toEqual([]);
    expect(parseReports("texto")).toEqual([]);
  });
});
