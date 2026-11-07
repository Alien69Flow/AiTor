export function finiteReading(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface SurfaceReadings {
  temperatureC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
}

export function surfaceReadingLines(point: SurfaceReadings, active: ReadonlySet<string>): string[] {
  const lines: string[] = [];
  if (active.has("temperature") && point.temperatureC !== null) lines.push(`${point.temperatureC.toFixed(1)} °C`);
  if (active.has("humidity") && point.humidityPercent !== null) lines.push(`${Math.round(point.humidityPercent)} % HR`);
  if (active.has("isobars") && point.pressureHpa !== null) lines.push(`${Math.round(point.pressureHpa)} hPa`);
  if (active.has("wind") && point.windSpeedMs !== null) lines.push(`${point.windSpeedMs.toFixed(1)} m/s${point.windDirectionDeg !== null ? ` · ${Math.round(point.windDirectionDeg)}°` : ""}`);
  return lines;
}