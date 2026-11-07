import { describe, expect, it } from "vitest";
import { finiteReading, surfaceReadingLines } from "./surface-weather";

describe("coexisting weather layers", () => {
  it("keeps temperature and humidity visible together", () => {
    expect(surfaceReadingLines({ temperatureC: 22, humidityPercent: 69, pressureHpa: 1013, windSpeedMs: 3, windDirectionDeg: 180 }, new Set(["temperature", "humidity", "isobars", "wind"]))).toEqual(["22.0 °C", "69 % HR", "1013 hPa", "3.0 m/s · 180°"]);
  });
  it("does not turn missing measurements into zero", () => {
    expect(finiteReading(undefined)).toBeNull();
    expect(finiteReading(null)).toBeNull();
    expect(finiteReading(0)).toBe(0);
    expect(surfaceReadingLines({ temperatureC: null, humidityPercent: null, pressureHpa: null, windSpeedMs: null, windDirectionDeg: null }, new Set(["temperature", "humidity"]))).toEqual([]);
  });
});