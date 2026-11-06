import { describe, expect, it } from "vitest";
import { GAMMA_IRRADIATORS } from "./gamma-irradiators";
import { GLOBE_LAYERS } from "./globe-layers";

/**
 * El catálogo se genera desde el volcado de la IAEA y se valida con
 * OpenStreetMap, así que estas pruebas vigilan las dos cosas que pueden
 * romperse sin que nadie mire: que el fichero generado siga siendo coherente y
 * que la capa siga estando en la leyenda.
 *
 * El fallo que motivó reconstruirlo fue de alineación: el volcado trae 136
 * pares de coordenadas y 124 nombres distintos, y emparejarlos por índice ponía
 * a Abuja en Túnez. Por eso la prueba comprueba ciudades concretas cuyo país es
 * inequívoco, no solo que las coordenadas estén en rango.
 */
describe("plantas de irradiación gamma", () => {
  it("publica un catálogo amplio pero no el volcado entero", () => {
    expect(GAMMA_IRRADIATORS.length).toBeGreaterThanOrEqual(120);
    // 136 pares en el volcado: si salen todos, no se validó nada.
    expect(GAMMA_IRRADIATORS.length).toBeLessThan(136);
  });

  it("cada fila tiene ciudad, país y coordenadas dentro del planeta", () => {
    for (const row of GAMMA_IRRADIATORS) {
      expect(row.city.trim().length).toBeGreaterThan(1);
      expect(row.country.trim().length).toBeGreaterThan(1);
      expect(Math.abs(row.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(row.lon)).toBeLessThanOrEqual(180);
    }
  });

  it("no repite coordenadas ni identificadores", () => {
    const ids = new Set(GAMMA_IRRADIATORS.map((r) => r.id));
    const places = new Set(GAMMA_IRRADIATORS.map((r) => `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`));
    expect(ids.size).toBe(GAMMA_IRRADIATORS.length);
    expect(places.size).toBe(GAMMA_IRRADIATORS.length);
  });

  it("no deja filas del volcado mal alineadas: Abuja no está en Túnez", () => {
    // Las tres filas que la versión anterior del fork publicaba corridas.
    const abuja = GAMMA_IRRADIATORS.filter((r) => /abuja/i.test(r.city));
    const accra = GAMMA_IRRADIATORS.filter((r) => /accra/i.test(r.city));
    const tunisia = GAMMA_IRRADIATORS.filter((r) => r.country === "Tunisia");

    if (abuja.length) {
      expect(abuja.every((r) => r.country === "Nigeria")).toBe(true);
      expect(abuja.every((r) => r.lat > 8 && r.lat < 10)).toBe(true);
    }
    if (accra.length) {
      expect(accra.every((r) => r.country === "Ghana")).toBe(true);
      expect(accra.every((r) => r.lat > 5 && r.lat < 6)).toBe(true);
    }
    // La fila tunecina está en Túnez, no en la latitud de Abuja.
    expect(tunisia.every((r) => r.lat > 35 && r.lat < 38)).toBe(true);
  });

  it("coincide con lo que declara la IAEA a menos de 250 km", () => {
    for (const row of GAMMA_IRRADIATORS) {
      if (row.declaredKm === null) continue;
      expect(row.declaredKm).toBeLessThanOrEqual(250);
    }
  });

  it("la capa existe en la leyenda y es de infraestructura estratégica", () => {
    const layer = GLOBE_LAYERS.find((l) => l.key === "gammaIrradiators");
    expect(layer).toBeDefined();
    expect(layer?.group).toBe("Strategic Infrastructure");
    expect(layer?.source).toMatch(/IAEA/);
  });
});
