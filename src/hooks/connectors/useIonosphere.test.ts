import { describe, expect, it } from "vitest";
import { stampFor } from "./useIonosphere";

/**
 * El fallo original de esta capa no era de datos: era el nombre del fichero.
 * Se pedían bloques al minuto 0 (`…T153000Z`) y SWPC los publica al minuto 5
 * (`…T153500Z`), así que las ocho intentonas daban 404 y la capa se quedaba
 * vacía sin decir por qué. Estos casos fijan esa regla.
 */
describe("nombre de bloque de GLOTEC", () => {
  const cases: [string, string][] = [
    // Un instante cualquiera cae en el bloque abierto más reciente, que empieza
    // cinco minutos antes del múltiplo de diez.
    ["2026-10-27T16:03:00Z", "20261027T155500Z"],
    ["2026-10-27T15:55:00Z", "20261027T155500Z"],
    ["2026-10-27T15:59:59Z", "20261027T155500Z"],
    ["2026-10-27T16:04:59Z", "20261027T155500Z"],
    // Al cruzar el múltiplo de diez, el bloque salta al siguiente.
    ["2026-10-27T15:05:00Z", "20261027T150500Z"],
    ["2026-10-27T15:04:59Z", "20261027T145500Z"],
    // El minuto va con dos dígitos siempre.
    ["2026-10-27T09:07:00Z", "20261027T090500Z"],
  ];

  it.each(cases)("%s → %s", (iso, expected) => {
    expect(stampFor(Date.parse(iso))).toBe(expected);
  });

  it("nunca devuelve un minuto redondo de diez", () => {
    for (let minute = 0; minute < 60; minute++) {
      const ms = Date.parse(`2026-10-27T16:${String(minute).padStart(2, "0")}:00Z`);
      const stamp = stampFor(ms);
      expect(["05", "15", "25", "35", "45", "55"], stamp).toContain(stamp.slice(11, 13));
    }
  });
});
