import { describe, expect, it } from "vitest";
import { SKILLS } from "./ai-skills";
import { FALLBACK_CARD, TOOL_CARDS, normalizeToolKey, resolveToolCard } from "./chat-cards";

describe("resolveToolCard", () => {
  it("resuelve el id de cada tarjeta del registro", () => {
    for (const card of Object.values(TOOL_CARDS)) {
      expect(resolveToolCard(card.id).id).toBe(card.id);
    }
  });

  it("resuelve la etiqueta y el id de CADA skill real del chat", () => {
    // Si alguien renombra una skill en ai-skills.ts, esto falla aqui en vez de
    // degradar a la tarjeta gris en silencio.
    for (const skill of SKILLS) {
      expect(resolveToolCard(skill.label).id).toBe(skill.id);
      expect(resolveToolCard(skill.id).id).toBe(skill.id);
    }
  });

  it("resuelve nombres namespaced y con guiones del agente", () => {
    expect(resolveToolCard("mcp__weather__get").id).toBe("weather");
    expect(resolveToolCard("tools.github.search").id).toBe("repo");
    expect(resolveToolCard("noaa-space-weather").id).toBe("spaceWeather");
  });

  it("separa camelCase en los nombres de herramienta", () => {
    expect(resolveToolCard("getWeather").id).toBe("weather");
    expect(resolveToolCard("spaceWeather").id).toBe("spaceWeather");
  });

  it("distingue clima de superficie de clima espacial", () => {
    expect(resolveToolCard("clima").id).toBe("weather");
    expect(resolveToolCard("Clima espacial").id).toBe("spaceWeather");
  });

  it("no inventa: lo desconocido cae en la tarjeta generica", () => {
    expect(resolveToolCard("quimica-cuantica")).toBe(FALLBACK_CARD);
    expect(resolveToolCard(null)).toBe(FALLBACK_CARD);
    expect(resolveToolCard("   ")).toBe(FALLBACK_CARD);
  });

  it("no hay dos tarjetas con el mismo id y todas tienen pista de vacio", () => {
    const ids = Object.values(TOOL_CARDS).map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of [...Object.values(TOOL_CARDS), FALLBACK_CARD]) {
      expect(card.emptyHint.length).toBeGreaterThan(0);
    }
  });

  it("normaliza mayusculas, acentos y espacios", () => {
    expect(normalizeToolKey("  Satélites ")).toBe("satelites");
    expect(normalizeToolKey("getWeather")).toBe("get weather");
  });
});
