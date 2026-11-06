/**
 * Métricas ambientales derivadas: secado, bandera de baño y nivel de polen.
 *
 * Viven fuera del conector porque no dependen de React ni de la red, y las usan
 * dos sitios que no comparten proceso: la rejilla del globo y las herramientas
 * MCP (una de ellas corre en Vercel, donde importar el código de `src/` con
 * hooks rompe el runtime). Si cada uno tuviera su copia, un umbral acabaría
 * distinto en el globo y en lo que responde AI Tor.
 */

/** Nivel de polen según granos/m³ (umbrales de CAMS para gramíneas). */
export type PollenLevel = 0 | 1 | 2 | 3;

export const POLLEN_LEVEL_LABEL: Record<PollenLevel, string> = {
  0: "bajo",
  1: "moderado",
  2: "alto",
  3: "muy alto",
};

export type BeachFlag = "verde" | "amarilla" | "roja";

/** Las cinco especies que publica CAMS Europe para este proyecto. */
export const POLLEN_SPECIES: { key: string; label: string }[] = [
  { key: "grass_pollen", label: "gramíneas" },
  { key: "olive_pollen", label: "olivo" },
  { key: "birch_pollen", label: "abedul" },
  { key: "alder_pollen", label: "aliso" },
  { key: "ragweed_pollen", label: "ambrosía" },
];

/**
 * Índice de secado 0-100.
 *
 * Pesa la humedad relativa (lo que más frena la evaporación), el viento y la
 * temperatura, y anula el resultado si está lloviendo: con 0,2 mm en la última
 * hora la ropa no se seca aunque haga sol. Los pesos son una decisión de
 * producto, no una medida física, y por eso vive en una función con pruebas.
 */
export function dryingIndex(input: {
  temperatureC: number;
  humidityPercent: number;
  windKmh: number;
  precipitationMm: number;
}): number {
  const { temperatureC, humidityPercent, windKmh, precipitationMm } = input;
  if (!Number.isFinite(temperatureC) || !Number.isFinite(humidityPercent)) return 0;
  if (precipitationMm > 0.1) return 0;

  const dryness = Math.min(100, Math.max(0, 100 - humidityPercent)) * 0.5;
  const wind = (Math.min(40, Math.max(0, Number.isFinite(windKmh) ? windKmh : 0)) / 40) * 25;
  const warmth = Math.min(1, Math.max(0, (temperatureC - 5) / 30)) * 25;
  return Math.round(Math.min(100, Math.max(0, dryness + wind + warmth)));
}

/** Qué se puede deducir del secado, en una frase. */
export function dryingVerdict(index: number): string {
  if (!Number.isFinite(index)) return "Sin medida.";
  if (index === 0) return "No se seca: está lloviendo.";
  if (index >= 70) return "Se seca sin problema.";
  if (index >= 40) return "Se seca despacio.";
  return "Casi no se seca.";
}

/**
 * Bandera de baño a partir del oleaje. No sustituye a la del socorrista: es lo
 * que se puede deducir de la altura de ola significante.
 */
export function seaFlag(waveHeightM: number): BeachFlag {
  if (!Number.isFinite(waveHeightM)) return "amarilla";
  if (waveHeightM >= 2) return "roja";
  if (waveHeightM >= 1) return "amarilla";
  return "verde";
}

/** Nivel de polen a partir de granos/m³. */
export function pollenLevel(grains: number | null | undefined): PollenLevel {
  if (grains === null || grains === undefined || !Number.isFinite(grains) || grains < 1) return 0;
  if (grains < 10) return 1;
  if (grains < 50) return 2;
  return 3;
}

/** Especie dominante y su nivel. `null` cuando CAMS no cubre el punto. */
export function dominantPollen(
  species: Record<string, number | null | undefined>,
): { species: string; grains: number; level: PollenLevel } | null {
  let best: { species: string; grains: number } | null = null;
  for (const { key, label } of POLLEN_SPECIES) {
    const value = species[key];
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    if (!best || value > best.grains) best = { species: label, grains: value };
  }
  if (!best) return null;
  return { ...best, level: pollenLevel(best.grains) };
}
