import { describe, expect, it } from "vitest";
import { classifyConflict, conflictDocUrl, mapConflictGeoJson } from "./conflict-events";

describe("clasificación de sucesos de conflicto", () => {
  it("reconoce los tipos que pinta el globo", () => {
    expect(classifyConflict("Russian airstrike hits power grid in Kharkiv").kind).toBe("airstrike");
    expect(classifyConflict("Artillery shelling kills three in Donetsk").kind).toBe("shelling");
    expect(classifyConflict("Drone strike targets base near Sevastopol").kind).toBe("drone");
    expect(classifyConflict("Clashes erupt along the border").kind).toBe("clashes");
    expect(classifyConflict("Explosion reported at airport depot").kind).toBe("explosion");
  });

  it("sube la gravedad cuando hay muertos", () => {
    expect(classifyConflict("Shelling kills nine civilians in market").severity).toBe("HIGH");
    expect(classifyConflict("Clashes reported near the buffer zone").severity).toBe("MEDIUM");
  });

  it("no convierte una noticia diplomática en un conflicto", () => {
    // La capa pinta violencia; sin violencia no hay marcador.
    expect(classifyConflict("Peace talks resume in Geneva").kind).toBe("other");
    expect(classifyConflict("Minister announces ceasefire summit").kind).toBe("other");
  });

  it("descarta el mismo suceso repetido y las coordenadas imposibles", () => {
    const json = {
      features: [
        {
          properties: { name: "Kyiv", html: '<a href="https://a.example/1">Airstrike hits district in Kyiv</a>', domain: "a.example", seendate: "20261030T101500Z" },
          geometry: { coordinates: [30.52, 50.45] as [number, number] },
        },
        {
          // Mismo titular en otro medio: una sola chincheta.
          properties: { name: "Kyiv", html: '<a href="https://b.example/2">Airstrike hits district in Kyiv</a>', domain: "b.example" },
          geometry: { coordinates: [30.52, 50.45] as [number, number] },
        },
        {
          // Sin violencia explícita.
          properties: { name: "Paris", html: '<a href="https://c.example/3">Talks resume</a>' },
          geometry: { coordinates: [2.35, 48.85] as [number, number] },
        },
        {
          properties: { name: "Nowhere", html: '<a href="https://d.example/4">Shelling reported</a>' },
          geometry: { coordinates: [Number.NaN, 10] as [number, number] },
        },
      ],
    };

    const events = mapConflictGeoJson(json);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ lat: 50.45, lon: 30.52, kind: "airstrike", url: "https://a.example/1" });
  });

  it("pone primero lo más grave", () => {
    const json = {
      features: [
        { properties: { name: "A", html: "<a href='u1'>Clashes near the border</a>" }, geometry: { coordinates: [1, 1] as [number, number] } },
        { properties: { name: "B", html: "<a href='u2'>Airstrike kills twelve civilians</a>" }, geometry: { coordinates: [2, 2] as [number, number] } },
      ],
    };
    expect(mapConflictGeoJson(json).map((event) => event.severity)).toEqual(["HIGH", "MEDIUM"]);
  });

  it("acepta respuestas vacías sin romperse", () => {
    expect(mapConflictGeoJson(null)).toEqual([]);
    expect(mapConflictGeoJson({})).toEqual([]);
    expect(mapConflictGeoJson({ features: [] })).toEqual([]);
  });

  it("construye la consulta contra la API de GDELT", () => {
    const url = new URL(conflictDocUrl(48, 80));
    expect(url.origin + url.pathname).toBe("https://api.gdeltproject.org/api/v2/doc/doc");
    expect(url.searchParams.get("format")).toBe("geojson");
    expect(url.searchParams.get("timespan")).toBe("48h");
    expect(url.searchParams.get("maxrecords")).toBe("80");
    expect(url.searchParams.get("query")).toContain("airstrike");
  });
});
