import { describe, expect, it } from "vitest";
import { extractCoinIds, extractRepo, MAX_SKILLS_PER_TURN, routeSkills, SKILLS } from "./ai-skills";

/**
 * The router decides when the chat spends a network call before answering. Both
 * directions matter: missing a skill leaves the model answering from memory, and
 * firing one needlessly adds latency to a question that did not need it.
 */
describe("ai skills router", () => {
  it("rutea el precio de una cripto al mercado, no a la web", () => {
    expect(routeSkills("¿cuánto está bitcoin ahora?")).toEqual(["market"]);
  });

  it("prefiere el clima espacial al término genérico", () => {
    expect(routeSkills("¿cómo está el índice Kp hoy?")).toEqual(["spaceWeather"]);
    expect(routeSkills("hay una tormenta solar fuerte")).toEqual(["spaceWeather"]);
  });

  it("reconoce un repositorio de GitHub", () => {
    expect(routeSkills("analiza https://github.com/facebook/react")).toEqual(["repo"]);
    expect(routeSkills("mira el repositorio Alien69Flow/aitor y dime qué hace")).toEqual(["repo"]);
  });

  it("combina OSINT con búsqueda web cuando la pregunta pide ambas cosas", () => {
    expect(routeSkills("busca en internet las últimas noticias de UAP")).toEqual(["osint", "web"]);
  });

  it("no dispara nada para una pregunta de conocimiento general", () => {
    expect(routeSkills("explícame la diferencia entre un qubit y un bit")).toEqual([]);
    expect(routeSkills("escribe un poema sobre el mar")).toEqual([]);
  });

  it("trata una URL suelta como una petición de lectura", () => {
    expect(routeSkills("resume esto https://example.com/articulo")).toEqual(["web"]);
  });

  it("nunca pasa del máximo por turno", () => {
    const everything = "bitcoin busca noticias uap github.com/a/b índice kp";
    const routed = routeSkills(everything);
    expect(routed.length).toBeLessThanOrEqual(MAX_SKILLS_PER_TURN);
    expect(new Set(routed).size).toBe(routed.length);
    expect(routed[0]).toBe("spaceWeather");
  });

  it("todo skill del catálogo tiene etiqueta y al menos un patrón", () => {
    for (const skill of SKILLS) {
      expect(skill.label.length).toBeGreaterThan(2);
      expect(skill.gives.length).toBeGreaterThan(10);
      expect(skill.patterns.length).toBeGreaterThan(0);
      for (const pattern of skill.patterns) expect(pattern).toBeInstanceOf(RegExp);
    }
  });

  it("extrae los ids de CoinGecko sin duplicados", () => {
    expect(extractCoinIds("bitcoin y btc")).toEqual(["bitcoin"]);
    expect(extractCoinIds("eth, solana y BTC")).toEqual(["bitcoin", "ethereum", "solana"]);
    expect(extractCoinIds("hola")).toEqual([]);
  });

  it("extrae owner/repo de una URL y de la forma corta", () => {
    expect(extractRepo("https://github.com/vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(extractRepo("revisa Alien69Flow/aitor por favor")).toEqual({ owner: "Alien69Flow", repo: "aitor" });
    expect(extractRepo("no hay repositorio aquí")).toBeNull();
  });
});
