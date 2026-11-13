import { describe, expect, it } from "vitest";
import { FALLBACK_CARD, TOOL_CARDS, normalizeToolKey, resolveToolCard } from "./chat-cards";

describe("resolveToolCard", () => {
  it("reconoce las cinco herramientas del MCP por su id", () => {
    for (const id of ["weather", "satellites", "osint", "github", "database"]) {
      expect(resolveToolCard(id).id).toBe(id);
    }
  });

  it("resuelve nombres namespaced por el token que conoce", () => {
    expect(resolveToolCard("mcp__weather__get").id).toBe("weather");
    expect(resolveToolCard("tools.github.search").id).toBe("github");
  });

  it("acepta la etiqueta en espanol y sin acentos", () => {
    expect(resolveToolCard("Meteo").id).toBe("weather");
    expect(resolveToolCard("satelites").id).toBe("satellites");
    expect(resolveToolCard("  Base de datos ").id).toBe("database");
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
  });
});
