import { describe, expect, it } from "vitest";
import {
  CONFLICT_THEME,
  conflictProxyUrl,
  mapGkgConflictGeoJson,
  severityFromTone,
} from "./conflict-events";

/**
 * La capa de conflictos se alimenta del GKG v1 de GDELT, el único endpoint
 * geolocalizado que sigue vivo (`DOC 2.0` no acepta geojson y `GEO 2.0` da 404).
 *
 * Lo que fijan estas pruebas, con la forma real del feed:
 *  - un punto por lugar, quedándose con la mención más reciente;
 *  - coordenadas imposibles y lugares sin nombre fuera;
 *  - la gravedad sale del tono, no de bajas que la fuente no da;
 *  - el navegador pide `/api/gdelt` con el tema y la ventana, no GDELT a pelo.
 */

const feature = (name: string, lat: number, lon: number, date: string, tone?: number) => ({
  geometry: { type: "Point", coordinates: [lon, lat] as [number, number] },
  properties: {
    name,
    url: `https://medio.example/${encodeURIComponent(name)}`,
    domain: "medio.example",
    urlpubtimedate: date,
    ...(tone === undefined ? {} : { urltone: tone }),
  },
});

describe("traducción del GeoJSON del GKG", () => {
  it("convierte cada lugar en un evento con coordenadas y enlace", () => {
    const events = mapGkgConflictGeoJson({
      features: [feature("Kyiv", 50.45, 30.52, "2026-11-07T19:00:00Z", -12)],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      location: "Kyiv",
      lat: 50.45,
      lon: 30.52,
      domain: "medio.example",
      date: "2026-11-07T19:00:00Z",
      kind: "other",
      severity: "HIGH",
    });
    expect(events[0].url).toContain("Kyiv");
    expect(events[0].title).toContain("Kyiv");
  });

  it("deja un solo punto por lugar y se queda la mención más reciente", () => {
    const events = mapGkgConflictGeoJson({
      features: [
        feature("Kyiv", 50.45, 30.52, "2026-11-07T10:00:00Z"),
        feature("Kyiv", 50.45, 30.52, "2026-11-07T20:00:00Z"),
        feature("Kharkiv", 49.99, 36.23, "2026-11-07T12:00:00Z"),
      ],
    });
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.location === "Kyiv")?.date).toBe("2026-11-07T20:00:00Z");
  });

  it("descarta coordenadas imposibles y lugares sin nombre", () => {
    const events = mapGkgConflictGeoJson({
      features: [
        feature("", 10, 10, "2026-11-07T10:00:00Z"),
        feature("Mar", 120, 10, "2026-11-07T10:00:00Z"),
        feature("Tierra", 10, 300, "2026-11-07T10:00:00Z"),
        { properties: { name: "Sin geometría" } },
        feature("Kyiv", 50.45, 30.52, "2026-11-07T20:00:00Z"),
      ],
    });
    expect(events.map((event) => event.location)).toEqual(["Kyiv"]);
  });

  it("pone primero lo más grave", () => {
    const events = mapGkgConflictGeoJson({
      features: [
        feature("Calma", 1, 1, "2026-11-07T10:00:00Z", 1),
        feature("Grave", 2, 2, "2026-11-07T10:00:00Z", -14),
        feature("Media", 3, 3, "2026-11-07T10:00:00Z", -7),
      ],
    });
    expect(events.map((event) => event.severity)).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("un lugar sin tono no se disfraza de grave", () => {
    expect(mapGkgConflictGeoJson({ features: [feature("Sin tono", 1, 1, "2026-11-07T10:00:00Z")] })[0].severity).toBe(
      "MEDIUM",
    );
  });

  it("acepta respuestas vacías sin romperse", () => {
    expect(mapGkgConflictGeoJson(null)).toEqual([]);
    expect(mapGkgConflictGeoJson({})).toEqual([]);
    expect(mapGkgConflictGeoJson({ features: [] })).toEqual([]);
  });
});

describe("gravedad por tono", () => {
  it("usa los umbrales documentados", () => {
    expect(severityFromTone(-10)).toBe("HIGH");
    expect(severityFromTone(-5)).toBe("MEDIUM");
    expect(severityFromTone(-4.9)).toBe("LOW");
    expect(severityFromTone(null)).toBe("MEDIUM");
  });
});

describe("destino de la petición", () => {
  it("el navegador pide al proxy con el tema y la ventana", () => {
    const proxy = new URL(conflictProxyUrl(12, 250), "https://aitor.alienflow.space");
    expect(proxy.pathname).toBe("/api/gdelt");
    expect(proxy.searchParams.get("theme")).toBe(CONFLICT_THEME);
    expect(proxy.searchParams.get("hours")).toBe("12");
    expect(proxy.searchParams.get("maxrows")).toBe("250");
  });
});
