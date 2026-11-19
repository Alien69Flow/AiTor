import { describe, expect, it } from "vitest";
import {
  compassOf,
  formatHeight,
  formatSpeed,
  num,
  readingOf,
  readSeries,
  snapshotAt,
  TIDE_STATIONS,
  type TideStation,
} from "./tides";

const STATION: TideStation = { id: "x", name: "Prueba", region: "test", lat: 0, lon: 0 };

/** Serie de 24 h con dos extremos claros: sube hasta las 06:00 y baja hasta las 18:00. */
function series(patch: { height?: (number | null)[] } = {}) {
  const time = Array.from({ length: 24 }, (_, hour) => `2026-11-19T${String(hour).padStart(2, "0")}:00`);
  const shape = [
    0.0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0, 0.9, 0.7, 0.5, 0.3, 0.1,
    -0.1, -0.4, -0.6, -0.8, -0.9, -1.0, -0.9, -0.7, -0.5, -0.3, -0.1, 0.1,
  ];
  return {
    hourly: {
      time,
      sea_level_height_msl: patch.height ?? shape,
      ocean_current_velocity: shape.map(() => 1.2),
      ocean_current_direction: shape.map(() => 290),
    },
  };
}

describe("num / formatHeight", () => {
  it("no convierte lo que no es número en cero", () => {
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num(Number.NaN)).toBeNull();
    expect(num("1.5")).toBeNull();
    expect(num(0)).toBe(0);
  });

  it("dice «sin dato» en vez de inventar una altura", () => {
    expect(formatHeight(null)).toBe("sin dato");
    expect(formatHeight(0.42)).toBe("+0.42 m");
    expect(formatHeight(-1.1)).toBe("-1.10 m");
  });

  it("una corriente desconocida no es 0.0 km/h", () => {
    expect(formatSpeed(null)).toBe("sin dato");
    expect(formatSpeed(1.04)).toBe("1.0 km/h");
    expect(formatSpeed(0)).toBe("0.0 km/h");
  });
});

describe("readSeries", () => {
  it("lee la serie horaria de Open-Meteo", () => {
    const read = readSeries(series());
    expect(read?.time).toHaveLength(24);
    expect(read?.height[6]).toBe(1);
  });

  it("una respuesta sin hourly no se inventa", () => {
    expect(readSeries(null)).toBeNull();
    expect(readSeries({})).toBeNull();
    expect(readSeries({ hourly: { time: [] } })).toBeNull();
  });

  it("conserva los huecos como null", () => {
    const read = readSeries(series({ height: [null, 0.1] }));
    expect(read?.height[0]).toBeNull();
    expect(read?.height[1]).toBe(0.1);
  });
});

describe("snapshotAt", () => {
  it("da altura de la hora en curso, tendencia y próxima pleamar", () => {
    const read = readSeries(series());
    const now = snapshotAt(read, "2026-11-19T04:10:00.000Z");

    expect(now.heightM).toBe(0.8);
    expect(now.trend).toBe("subiendo");
    expect(now.next).toEqual({
      kind: "pleamar",
      heightM: 1,
      atIso: "2026-11-19T06:00:00.000Z",
    });
  });

  it("encuentra la bajamar cuando ya pasó la pleamar", () => {
    const read = readSeries(series());
    const bajamar = snapshotAt(read, "2026-11-19T10:00:00.000Z");

    expect(bajamar.trend).toBe("bajando");
    expect(bajamar.next?.kind).toBe("bajamar");
    expect(bajamar.next?.atIso).toBe("2026-11-19T17:00:00.000Z");
  });

  it("sin serie o sin valores devuelve null, no cero", () => {
    expect(snapshotAt(null, "2026-11-19T04:00:00.000Z")).toEqual({
      heightM: null,
      trend: null,
      next: null,
    });
    const vacia = readSeries(series({ height: Array.from({ length: 24 }, () => null) }));
    expect(snapshotAt(vacia, "2026-11-19T04:00:00.000Z").heightM).toBeNull();
  });
});

describe("readingOf", () => {
  it("marca el punto como no cubierto cuando todo viene null (tierra adentro)", () => {
    const inland = series({ height: Array.from({ length: 24 }, () => null) });
    const reading = readingOf(STATION, inland, "2026-11-19T12:00:00.000Z");

    expect(reading.covered).toBe(false);
    expect(reading.heightM).toBeNull();
    expect(reading.next).toBeNull();
  });

  it("marca cubierto cuando hay altura", () => {
    const reading = readingOf(STATION, series(), "2026-11-19T12:00:00.000Z");
    expect(reading.covered).toBe(true);
    expect(reading.currentKmh).toBe(1.2);
    expect(reading.currentDirectionDeg).toBe(290);
  });
});

describe("compassOf", () => {
  it("traduce grados a rumbo y admite vueltas y negativos", () => {
    expect(compassOf(0)).toBe("N");
    expect(compassOf(90)).toBe("E");
    expect(compassOf(290)).toBe("ONO");
    expect(compassOf(360)).toBe("N");
    expect(compassOf(-90)).toBe("O");
    expect(compassOf(null)).toBeNull();
  });
});

describe("estaciones", () => {
  it("son únicas y están en el mar", () => {
    const ids = TIDE_STATIONS.map((station) => station.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TIDE_STATIONS.length).toBeGreaterThanOrEqual(20);
    for (const station of TIDE_STATIONS) {
      expect(Math.abs(station.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(station.lon)).toBeLessThanOrEqual(180);
    }
  });
});
