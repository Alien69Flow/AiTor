import { describe, expect, it } from "vitest";
import { beltLevel, latestElectronFlux } from "./useVanAllenBelts";

/**
 * Lo que se prueba aquí son las dos decisiones que no se ven en el globo: qué
 * flujo se considera alto (umbrales NOAA de electrones >2 MeV) y qué fila de
 * GOES es la última cuando la flota publica en dos energías y dos satélites.
 */
describe("nivel del cinturón exterior", () => {
  it("aplica los umbrales de NOAA a los electrones >2 MeV", () => {
    expect(beltLevel(0)).toBe("quiet");
    expect(beltLevel(999)).toBe("quiet");
    expect(beltLevel(1_000)).toBe("elevated");
    expect(beltLevel(9_999)).toBe("elevated");
    expect(beltLevel(10_000)).toBe("high");
    expect(beltLevel(99_999)).toBe("high");
    expect(beltLevel(100_000)).toBe("extreme");
  });

  it("un flujo que no es un número no se convierte en riesgo", () => {
    expect(beltLevel(Number.NaN)).toBe("quiet");
  });
});

describe("lectura del fichero de GOES", () => {
  const row = (time_tag: string, satellite: number, flux: number, energy = ">=2 MeV") => ({
    time_tag,
    satellite,
    flux,
    energy,
  });

  it("elige el instante más reciente y no la última fila del fichero", () => {
    const result = latestElectronFlux([
      row("2026-10-27T16:30:00Z", 19, 2000),
      row("2026-10-27T16:50:00Z", 19, 4000),
      // Una fila vieja al final: el orden del fichero no es la garantía.
      row("2026-10-27T15:00:00Z", 19, 90_000),
    ]);
    expect(result?.measuredAt).toBe("2026-10-27T16:50:00Z");
    expect(result?.electronFlux).toBe(4000);
    expect(result?.level).toBe("elevated");
  });

  it("promedia los satélites del mismo instante y los cuenta", () => {
    const result = latestElectronFlux([
      row("2026-10-27T16:50:00Z", 19, 10_000),
      row("2026-10-27T16:50:00Z", 18, 20_000),
    ]);
    expect(result?.electronFlux).toBe(15_000);
    expect(result?.satellites).toBe(2);
    expect(result?.satellite).toBe(19);
  });

  it("ignora otras energías y los valores no numéricos", () => {
    const result = latestElectronFlux([
      row("2026-10-27T16:50:00Z", 19, 9_999_999, ">=0.8 MeV"),
      row("2026-10-27T16:50:00Z", 19, Number.NaN),
      row("2026-10-27T16:30:00Z", 19, 1500),
    ]);
    expect(result?.measuredAt).toBe("2026-10-27T16:30:00Z");
    expect(result?.electronFlux).toBe(1500);
    expect(result?.satellites).toBe(1);
  });

  it("sin filas válidas devuelve null en vez de un cero con aspecto de medida", () => {
    expect(latestElectronFlux([])).toBeNull();
    expect(latestElectronFlux([row("2026-10-27T16:50:00Z", 19, 5, ">=0.8 MeV")])).toBeNull();
  });
});
