import { describe, expect, it } from "vitest";
import {
  isFabricatedId,
  mapAdsbAircraft,
  mapOpenSkyStates,
  normaliseHeading,
  normaliseSpeed,
} from "./traffic";

/**
 * El proxy convierte dos formatos ajenos (adsb.lol y OpenSky) en la forma que ya
 * consume el globo. Las pruebas usan filas con la forma real de cada API, no
 * inventadas a gusto: si el mapeo se rompe, los aviones se caen de la capa.
 */

describe("mapeo de adsb.lol", () => {
  it("convierte pies a metros y nudos a m/s", () => {
    const [flight] = mapAdsbAircraft([
      { hex: "4d00f3", flight: "LGL972  ", t: "B738", alt_baro: 36000, gs: 421.4, track: 215.2, lat: 49.1, lon: 6.2 },
    ]);
    expect(flight.icao24).toBe("4d00f3");
    expect(flight.callsign).toBe("LGL972");
    expect(flight.aircraftType).toBe("B738");
    expect(flight.altitude).toBe(10_973); // 36 000 ft
    expect(flight.velocity).toBe(217); // 421,4 kt
    expect(flight.heading).toBe(215);
  });

  it("descarta aeronaves sin posición y las inventadas", () => {
    const flights = mapAdsbAircraft([
      { hex: "abc123", lat: undefined, lon: undefined },
      { hex: "mock0042", lat: 40, lon: -3 },
      { hex: "4ca853", lat: 41.2, lon: 2.1, alt_baro: 12000, gs: 250, track: 90 },
    ]);
    expect(flights).toHaveLength(1);
    expect(flights[0].icao24).toBe("4ca853");
  });

  it("admite alt_baro como texto («ground») sin romper la altitud", () => {
    const [flight] = mapAdsbAircraft([
      { hex: "abc999", lat: 40.1, lon: -3.2, alt_baro: "ground", alt_geom: 300, gs: 12, track: 0 },
    ]);
    expect(flight.altitude).toBe(91); // usa alt_geom cuando alt_baro no es número
  });
});

describe("mapeo de OpenSky", () => {
  it("lee las columnas posicionales y salta las filas sin lat/lon", () => {
    const flights = mapOpenSkyStates([
      ["39de58", "TVF97UY ", "France", 1793366829, 1793366829, -5.8393, 43.6036, 11887.2, false, 237.36, 215.21],
      ["4b1815", "SWR123  ", "Switzerland", 1793366829, 1793366829, null, null, null, false, null, null],
    ]);
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({
      icao24: "39de58",
      callsign: "TVF97UY",
      latitude: 43.6036,
      longitude: -5.8393,
      altitude: 11887,
      velocity: 237,
    });
  });
});

describe("identificadores", () => {
  it("el proxy usa el mismo criterio que el cliente", () => {
    expect(isFabricatedId("mock000000000")).toBe(true);
    expect(isFabricatedId("230987654")).toBe(false);
  });
});

/**
 * El AIS real trae centinelas: 1023 décimas de nudo y 511 de rumbo significan
 * «no disponible». Sin limpiarlos, el globo pinta un barco amarrado a 102 nudos
 * y un rumbo imposible.
 */
describe("centinelas del AIS", () => {
  it("convierte la velocidad no disponible en cero", () => {
    expect(normaliseSpeed(102.3)).toBe(0);
    expect(normaliseSpeed(undefined)).toBe(0);
    expect(normaliseSpeed(8.6)).toBe(8.6);
    expect(normaliseSpeed(0.1)).toBe(0.1);
    // 77,5 kn existe en el feed: es un transpondedor roto, no un barco.
    expect(normaliseSpeed(77.5)).toBe(0);
    expect(normaliseSpeed(59.9)).toBe(59.9);
  });

  it("un rumbo imposible se sustituye por el rumbo sobre el fondo", () => {
    expect(normaliseHeading(511, 208.4)).toBe(208);
    expect(normaliseHeading(271, 100)).toBe(271);
    expect(normaliseHeading(undefined, undefined)).toBe(0);
    expect(normaliseHeading(999, 999)).toBe(0);
  });
});
