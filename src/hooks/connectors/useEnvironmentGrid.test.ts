import { describe, expect, it } from "vitest";
import { ENV_PLACES } from "./useEnvironmentGrid";
import { dryingIndex, dominantPollen, pollenLevel, seaFlag } from "@/lib/environment-metrics";
import { layerDef } from "@/lib/globe-layers";

/**
 * Las cuatro medidas de la rejilla ambiental son convenciones, no lecturas: el
 * índice de secado pesa humedad, viento y temperatura; la bandera sale del
 * oleaje; el nivel de polen, de granos/m³. Si alguien cambia un umbral, que se
 * vea aquí y no en el globo.
 */
describe("índice de secado", () => {
  it("con lluvia no seca nada, aunque haga sol y viento", () => {
    expect(
      dryingIndex({ temperatureC: 30, humidityPercent: 20, windKmh: 30, precipitationMm: 0.5 }),
    ).toBe(0);
  });

  it("seco, cálido y con viento se acerca al máximo", () => {
    const index = dryingIndex({
      temperatureC: 32,
      humidityPercent: 15,
      windKmh: 40,
      precipitationMm: 0,
    });
    expect(index).toBeGreaterThanOrEqual(90);
    expect(index).toBeLessThanOrEqual(100);
  });

  it("frío, húmedo y en calma no pasa de seco a medias", () => {
    const index = dryingIndex({
      temperatureC: 8,
      humidityPercent: 95,
      windKmh: 0,
      precipitationMm: 0,
    });
    expect(index).toBeLessThanOrEqual(10);
  });

  it("nunca se sale de 0-100 con entradas raras", () => {
    for (const input of [
      { temperatureC: -40, humidityPercent: 100, windKmh: 200, precipitationMm: 0 },
      { temperatureC: 60, humidityPercent: 0, windKmh: -10, precipitationMm: 0 },
    ]) {
      const index = dryingIndex(input);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(100);
    }
  });
});

describe("bandera de baño", () => {
  it("sube con el oleaje", () => {
    expect(seaFlag(0.4)).toBe("verde");
    expect(seaFlag(1.2)).toBe("amarilla");
    expect(seaFlag(2.6)).toBe("roja");
  });

  it("sin medida no promete baño tranquilo", () => {
    expect(seaFlag(Number.NaN)).toBe("amarilla");
  });
});

describe("nivel de polen", () => {
  it("traduce granos/m³ a los cuatro niveles", () => {
    expect(pollenLevel(null)).toBe(0);
    expect(pollenLevel(0.4)).toBe(0);
    expect(pollenLevel(5)).toBe(1);
    expect(pollenLevel(30)).toBe(2);
    expect(pollenLevel(120)).toBe(3);
  });

  it("elige la especie dominante y descarta los huecos de CAMS", () => {
    const dominante = dominantPollen({
      grass_pollen: 12,
      olive_pollen: 60,
      birch_pollen: null,
      alder_pollen: null,
      ragweed_pollen: null,
    });
    expect(dominante).toEqual({ species: "olivo", grains: 60, level: 3 });

    // Fuera de Europa CAMS devuelve null en las cinco: el punto no se pinta.
    expect(
      dominantPollen({
        grass_pollen: null,
        olive_pollen: null,
        birch_pollen: null,
        alder_pollen: null,
        ragweed_pollen: null,
      }),
    ).toBeNull();
  });
});

describe("rejilla de lugares", () => {
  it("no repite identificadores y usa coordenadas válidas", () => {
    const ids = ENV_PLACES.map((place) => place.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const place of ENV_PLACES) {
      expect(place.lat).toBeGreaterThanOrEqual(-90);
      expect(place.lat).toBeLessThanOrEqual(90);
      expect(place.lon).toBeGreaterThanOrEqual(-180);
      expect(place.lon).toBeLessThanOrEqual(180);
      expect(place.name.length).toBeGreaterThan(1);
    }
  });

  it("tiene costa y estaciones, que son las que alimentan mar y nieve", () => {
    expect(ENV_PLACES.filter((place) => place.kind === "coast").length).toBeGreaterThan(8);
    expect(ENV_PLACES.filter((place) => place.kind === "ski").length).toBeGreaterThan(8);
  });
});

describe("catálogo de las capas nuevas", () => {
  it("las cuatro existen, son públicas y declaran su fuente", () => {
    for (const key of ["dryingIndex", "seaState", "snowDepth", "pollen"] as const) {
      const def = layerDef(key);
      expect(def, key).toBeDefined();
      expect(def!.requiredTier, key).toBe("signal");
      expect(def!.source, key).toBeTruthy();
      expect(def!.description, key).toBeTruthy();
    }
  });
});
