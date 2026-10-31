import { describe, expect, it } from "vitest";
import { countByCountry } from "./bitnodes";

const snapshot = (nodes: Record<string, unknown>) => ({ data: { nodes } });

describe("recuento de nodos Bitcoin por país", () => {
  it("cuenta por país y ordena de mayor a menor", () => {
    const { total, countries } = countByCountry(
      snapshot({
        "1.1.1.1:8333": { version: "/Satoshi:27.0.0/", country: "US" },
        "1.1.1.2:8333": { version: "/Satoshi:27.0.0/", country: "US" },
        "1.1.1.3:8333": { version: "/Satoshi:27.0.0/", country: "ES" },
      }),
    );
    expect(total).toBe(3);
    expect(countries).toEqual([
      { code: "US", count: 2 },
      { code: "ES", count: 1 },
    ]);
  });

  it("suma al total los nodos sin país, pero no les da marcador", () => {
    const { total, countries } = countByCountry(
      snapshot({
        "1.1.1.1:8333": { version: "/Satoshi:27.0.0/" },
        "1.1.1.2:8333": { version: "/Satoshi:27.0.0/", country: "" },
        "1.1.1.3:8333": { version: "/Satoshi:27.0.0/", country: "onion" },
      }),
    );
    expect(total).toBe(3);
    expect(countries).toEqual([]);
  });

  it("normaliza el código a mayúsculas y descarta lo que no es un país", () => {
    const { countries } = countByCountry(
      snapshot({
        "1.1.1.1:8333": { country: "es" },
        "1.1.1.2:8333": { country: " ESPAÑA " },
        "1.1.1.3:8333": { country: 42 },
      }),
    );
    expect(countries).toEqual([{ code: "ES", count: 1 }]);
  });

  it("una respuesta con otra forma no rompe", () => {
    expect(countByCountry(null)).toEqual({ total: 0, countries: [] });
    expect(countByCountry({})).toEqual({ total: 0, countries: [] });
    expect(countByCountry({ data: { nodes: [] } })).toEqual({ total: 0, countries: [] });
  });
});
