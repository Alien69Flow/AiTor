/**
 * Cosmic scale model — one continuous ladder of log10(metres).
 *
 * Shared by the globe (which decides when to hand over) and the cosmic zoom
 * overlay (which renders the ladder), so the trigger threshold lives in exactly
 * one place.
 */

/** log10 of the Earth's radius in metres — the bottom of the ladder. */
export const EARTH_SCALE = Math.log10(6.371e6);

/** Camera altitude at which the globe hands over to the cosmic zoom (60 000 km). */
export const COSMIC_TRIGGER_ALTITUDE_M = 6e7;

export const SCALE_MIN = 6.6;
export const SCALE_MAX = 27.6;

export interface Stage {
  id: string;
  label: string;
  caption: string;
  /** log10(metres) window in which this stage is visible. */
  from: number;
  to: number;
}

export const STAGES: Stage[] = [
  { id: "earth", label: "Tierra", caption: "Radio 6 371 km · superficie y atmósfera", from: 6.9, to: 9.4 },
  { id: "cislunar", label: "Sistema Tierra–Luna", caption: "Órbita lunar a 384 400 km", from: 8.8, to: 11.4 },
  { id: "solar", label: "Sistema Solar", caption: "Neptuno a 30,05 UA · nube de Kuiper", from: 10.9, to: 15.7 },
  { id: "galaxy", label: "Vía Láctea", caption: "~100 000 años luz · el Sol en el brazo de Orión", from: 15.0, to: 22.7 },
  { id: "localgroup", label: "Grupo Local", caption: "Andrómeda a 2,5 millones de años luz", from: 22.0, to: 25.7 },
  { id: "universe", label: "Universo observable", caption: "92 000 millones de años luz de diámetro", from: 25.0, to: 27.7 },
];

const SCALE_UNITS: { factor: number; label: string }[] = [
  { factor: 1, label: "m" },
  { factor: 1e3, label: "km" },
  { factor: 1.495978707e11, label: "UA" },
  { factor: 9.4607304725808e15, label: "años luz" },
  { factor: 9.4607304725808e21, label: "millones de años luz" },
  { factor: 9.4607304725808e24, label: "mil millones de años luz" },
];

/** Human-readable distance for a log10(metres) scale value. */
export function formatScale(scale: number): string {
  const metres = 10 ** scale;
  let unit = SCALE_UNITS[0];
  for (const candidate of SCALE_UNITS) if (metres / candidate.factor >= 1) unit = candidate;
  const value = metres / unit.factor;
  const rounded = value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : Math.round(value).toLocaleString("es-ES");
  return `${rounded} ${unit.label}`;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Fade a stage in/out across its window so neighbours blend at the edges. */
export function stageOpacity(scale: number, stage: Stage, feather = 0.9): number {
  const inEdge = clamp01((scale - stage.from) / feather);
  const outEdge = clamp01((stage.to - scale) / feather);
  return Math.min(inEdge, outEdge);
}
