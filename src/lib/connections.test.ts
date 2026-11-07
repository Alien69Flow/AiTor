import { describe, expect, it } from "vitest";
import { routeSkills, SKILLS, type SkillId } from "@/lib/ai-skills";
import {
  AEMET_KEY_TOOLS,
  KEYED_TOOLS,
  mcpSummary,
  mcpToolRows,
  modelKeyRow,
  MODEL_KEY_TOOLS,
  SERVER_ONLY_TOOLS,
  SKILL_PROBE_TEXT,
  summarize,
} from "./connections";

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

  it("lista las herramientas del servidor que el navegador no conoce", () => {
    // El fallo real: `media.*` sólo existe en `api/mcp.ts`, así que el panel
    // enseñaba 6 de las 9 y la imagen/audio no aparecían por ningún lado.
    const listed = ["github.repo", "db.select", ...MODEL_KEY_TOOLS];
    const filas = mcpToolRows(tools, listed, "ok");
    expect(filas.map((fila) => fila.id)).toEqual([
      "github.repo",
      "db.select",
      "media.image",
      "media.music",
      "media.speech",
      "media.video",
    ]);
    expect(filas[2]).toMatchObject({ title: "Generar una imagen", state: "ok" });
  });

  it("una herramienta de la clave no está verde si falta la clave", () => {
    const filas = mcpToolRows(tools, ["github.repo", ...MODEL_KEY_TOOLS], "missing");
    const imagen = filas.find((fila) => fila.id === "media.image");
    expect(imagen).toMatchObject({
      state: "fail",
      error: "publicada, pero sin GEMINI_API_KEY no puede ejecutarse",
    });
    // El resto sigue en verde: el fallo es de la clave, no del despliegue.
    expect(filas[0].state).toBe("ok");
  });
});

describe("fila de la clave del modelo", () => {
  it("sin respuesta todavía está gris", () => {
    expect(modelKeyRow(null, null)).toMatchObject({ state: "idle", ms: undefined });
  });

  it("ausente y con marcador son fallo, y lo dicen distinto", () => {
    expect(modelKeyRow({ geminiKeyState: "missing" }, 42)).toMatchObject({
      state: "fail",
      error: "ausente: la cuenta no genera imagen ni audio",
      ms: 42,
    });
    expect(modelKeyRow({ geminiKeyState: "placeholder" }, 42)).toMatchObject({
      state: "fail",
      error: "marcador de posición, no una clave real",
    });
  });

  it("con clave real la fila queda en verde", () => {
    expect(modelKeyRow({ geminiKeyState: "ok" }, 12)).toMatchObject({ state: "ok" });
  });

  it("las herramientas de la clave son las cuatro de medios", () => {
    expect(MODEL_KEY_TOOLS.sort()).toEqual(["media.image", "media.music", "media.speech", "media.video"]);
    expect(Object.keys(SERVER_ONLY_TOOLS).sort()).toEqual([...KEYED_TOOLS].sort());
  });

  it("AEMET tiene su clave y no la tapa la del modelo", () => {
    const filas = mcpToolRows([], ["weather.aemet"], "missing", "ok");
    expect(filas[0]).toMatchObject({ id: "weather.aemet", state: "ok" });
    const sinClave = mcpToolRows([], ["weather.aemet"], "ok", "missing");
    expect(sinClave[0]).toMatchObject({
      state: "fail",
      error: "publicada, pero sin AEMET_API_KEY no puede ejecutarse",
    });
    expect(AEMET_KEY_TOOLS.sort()).toEqual(["weather.aemet"]);
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
