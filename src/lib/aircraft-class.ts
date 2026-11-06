/**
 * Qué es cada avión y a qué altura vuela.
 *
 * La capa de tráfico aéreo pintaba todos los contactos igual: una silueta
 * blanca en la misma posición. El mapa decía dónde estaba cada avión y nada
 * más. Aquí se resuelven las dos preguntas que sí caben en un icono de 32 px:
 *
 *   altitud → **color**, porque es una magnitud continua y una escala ordenada
 *              se lee de un vistazo (verde abajo, ámbar arriba).
 *   tipo    → **forma**, porque es categórico y una forma distinta se reconoce
 *              antes que un color distinto repetido cinco veces.
 *
 * Los dos canales viajan juntos porque no compiten: el color no dice «militar»
 * y la forma no dice «a 11 km».
 *
 * Límite honesto de la clasificación: ADS-B no publica el rol del vuelo, sólo
 * el código de tipo de la aeronave, la categoría del emisor y el indicativo. Lo
 * de aquí es una **inferencia** a partir de esos tres campos —un 777F es carga
 * porque su designador ICAO acaba en F, y `RCH317` es militar porque ese
 * indicativo lo usa el transporte aéreo militar de EE. UU.—, no una identidad
 * declarada. Por eso el valor por defecto es «otro» y no «pasajeros»: ante la
 * duda, no se afirma nada.
 */

export type AircraftRole = "pasajeros" | "carga" | "militar" | "gobierno" | "privado" | "otro";

export interface AltitudeBand {
  id: string;
  /** Etiqueta corta para la leyenda. */
  label: string;
  color: string;
  /** Límite inferior en km, incluido. */
  minKm: number;
  /** Límite superior en km, excluido. `Infinity` en la última banda. */
  maxKm: number;
}

/**
 * Bandas de altitud, de suelo a estratosfera. Los cortes no son decorativos:
 * 3 km es donde termina el ascenso y empieza el vuelo en ruta corta, 6–9 km es
 * la franja de los regionales y los jets de negocios, 9–12 km es el crucero de
 * casi todos los reactores comerciales y por encima de 12 km sólo vuelan
 * supersónicos, aviones de negocios de largo alcance y algunos militares.
 */
export const ALTITUDE_BANDS: AltitudeBand[] = [
  { id: "bajo", label: "0–3 km", color: "#34d399", minKm: 0, maxKm: 3 },
  { id: "ruta-corta", label: "3–6 km", color: "#22d3ee", minKm: 3, maxKm: 6 },
  { id: "regional", label: "6–9 km", color: "#818cf8", minKm: 6, maxKm: 9 },
  { id: "crucero", label: "9–12 km", color: "#e879f9", minKm: 9, maxKm: 12 },
  { id: "estratosfera", label: "+12 km", color: "#fbbf24", minKm: 12, maxKm: Infinity },
];

/**
 * Banda para un contacto sin altitud utilizable.
 *
 * No se cae a «0–3 km»: pintar de verde un avión del que no sabemos la altura
 * sería afirmar que vuela bajo. El gris dice «sin dato».
 */
export const UNKNOWN_BAND: AltitudeBand = {
  id: "desconocida",
  label: "sin altitud",
  color: "#94a3b8",
  minKm: Number.NaN,
  maxKm: Number.NaN,
};

/** Banda de altitud de una lectura en metros (la unidad que sirve el hook). */
export function altitudeBand(altitudeMeters: number | null | undefined): AltitudeBand {
  if (typeof altitudeMeters !== "number" || !Number.isFinite(altitudeMeters)) return UNKNOWN_BAND;
  const km = Math.max(0, altitudeMeters) / 1000;
  return ALTITUDE_BANDS.find((band) => km >= band.minKm && km < band.maxKm) ?? UNKNOWN_BAND;
}

/** Nombres de la leyenda, en el orden en que se leen. */
export const ROLE_LABELS: Record<AircraftRole, string> = {
  pasajeros: "Pasajeros",
  carga: "Carga",
  militar: "Militar",
  gobierno: "Gubernamental",
  privado: "Privado / GA",
  otro: "Sin clasificar",
};

/** Lo mínimo que hace falta para clasificar un contacto. */
export interface AircraftIdentity {
  icao24?: string | null;
  callsign?: string | null;
  aircraftType?: string | null;
  aircraftCategory?: string | null;
}

/**
 * Designadores ICAO de aeronaves militares que sí aparecen en feeds abiertos.
 * No es una lista de flotas enteras: sólo de los modelos que se ven a diario en
 * ADS-B (transporte, reabastecimiento, patrulla, entrenamiento).
 */
const MILITARY_TYPES = new Set([
  "C130", "C30J", "C17", "C5M", "C5", "A400", "C160", "C27J", "C295", "CN35",
  "K35R", "KC46", "KC10", "K46", "E3TF", "E3CF", "E6B", "E8A", "E737", "RC135",
  "P8", "P3", "P1", "CP140", "C130H", "T38", "T6", "TEX2", "PC21",
  "F16", "F15", "F18", "F22", "F35", "F5", "EF2K", "RFAL", "MIR2", "GR4", "HRNT",
  "B52", "B1B", "B2", "TU95", "TU16",
  "UH60", "H60", "V22", "MV22", "CH47", "AH64", "NH90", "EH10", "LYNX", "W3",
]);

