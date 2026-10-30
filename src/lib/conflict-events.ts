/**
 * Conflictos en vivo a partir de GDELT.
 *
 * La capa «Conflict Zones» tenía cinco zonas curadas a mano y nada más: eso es
 * una referencia histórica, no lo que está pasando hoy. Liveuamap y
 * WorldMonitor pintan sucesos del día; aquí se usa la única fuente de ese tipo
 * que no pide clave ni registro —la API de documentos de GDELT, que ya alimenta
 * el feed OSINT— con una consulta propia de conflicto armado y una clasificación
 * por palabras del titular.
 *
 * Lo que esto es y lo que no: cada punto es un artículo geolocalizado por GDELT
 * sobre un hecho de violencia (bombardeo, artillería, choques, dron), no un
 * parte oficial de bajas. La ficha del globo lo dice y enlaza el artículo.
 *
 * Fuentes descartadas y por qué: UCDP devuelve 401 sin token desde 2026 y sus
 * datos son mensuales; ACLED exige clave; Liveuamap no publica API.
 */

export type ConflictKind = "airstrike" | "shelling" | "clashes" | "drone" | "explosion" | "other";

export type ConflictSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface ConflictEvent {
  id: string;
  title: string;
  url: string;
  domain: string;
  lat: number;
  lon: number;
  location: string;
  date: string;
  kind: ConflictKind;
  severity: ConflictSeverity;
}

export interface ConflictClassification {
  kind: ConflictKind;
  severity: ConflictSeverity;
}

/** Orden importa: el primer patrón que casa gana. */
const PATTERNS: { kind: ConflictKind; test: RegExp }[] = [
  { kind: "airstrike", test: /\b(air ?strikes?|aerial (attack|bombing)|bombed|bombing raid)\b/i },
  { kind: "shelling", test: /\b(shell(ing|ed)?|artillery|mortar (fire|attack)|rocket (fire|attack)s?)\b/i },
  { kind: "drone", test: /\b(drone (strike|attack)s?|uav attack|kamikaze drone)\b/i },
  { kind: "explosion", test: /\b(explosion|blast|bomb(ing)?|detonation)\b/i },
  { kind: "clashes", test: /\b(clashes?|fighting|gunbattle|firefight|offensive|assault|ambush|troops)\b/i },
];

/** Palabras que elevan la gravedad: un hecho con muertos no es una noticia más. */
const CASUALTY = /\b(kill(ed|s|ing)?|dead|deaths?|fatalities|wounded|injured|massacre|civilians killed)\b/i;
/** Escalada explícita, aunque el titular no dé cifras. */
const ESCALATION = /\b(offensive|invasion|escalat|state of emergency|evacuat)\b/i;

/**
 * Clasifica un titular. Devuelve `other` cuando no menciona violencia: la capa
 * no debe inventar un conflicto donde el artículo habla de diplomacia.
 */
export function classifyConflict(title: string): ConflictClassification {
  const text = title ?? "";
  const kind = PATTERNS.find((pattern) => pattern.test.test(text))?.kind ?? "other";
  const severity: ConflictSeverity =
    kind === "other" ? "LOW" : CASUALTY.test(text) ? "HIGH" : ESCALATION.test(text) ? "MEDIUM" : "MEDIUM";
  return { kind, severity };
}

/**
 * Consulta de conflicto. Tres familias de términos en inglés —el idioma en el
 * que GDELT indexa más prensa— y una ventana de 48 h, que es lo que tarda en
 * estabilizarse la cobertura de un bombardeo.
 */
export const CONFLICT_QUERY =
  'sourcelang:eng (airstrike OR "air strikes" OR shelling OR artillery OR "drone strike" OR clashes OR offensive)';

export function conflictDocUrl(timespanHours = 48, maxRecords = 100): string {
  const params = new URLSearchParams({
    query: CONFLICT_QUERY,
    mode: "artlist",
    format: "geojson",
    maxrecords: String(maxRecords),
    timespan: `${timespanHours}h`,
  });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
}

interface GdeltFeature {
  properties?: {
    name?: string;
    html?: string;
    domain?: string;
    url?: string;
    seendate?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function stripTags(html: string | undefined): string {
  return clean((html ?? "").replace(/<[^>]+>/g, " "));
}

function hrefOf(html: string | undefined): string {
  const match = (html ?? "").match(/href="([^"]+)"/i);
  return match?.[1] ?? "";
}

/**
 * Traduce la respuesta GeoJSON de GDELT a eventos de conflicto.
 *
 * Descarta lo que no es noticia de violencia (`kind: "other"`), las
 * coordenadas imposibles y los duplicados por titular: el mismo bombardeo
 * aparece en veinte medios y veinte chinchetas encima del mismo punto no dicen
 * nada.
 */
export function mapConflictGeoJson(json: unknown): ConflictEvent[] {
  const features = (json as { features?: GdeltFeature[] } | null)?.features ?? [];
  const seen = new Set<string>();
  const events: ConflictEvent[] = [];

  features.forEach((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates) return;
    const [lon, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const title = stripTags(feature.properties?.html) || clean(feature.properties?.name);
    if (!title) return;
    const { kind, severity } = classifyConflict(title);
    if (kind === "other") return;

    const key = title.toLowerCase().slice(0, 90);
    if (seen.has(key)) return;
    seen.add(key);

    events.push({
      id: `conflict-${index}-${key.slice(0, 24)}`,
      title: title.slice(0, 200),
      url: clean(feature.properties?.url) || hrefOf(feature.properties?.html),
      domain: clean(feature.properties?.domain) || "gdeltproject.org",
      lat,
      lon,
      location: clean(feature.properties?.name) || "—",
      date: clean(feature.properties?.seendate),
      kind,
      severity,
    });
  });

  // Lo más grave primero: el globo y la lista deben enseñar lo que arde hoy.
  const rank: Record<ConflictSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return events.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Etiqueta corta del tipo de suceso, para el globo. */
export const CONFLICT_KIND_LABEL: Record<ConflictKind, string> = {
  airstrike: "Bombardeo",
  shelling: "Artillería",
  drone: "Dron",
  explosion: "Explosión",
  clashes: "Choques",
  other: "Conflicto",
};
