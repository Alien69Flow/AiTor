import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHOKEPOINTS,
  MILITARY_BASES,
  NUCLEAR_SITES,
  PIPELINES,
  UNDERSEA_CABLES,
  type GeoLine,
  type GeoPoint,
} from "./geo-datasets";
import { GLOBE_LAYERS } from "./globe-layers";

/**
 * Los registros estratégicos son datos, no lógica: un id duplicado, una
 * coordenada fuera de rango o un `path` de un solo punto no falla al compilar,
 * falla en silencio —el marcador simplemente no aparece— y el globo parece
 * vacío sin que nada avise. Estas comprobaciones cierran esa puerta.
 */

const POINT_SETS: { name: string; points: GeoPoint[]; layerKey: string }[] = [
  { name: "chokepoints", points: CHOKEPOINTS, layerKey: "chokepoints" },
  { name: "nuclear", points: NUCLEAR_SITES, layerKey: "nuclearSites" },
  { name: "military", points: MILITARY_BASES, layerKey: "militaryBases" },
];

const LINE_SETS: { name: string; lines: GeoLine[]; layerKey: string }[] = [
  { name: "cables", lines: UNDERSEA_CABLES, layerKey: "underseaCables" },
  { name: "pipelines", lines: PIPELINES, layerKey: "pipelines" },
];

const validLon = (lon: number) => Number.isFinite(lon) && lon >= -180 && lon <= 180;
const validLat = (lat: number) => Number.isFinite(lat) && lat >= -90 && lat <= 90;

describe("registros estratégicos del globo", () => {
  it.each(POINT_SETS)("$name: ids únicos y coordenadas en rango", ({ points }) => {
    const ids = points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const p of points) {
      expect(validLat(p.lat), `${p.id} lat ${p.lat}`).toBe(true);
      expect(validLon(p.lon), `${p.id} lon ${p.lon}`).toBe(true);
      // Un nombre o un detalle vacío deja un marcador anónimo en el mapa.
      expect(p.name.trim().length, `${p.id} sin nombre`).toBeGreaterThan(1);
      expect(p.detail.trim().length, `${p.id} sin detalle`).toBeGreaterThan(9);
    }
  });

  it.each(POINT_SETS)("$name: ningún sitio cae en el mismo punto que otro", ({ points }) => {
    const seen = new Set<string>();
    for (const p of points) {
      // Cuatro decimales ≈ 11 m: por debajo de eso dos instalaciones distintas
      // se dibujarían una encima de otra.
      const key = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
      expect(seen.has(key), `${p.id} duplica ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it.each(LINE_SETS)("$name: trazados con al menos dos puntos válidos", ({ lines }) => {
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const line of lines) {
      expect(line.name.trim().length, `${line.id} sin nombre`).toBeGreaterThan(1);
      expect(line.detail.trim().length, `${line.id} sin detalle`).toBeGreaterThan(9);
      expect(line.path.length, `${line.id} con ${line.path.length} puntos`).toBeGreaterThanOrEqual(2);

      for (const [lon, lat] of line.path) {
        expect(validLon(lon), `${line.id} lon ${lon}`).toBe(true);
        expect(validLat(lat), `${line.id} lat ${lat}`).toBe(true);
      }

      const first = line.path[0];
      const last = line.path[line.path.length - 1];
      expect(
        Math.abs(first[0] - last[0]) + Math.abs(first[1] - last[1]),
        `${line.id} empieza y acaba en el mismo punto`,
      ).toBeGreaterThan(0.01);
    }
  });

  /**
   * Los recuentos reales, no un mínimo simbólico: si un refactor recorta un
   * registro a la mitad, esto falla y obliga a decirlo en el mensaje del
   * cambio en vez de entregar un globo medio vacío.
   */
  it("mantiene la cobertura ampliada", () => {
    expect(CHOKEPOINTS.length).toBeGreaterThanOrEqual(28);
    expect(NUCLEAR_SITES.length).toBeGreaterThanOrEqual(85);
    expect(MILITARY_BASES.length).toBeGreaterThanOrEqual(78);
    expect(UNDERSEA_CABLES.length).toBeGreaterThanOrEqual(26);
    expect(PIPELINES.length).toBeGreaterThanOrEqual(26);
  });

  it.each([...POINT_SETS.map((s) => s.layerKey), ...LINE_SETS.map((s) => s.layerKey)])(
    "la capa %s existe en el catálogo, así que el globo la puede encender",
    (key) => {
      expect(GLOBE_LAYERS.some((layer) => layer.key === key)).toBe(true);
    },
  );
});

/**
 * Que los datos existan no significa que se pinten: el globo dibuja cada
 * registro dentro de su guarda de capa. Si alguien renombra una clave o quita
 * un `forEach`, el catálogo seguiría vendiendo la capa y el mapa quedaría
 * plano. Se comprueba sobre el propio componente.
 */
describe("el globo dibuja cada registro", () => {
  // vitest sirve los módulos con URLs virtuales, así que `import.meta.url` no
  // es un fichero: se lee desde la raíz del proyecto, que es el cwd del runner.
  const source = readFileSync(resolve(process.cwd(), "src/components/globe/CesiumGlobe.tsx"), "utf8");

  it.each([
    ["chokepoints", "CHOKEPOINTS"],
    ["nuclearSites", "NUCLEAR_SITES"],
    ["militaryBases", "MILITARY_BASES"],
    ["pipelines", "PIPELINES"],
  ])("la guarda de %s itera %s", (guard, array) => {
    expect(source).toContain(`active.has("${guard}")`);
    expect(source).toContain(`${array}.forEach`);
  });

  it("los cables estáticos son respaldo y no se apilan sobre TeleGeography", () => {
    // Con la geometría real cargada (220 sistemas) el catálogo debe callarse.
    expect(source).toContain('active.has("underseaCables") && !hasLiveCables');
    expect(source).toContain("UNDERSEA_CABLES.forEach");
  });

  it("la dependencia de los marcadores estáticos es estable", () => {
    // `cables` es `[]` nuevo en cada render: como dependencia, reconstruiría
    // los marcadores en bucle. El booleano sólo cambia cuando llegan datos.
    expect(source).toContain("const hasLiveCables = cables.length > 0;");
    expect(source).toContain("}, [envLayers, hasLiveCables]);");
  });
});
