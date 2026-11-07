import { describe, expect, it } from "vitest";
import { clusterGeoMarkers } from "./marker-clusters";

const at = (id: string, lat: number, lon: number) => ({ id, lat, lon });

describe("agrupación de marcadores vivos por zoom", () => {
  it("de cerca no agrupa: cada marcador conserva su sitio", () => {
    const groups = clusterGeoMarkers([at("a", 40.4, -3.7), at("b", 40.5, -3.6)], 0);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.kind === "single")).toBe(true);
  });

  it("junta en una celda los que caen dentro y respeta la cuenta", () => {
    const groups = clusterGeoMarkers(
      [at("a", 40.4, -3.7), at("b", 40.5, -3.6), at("c", 41.3, -0.9)],
      2,
    );
    const clusters = groups.filter((group) => group.kind === "cluster");
    const singles = groups.filter((group) => group.kind === "single");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind === "cluster" && clusters[0].items).toHaveLength(2);
    expect(singles).toHaveLength(1);
  });

  it("el grupo cae en el centro de sus miembros", () => {
    // Celda de 8°: (10, 20) y (13, 22) caen en la misma.
    const groups = clusterGeoMarkers([at("a", 10, 20), at("b", 13, 22)], 8);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind === "cluster" && groups[0].lat).toBeCloseTo(11.5, 6);
    expect(groups[0].kind === "cluster" && groups[0].lon).toBeCloseTo(21, 6);
  });

  it("al ampliar el tamaño de celda se juntan más marcadores", () => {
    const points = [at("a", 10, 20), at("b", 12, 24), at("c", 30, 40)];
    const fine = clusterGeoMarkers(points, 1);
    const rough = clusterGeoMarkers(points, 16);
    expect(fine).toHaveLength(3);
    expect(rough.length).toBeLessThan(fine.length);
  });

  it("descarta coordenadas inválidas en vez de pintarlas en (0,0)", () => {
    const groups = clusterGeoMarkers(
      [at("a", Number.NaN, 0), at("b", 10, Number.POSITIVE_INFINITY), at("c", 1, 2)],
      2,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].kind === "single" && groups[0].item.id).toBe("c");
  });

  it("el orden es estable entre repintados con el mismo zoom", () => {
    const points = [at("a", 10, 20), at("b", 40, -3), at("c", -20, 130)];
    const first = clusterGeoMarkers(points, 8).map((group) =>
      group.kind === "single" ? group.item.id : group.id,
    );
    const second = clusterGeoMarkers([...points].reverse(), 8).map((group) =>
      group.kind === "single" ? group.item.id : group.id,
    );
    // Los miembros del grupo pueden cambiar de orden, pero los grupos no.
    expect(first).toEqual(second);
  });

  it("una lista vacía no produce grupos", () => {
    expect(clusterGeoMarkers([], 4)).toEqual([]);
  });
});