/**
 * Indicativos usados por operadores militares. Son prefijos de tres letras que
 * el control aéreo asigna por unidad; sirven para señalar, no para certificar.
 */
const MILITARY_CALLSIGNS = [
  "RCH", "RRR", "GAF", "IFC", "CNV", "PAT", "DUKE", "HERKY", "TITAN", "REACH",
  "ASCOT", "CFC", "IAM", "NAF", "HAWK", "VIPER", "BOLT",
];

/** Indicativos de vuelos de Estado o de jefatura de gobierno. */
const GOVERNMENT_CALLSIGNS = ["SAM", "SPAR", "EXEC", "JANET", "GOV"];

/** Prefijos de aerolíneas de carga que se ven cada noche en ADS-B. */
const CARGO_CALLSIGNS = [
  "UPS", "FDX", "GTI", "CLX", "BOX", "BCS", "ABX", "CKS", "SOO", "NCA", "KZU", "TAY", "SWN",
];

/** Designadores ICAO de reactores comerciales de pasaje más comunes. */
const AIRLINER_TYPES = new Set([
  "A19N", "A20N", "A21N", "A318", "A319", "A320", "A321", "A332", "A333", "A337",
  "A338", "A339", "A342", "A343", "A345", "A346", "A359", "A35K", "A388",
  "B712", "B732", "B733", "B734", "B735", "B736", "B737", "B738", "B739", "B38M", "B39M", "B3XM",
  "B741", "B742", "B743", "B744", "B748", "B752", "B753", "B762", "B763", "B764",
  "B772", "B773", "B77L", "B77W", "B788", "B789", "B78X",
  "E170", "E175", "E190", "E195", "E290", "E295", "E75L", "E75S",
  "CRJ2", "CRJ7", "CRJ9", "CRJX", "AT45", "AT46", "AT72", "AT75", "AT76",
  "DH8D", "DH8C", "SF34", "JS41", "MD82", "MD83", "MD88", "MD90", "BCS1", "BCS3",
]);

/** Aviación general y ejecutiva: monomotor, hélice, jets ligeros. */
const GA_TYPES = new Set([
  "C150", "C152", "C172", "C182", "C206", "C208", "C210", "SR20", "SR22", "DA40",
  "DA42", "PA28", "PA34", "PA46", "P28A", "P28B", "TB20", "BE20", "BE35", "BE36",
  "BE58", "PC12", "PC24", "TBM7", "TBM8", "TBM9", "M20P", "RV7", "RV8", "GLID",
  "C25A", "C25B", "C25C", "C510", "C525", "C550", "C560", "C56X", "C650", "C680",
  "C68A", "C700", "C750", "E50P", "E55P", "E545", "E550", "LJ35", "LJ45", "LJ60",
  "LJ75", "H25B", "GLF4", "GLF5", "GLF6", "G280", "G550", "G650", "FA7X", "FA8X",
  "CL30", "CL35", "CL60", "HDJT", "PRM1", "B350", "B200", "B190",
]);

/**
 * Indicativo limpio y en mayúsculas.
 *
 * Se compara por **prefijo completo**, no por tres letras: `SPAR19` empieza por
 * `SPAR` y quedarse con `SPA` lo dejaba sin clasificar.
 */
function cleanCallsign(callsign: string | null | undefined): string {
  return (callsign || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function startsWithAny(callsign: string, tokens: readonly string[]): boolean {
  return callsign.length > 0 && tokens.some((token) => callsign.startsWith(token));
}

/**
 * Tipo de vuelo inferido de la categoría del emisor y del código de tipo.
 *
 * El orden importa: militar y gubernamental se comprueban antes que carga y
 * pasaje, porque un `C130` con indicativo `RCH` es las tres cosas menos
 * pasajeros, y quedarse con la primera coincidencia evita que un Hércules
 * aparezca como avión comercial por tener cuatro motores.
 */
export function aircraftRole(identity: AircraftIdentity): AircraftRole {
  const type = (identity.aircraftType || "").trim().toUpperCase();
  const callsign = cleanCallsign(identity.callsign);

  if (MILITARY_TYPES.has(type) || startsWithAny(callsign, MILITARY_CALLSIGNS)) return "militar";
  if (startsWithAny(callsign, GOVERNMENT_CALLSIGNS)) return "gobierno";

  // Los designadores de cargueros añaden una F al de la familia (B77F, A332F).
  if (startsWithAny(callsign, CARGO_CALLSIGNS)) return "carga";
  if (/^[A-Z][0-9][0-9A-Z]{1,2}F$/.test(type)) return "carga";
  if (AIRLINER_TYPES.has(type)) return "pasajeros";

  // Categoría del emisor: A1 y A2 son ligeros (< 7 000 kg y 7 000–34 000 kg).
  const category = (identity.aircraftCategory || "").trim().toUpperCase();
  if (GA_TYPES.has(type)) return "privado";
  if (category === "A1" || category === "A2") return "privado";

  return "otro";
}
