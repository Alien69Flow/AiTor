/**
 * Conflictos en vivo a partir de GDELT.
 *
 * La capa «Conflict Zones» tenía cinco zonas curadas a mano y nada más: eso es
 * una referencia histórica, no lo que está pasando hoy. Liveuamap y
 * WorldMonitor pintan sucesos del día; aquí se usa la única fuente geolocalizada
 * de ese tipo que no pide clave ni registro, la de GDELT, que ya alimenta el
 * feed OSINT.
 *
 * La fuente cambió de puerta. La capa pedía `DOC 2.0` con `format=geojson`, que
 * no existe: GDELT contestaba un 200 en HTML con «Invalid format.» y el
 * `response.json()` del cliente siempre fallaba. Y `GEO 2.0`, la API que sí
 * devolvía GeoJSON, lleva tiempo respondiendo 404. Lo que sigue vivo —y se
 * comprobó contra el servidor— es `GKG GeoJSON (v1)`: cobertura de un tema del
 * Global Knowledge Graph cruzada con las coordenadas de cada lugar mencionado.
 * Se pide por `/api/gdelt`, porque desde el navegador el mismo origen es
 * necesario y el proxy además cachea (GDELT permite una petición cada 5 s).
 *
 * Lo que esto es y lo que no: cada punto es un lugar mencionado en prensa que
 * GDELT etiquetó como conflicto armado en la ventana pedida, con un artículo
 * real de enlace. No es un parte de bajas ni dice qué pasó: la fuente no da el
 * titular, así que el tipo se queda en «Conflicto» y la gravedad sale del tono
 * con el que la prensa trata ese lugar, no de muertos que no podemos contar.
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

/** Tema del GKG que define la capa. Verificado: devuelve cobertura real. */
export const CONFLICT_THEME = "ARMEDCONFLICT";

/** Proxy propio, mismo origen. Es por donde va el navegador. */
export const CONFLICT_PROXY_PATH = "/api/gdelt";

export function conflictProxyUrl(hours = 12, maxrows = 250): string {
  const params = new URLSearchParams({
    theme: CONFLICT_THEME,
    hours: String(hours),
    maxrows: String(maxrows),
  });
  return `${CONFLICT_PROXY_PATH}?${params.toString()}`;
}

interface GkgFeature {
  properties?: {
    url?: string;
    name?: string;
    urlpubtimedate?: string;
    domain?: string;
    /** Tono del artículo. Se pide como `tone` y GKG lo devuelve así. */
    urltone?: string | number;
    tone?: string | number;
  };
  geometry?: { coordinates?: [number, number] };
}

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Gravedad a partir del tono de la cobertura.
 *
 * Es una medida real de GDELT (tono medio de los artículos que mencionan ese
 * lugar), no una estimación de víctimas: por eso los umbrales están aquí y no
 * escondidos en el cliente. Un lugar del que la prensa habla con tono muy
 * negativo se rotula; sin dato, se queda en MEDIUM en vez de inventar.
 */
export function severityFromTone(tone: number | null): ConflictSeverity {
  if (tone === null) return "MEDIUM";
  if (tone <= -10) return "HIGH";
  if (tone <= -5) return "MEDIUM";
  return "LOW";
}

/**
 * Traduce el GeoJSON del GKG a eventos de conflicto.
 *
 * Descarta coordenadas imposibles y lugares sin nombre, y deja **un punto por
 * lugar**: la misma noticia menciona cinco países y cinco chinchetas idénticas
 * encima de cada uno no aportan nada. Cuando hay varias menciones del mismo
 * lugar se queda la más reciente, que es la que interesa en una capa «en vivo».
 */
export function mapGkgConflictGeoJson(json: unknown): ConflictEvent[] {
  const features = (json as { features?: GkgFeature[] } | null)?.features ?? [];
  const byLocation = new Map<string, ConflictEvent>();

  features.forEach((feature) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates) return;
    const [lon, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

    const location = clean(feature.properties?.name);
    if (!location) return;

    const url = clean(feature.properties?.url);
    const domain = clean(feature.properties?.domain) || domainOf(url);
    const date = clean(feature.properties?.urlpubtimedate);
    const toneRaw = feature.properties?.urltone ?? feature.properties?.tone;
    const tone = toneRaw === undefined || toneRaw === "" ? null : Number(toneRaw);
    const severity = severityFromTone(Number.isFinite(tone as number) ? (tone as number) : null);

    const event: ConflictEvent = {
      id: `gkg-${location.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      title: `${location}: cobertura de conflicto armado`,
      url,
      domain: domain || "gdeltproject.org",
      lat,
      lon,
      location,
      date,
      // La fuente no dice si fue bombardeo, artillería o choque: no se adivina.
      kind: "other",
      severity,
    };

    const previous = byLocation.get(event.id);
    if (!previous || previous.date < event.date) byLocation.set(event.id, event);
  });

  const rank: Record<ConflictSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return [...byLocation.values()].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.date.localeCompare(a.date),
  );
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
