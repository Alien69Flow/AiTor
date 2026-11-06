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
/** 10^27,6 m ≈ 4 × 10^27 m: el diámetro del universo observable. */
export const SCALE_MAX = 27.6;

export interface Stage {
  id: string;
  label: string;
  caption: string;
  /** log10(metres) window in which this stage is visible. */
  from: number;
  to: number;
}

/**
 * Los diez peldaños, de la superficie terrestre al universo observable.
 *
 * Cada ventana va en log10(metros) y se solapa con la siguiente ~1,5 décadas:
 * sin ese solape el paso de una escena a otra sería un corte, y con demasiado
 * se verían dos escalas a la vez. Las distancias de los pies de foto son las
 * reales (UA, años luz, megaparsecs, miles de millones de años luz) porque son
 * lo único que permite comprobar que el salto siguiente está donde debe.
 */
export const STAGES: Stage[] = [
  { id: "earth", label: "Tierra", caption: "Radio 6 371 km · superficie y atmósfera", from: 6.6, to: 9.0 },
  { id: "cislunar", label: "Sistema Tierra–Luna", caption: "Luna a 384 400 km · 60,3 radios terrestres", from: 8.6, to: 10.7 },
  { id: "solar", label: "Sistema Solar", caption: "Neptuno 30,05 UA · heliopausa ≈ 120 UA", from: 10.4, to: 13.5 },
  { id: "oort", label: "Nube de Oort", caption: "2 000–100 000 UA · 0,03–1,6 años luz", from: 13.1, to: 16.3 },
  { id: "neighborhood", label: "Brazo de Orión", caption: "Próxima 4,24 al · Sirio 8,60 al · vecindario solar", from: 15.9, to: 18.6 },
  // Cada ventana se cierra cuando el objeto que la define ya no es el que se
  // mira: la Vía Láctea cede el paso justo antes de Andrómeda (2,54 Mal) y el
  // Grupo Local cede en Virgo (53,8 Mal), no dos décadas después.
  { id: "milkyway", label: "Vía Láctea", caption: "100 000 al de diámetro · el Sol a 26 000 al del centro", from: 18.3, to: 22.3 },
  { id: "localgroup", label: "Grupo Local", caption: "Andrómeda 2,54 Mal · ~10 Mal de diámetro", from: 22.0, to: 23.9 },
  { id: "virgo", label: "Cúmulo de Virgo", caption: "16,5 Mpc (53,8 Mal) · ~1 300 galaxias", from: 23.4, to: 24.8 },
  { id: "supercluster", label: "Supercúmulo de Virgo", caption: "110 Mal de ancho · Laniakea 520 Mal", from: 24.4, to: 25.8 },
  { id: "universe", label: "Universo observable", caption: "93 000 Mal de diámetro · radio 46 500 Mal", from: 25.6, to: 27.6 },
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

/**
 * Paso de los botones del zoom cósmico, en décadas de metros (log10). Es el
 * mismo salto que ya hacían las flechas del teclado, para que botón y teclado
 * no muevan la cámara a velocidades distintas.
 */
export const COSMIC_STEP = 0.35;

export type CosmicDirection = "in" | "out";

/**
 * Escala siguiente (log10 de metros) acotada al rango del zoom cósmico.
 * `in` se acerca a la Tierra (menos metros), `out` se aleja. Devuelve `null` en
 * el tope, que es lo que permite desactivar el botón en vez de fingir el salto.
 */
export function nextCosmicScale(current: number, direction: CosmicDirection): number | null {
  if (!Number.isFinite(current)) return null;
  const target = direction === "in" ? current - COSMIC_STEP : current + COSMIC_STEP;
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, target));
  return Math.abs(clamped - current) < 1e-6 ? null : clamped;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Fade a stage in/out across its window so neighbours blend at the edges. */
export function stageOpacity(scale: number, stage: Stage, feather = 0.9): number {
  const inEdge = clamp01((scale - stage.from) / feather);
  const outEdge = clamp01((stage.to - scale) / feather);
  return Math.min(inEdge, outEdge);
}
