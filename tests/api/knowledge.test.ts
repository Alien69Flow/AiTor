import { describe, expect, it } from "vitest";
import {
  MAX_KNOWLEDGE_CHARS,
  normalize,
  retrieveKnowledge,
  scoreBlocks,
  tokenize,
} from "../../api/_shared/knowledge";

describe("normalize", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(normalize("¿Física Unificada?")).toBe("fisica unificada");
    expect(normalize("Tokenómica")).toBe("tokenomica");
  });
});

describe("tokenize", () => {
  it("deja palabras significativas, sin plural y sin ruido de la pregunta", () => {
    expect(tokenize("¿cómo son las propuestas de la DAO?")).toEqual(["propuesta", "dao"]);
    expect(tokenize("hola")).toEqual([]);
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

  it("entiende sinónimos y otro idioma", () => {
    // Sin la palabra "áurea" ni "física": sólo el sinónimo en inglés.
    expect(retrieveKnowledge("¿qué es el golden ratio de este colectivo?")).toContain(
      "física unificada",
    );
    expect(retrieveKnowledge("how does the governance work?")).toContain("AlienFlowSpace DAO");
  });

  it("tolera el plural y las palabras clave sueltas", () => {
    expect(retrieveKnowledge("propuestas de tesorería")).toContain("AlienFlowSpace DAO");
    expect(retrieveKnowledge("tesla")).toContain("física unificada");
  });

  it("sigue sin inyectar nada en preguntas generales", () => {
    expect(retrieveKnowledge("dame un resumen del clima en Madrid")).toBeNull();
    expect(retrieveKnowledge("resume este texto, por favor")).toBeNull();
  });
});

describe("scoreBlocks", () => {
  it("ordena por coincidencias y deja en 0 lo que no toca", () => {
    const scored = scoreBlocks("tesla y la dao");
    expect(scored[0].score).toBeGreaterThan(0);
    expect(scored.every((entry) => entry.score >= 0)).toBe(true);
  });

  it("prefiere el bloque cuyas palabras clave aparecen de verdad", () => {
    expect(scoreBlocks("gobernanza y tesorería")[0].block.id).toBe("dao");
    expect(scoreBlocks("golden ratio")[0].block.id).toBe("physics");
  });
});
