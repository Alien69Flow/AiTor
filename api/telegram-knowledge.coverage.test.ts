/**
 * La sonda de producción es la prueba de la fase 4, así que su cobertura no
 * puede quedarse corta en silencio: quien añada un bloque de conocimiento y no
 * añada su pregunta dejaría la sonda igual de verde midiendo menos.
 *
 * También se comprueba aquí, sin red, que la pregunta de control de verdad cae
 * fuera del conocimiento curado: si un día el dominio se amplía hasta ella, el
 * control dejaría de probar lo que dice probar.
 */
import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BLOCKS, retrieveKnowledge } from "./_shared/knowledge";
import { KNOWLEDGE_SAMPLES } from "./telegram-webhook";

const blockIds = KNOWLEDGE_BLOCKS.map((block) => block.id);
const dominio = KNOWLEDGE_SAMPLES.filter((sample) => sample.expected !== null);
const control = KNOWLEDGE_SAMPLES.filter((sample) => sample.expected === null);

describe("sonda de conocimiento · cobertura", () => {
  it("cada bloque tiene su pregunta de dominio", () => {
    const preguntados = new Set(dominio.map((sample) => sample.expected));
    expect(blockIds.filter((id) => !preguntados.has(id))).toEqual([]);
  });

  it("ninguna pregunta de dominio espera un bloque que no existe", () => {
    const inventados = dominio
      .filter((sample) => !blockIds.includes(sample.expected as string))
      .map((sample) => sample.expected);
    expect(inventados).toEqual([]);
  });

  it("hay al menos una pregunta de control", () => {
    expect(control.length).toBeGreaterThanOrEqual(1);
  });

  it("el conocimiento no contesta la pregunta de control", () => {
    for (const sample of control) {
      expect(retrieveKnowledge(sample.question), sample.question).toBeNull();
    }
  });
});
