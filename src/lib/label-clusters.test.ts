import { describe, expect, it } from "vitest";
import {
  CLUSTER_CELL_LADDER,
  CLUSTER_MIN_ALTITUDE_M,
  clusterCellDegrees,
  clusterMapLabels,
  visibleWidthDegrees,
  type MapLabelPoint,
} from "./label-clusters";
import { CHOKEPOINTS, MILITARY_BASES, NUCLEAR_SITES } from "./geo-datasets";

const strategic: MapLabelPoint[] = [
  ...CHOKEPOINTS.map((p) => ({ id: `choke-${p.id}`, lat: p.lat, lon: p.lon, icon: "⚓", name: p.name })),
  ...NUCLEAR_SITES.map((p) => ({ id: `nuke-${p.id}`, lat: p.lat, lon: p.lon, icon: "☢️", name: p.name })),
  ...MILITARY_BASES.map((p) => ({ id: `mil-${p.id}`, lat: p.lat, lon: p.lon, icon: "🛡️", name: p.name })),
];

describe("agrupación por zoom", () => {
  it("no agrupa a la altura de una ciudad", () => {
    expect(clusterCellDegrees(2_000)).toBe(0);
    expect(clusterCellDegrees(CLUSTER_MIN_ALTITUDE_M)).toBe(0);
    expect(clusterMapLabels(strategic, 0)).toHaveLength(strategic.length);
  });

  it("crece con la altura y termina en el escalón más grande", () => {
    const heights = [200_000, 600_000, 1_500_000, 4_000_000, 8_000_000, 20_000_000, 60_000_000];
    const cells = heights.map(clusterCellDegrees);
    for (let index = 1; index < cells.length; index++) {
      expect(cells[index]).toBeGreaterThanOrEqual(cells[index - 1]);
    }
    expect(cells.at(-1)).toBe(CLUSTER_CELL_LADDER.at(-1));
  });

  it("separa lo suficiente a 20 000 km para que no se pisen las etiquetas", () => {
    const altitude = 20_000_000;
    const cell = clusterCellDegrees(altitude);
    const groups = clusterMapLabels(strategic, cell);

    // La vista completa abarca ~152° y en 1 500 px son ~10 px por grado: una
    // celda de 16° mide ~158 px, más que el ancho de una etiqueta de 10 px de
    // monoespaciado. Antes había 197 etiquetas en ese mismo espacio.
    const cellPixels = (cell / visibleWidthDegrees(altitude)) * 1500;
    expect(cellPixels).toBeGreaterThan(140);
    expect(groups.length).toBeLessThan(strategic.length / 2);
    expect(groups.length).toBeGreaterThan(strategic.length / 6);
  });

  it("no pierde ni repite ningún sitio", () => {
    const cell = clusterCellDegrees(20_000_000);
    const groups = clusterMapLabels(strategic, cell);
    const seen = groups.flatMap((group) => (group.kind === "point" ? [group.point.id] : group.members.map((m) => m.id)));
    expect(seen).toHaveLength(strategic.length);
    expect(new Set(seen).size).toBe(strategic.length);
  });

  it("una celda con un solo sitio conserva su nombre", () => {
    const groups = clusterMapLabels(strategic, 1);
    const singles = groups.filter((group) => group.kind === "point");
    expect(singles.length).toBeGreaterThan(0);
    for (const group of singles) expect(group.kind === "point" && group.point.name).toBeTruthy();
  });

  it("el grupo cae dentro de su propia celda", () => {
    const cell = 8;
    for (const group of clusterMapLabels(strategic, cell)) {
      if (group.kind !== "cluster") continue;
      const memberCells = new Set(group.members.map((m) => `${Math.floor(m.lat / cell)}:${Math.floor(m.lon / cell)}`));
      expect(memberCells.size).toBe(1);
    }
  });

  it("es estable: el mismo zoom da el mismo orden", () => {
    const first = clusterMapLabels(strategic, 16).map((group) => group.kind === "cluster" ? group.id : group.point.id);
    const second = clusterMapLabels(strategic, 16).map((group) => group.kind === "cluster" ? group.id : group.point.id);
    expect(second).toEqual(first);
  });

  it("descarta coordenadas imposibles en vez de dibujarlas en el golfo de Guinea", () => {
    const groups = clusterMapLabels(
      [
        { id: "ok", lat: 40, lon: -3, icon: "☢️", name: "Bien" },
        { id: "roto", lat: Number.NaN, lon: 10, icon: "☢️", name: "Roto" },
      ],
      8,
    );
    const ids = groups.flatMap((group) => (group.kind === "point" ? [group.point.id] : group.members.map((m) => m.id)));
    expect(ids).toEqual(["ok"]);
  });

  it("el ancho visible es el doble del ángulo al horizonte", () => {
    expect(visibleWidthDegrees(0)).toBe(0);
    // Desde la órbita geoestacionaria se ve casi un hemisferio entero: el
    // ángulo al horizonte es de ~81°, así que la vista abarca ~162°.
    expect(visibleWidthDegrees(35_786_000)).toBeGreaterThan(158);
    expect(visibleWidthDegrees(35_786_000)).toBeLessThan(166);
  });
});
