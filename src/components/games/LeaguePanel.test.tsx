import { describe, expect, it } from "vitest";
import { LEAGUE_FRAME, LEAGUE_SEVERITY } from "./LeaguePanel";

describe("LEAGUE_SEVERITY", () => {
  it("distingue las cinco salidas de la liga", () => {
    expect(new Set(Object.values(LEAGUE_SEVERITY)).size).toBe(5);
  });

  it("trata la migracion ausente como aviso, no como error", () => {
    expect(LEAGUE_SEVERITY.missing).toBe("warn");
    expect(LEAGUE_SEVERITY.error).toBe("critical");
  });

  it("no pinta la liga sin sesion como fallo", () => {
    expect(LEAGUE_SEVERITY.anon).toBe("unknown");
  });

  it("la tabla del servidor lista, y cargando es informativo", () => {
    expect(LEAGUE_SEVERITY.ready).toBe("ok");
    expect(LEAGUE_SEVERITY.loading).toBe("info");
  });
});

describe("LEAGUE_FRAME", () => {
  it("cubre los cinco tonos", () => {
    expect(Object.keys(LEAGUE_FRAME).sort()).toEqual(["critical", "info", "ok", "unknown", "warn"]);
  });

  it("ningun marco se repite ni queda vacio", () => {
    const frames = Object.values(LEAGUE_FRAME);
    expect(new Set(frames).size).toBe(frames.length);
    for (const frame of frames) expect(frame.trim().length).toBeGreaterThan(0);
  });
});
