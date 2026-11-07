import { describe, expect, it } from "vitest";
import { routeSkills, SKILLS, type SkillId } from "@/lib/ai-skills";
import { mcpSummary, mcpToolRows, SKILL_PROBE_TEXT, summarize } from "./connections";

/**
 * El panel de conexiones sólo vale si dice la verdad: cada sonda tiene que
 * volver a enrutar a su propia skill, y una herramienta ausente del despliegue
 * no puede pintarse en verde.
 */

describe("sondas por skill", () => {
  it("cada texto de sonda enruta a su propia skill", () => {
    for (const skill of SKILLS) {
      expect(routeSkills(SKILL_PROBE_TEXT[skill.id]), skill.id).toContain(skill.id);
    }
  });

  it("están todas las skills del catálogo, sin sobrar ninguna", () => {
    expect(Object.keys(SKILL_PROBE_TEXT).sort()).toEqual(
      SKILLS.map((skill) => skill.id).sort(),
    );
    expect(new Set(Object.keys(SKILL_PROBE_TEXT) as SkillId[]).size).toBe(SKILLS.length);
  });
});

describe("filas de herramientas MCP", () => {
  const tools = [
    { name: "github.repo", title: "Repositorio", description: "Lee el repo", minTier: "free" },
    { name: "db.select", title: "Filas", description: "Lee tus filas" },
  ];

  it("sin preguntar todavía todo está gris", () => {
    expect(mcpToolRows(tools, null).every((row) => row.state === "idle")).toBe(true);
  });

  it("lo que el despliegue no publica sale en rojo y con motivo", () => {
    const filas = mcpToolRows(tools, ["github.repo"]);
    expect(filas[0]).toMatchObject({ state: "ok" });
    expect(filas[1]).toMatchObject({ state: "fail", error: "no está en este despliegue" });
  });

  it("el plan declarado se ve en la fila", () => {
    expect(mcpToolRows(tools, ["github.repo"])[0].detail).toContain("plan free");
  });
});

describe("resumen", () => {
  it("la clave ausente cuenta como fallo, no como gris", () => {
    expect(mcpSummary({ tools: 7, geminiKeyState: "missing" }, 42)).toEqual({
      state: "fail",
      detail: "7 herramientas · sin clave: responde sin herramientas · 42 ms",
    });
    expect(mcpSummary({ tools: 7, geminiKeyState: "ok" }, 12).state).toBe("ok");
    expect(mcpSummary(null, null)).toEqual({ state: "fail", detail: "sin respuesta de /api/mcp" });
  });

  it("cuenta cada estado por separado", () => {
    const filas = mcpToolRows(
      [{ name: "a" }, { name: "b" }, { name: "c" }],
      ["a", "b"],
    );
    expect(summarize(filas)).toEqual({ ok: 2, fail: 1, idle: 0 });
  });
});
