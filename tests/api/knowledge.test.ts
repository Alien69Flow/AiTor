import { describe, expect, it } from "vitest";
import {
  MAX_KNOWLEDGE_CHARS,
  normalize,
  retrieveKnowledge,
  scoreBlocks,
} from "../../supabase/functions/_shared/knowledge";

describe("normalize", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(normalize("¿Física Unificada?")).toBe("fisica unificada");
    expect(normalize("Tokenómica")).toBe("tokenomica");
  });
});

describe("retrieveKnowledge", () => {
  it("una pregunta de la DAO trae el bloque de la DAO", () => {
    const context = retrieveKnowledge("¿cómo funciona la gobernanza de la DAO?");
    expect(context).toContain("AlienFlowSpace DAO");
    expect(context).toContain("Web3/Web4/Web5");
  });

  it("una pregunta sobre 16.18 trae el núcleo teórico y avisa de que es marco propio", () => {
    const context = retrieveKnowledge("¿qué significa la constante 16.18?");
    expect(context).toContain("física unificada");
    expect(context).toContain("marco propio");
    expect(context).not.toContain("Web3/Web4/Web5");
  });

  it("no inyecta nada si la pregunta no es del dominio", () => {
    expect(retrieveKnowledge("¿cuánto cuesta el bitcoin hoy?" )).toBeNull();
    expect(retrieveKnowledge("hola")).toBeNull();
    expect(retrieveKnowledge("")).toBeNull();
  });

  it("el bloque cabe en el tope de la función chat", () => {
    const context = retrieveKnowledge("dao synapse tesoreria")!;
    expect(context.length).toBeLessThanOrEqual(MAX_KNOWLEDGE_CHARS);
  });

  it("no se activa con trozos de palabra", () => {
    // "dao" dentro de otra palabra no debe contar.
    expect(retrieveKnowledge("claudao")).toBeNull();
  });
});

describe("scoreBlocks", () => {
  it("ordena por coincidencias y deja en 0 lo que no toca", () => {
    const scored = scoreBlocks("tesla y la dao");
    expect(scored[0].score).toBeGreaterThan(0);
    expect(scored.every((entry) => entry.score >= 0)).toBe(true);
  });
});
