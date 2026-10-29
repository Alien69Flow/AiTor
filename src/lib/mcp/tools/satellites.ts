import * as satellite from "satellite.js";
import { toolResult, type McpTool } from "../registry";

/**
 * Telemetría orbital real, sin clave.
 *
 * CelesTrak publica los elementos orbitales (TLE) de toda la flota activa; la
 * posición se propaga aquí con `satellite.js`, que ya usa el globo. No hay
 * datos inventados: si el catálogo no responde, la herramienta devuelve error y
 * el modelo lo dice, en vez de rellenar con órbitas plausibles.
 */

const TLE_URL = {
  stations: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
  active: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
} as const;

const FETCH_TIMEOUT_MS = 12_000;

export interface ParsedTle {
  name: string;
  line1: string;
  line2: string;
}

/** El formato TLE son grupos de tres líneas: nombre, línea 1 y línea 2. */
export function parseTleText(text: string): ParsedTle[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const out: ParsedTle[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (!lines[i + 1].startsWith("1 ") || !lines[i + 2].startsWith("2 ")) continue;
    out.push({ name: lines[i], line1: lines[i + 1], line2: lines[i + 2] });
  }
  return out;
}

/** Posición geodésica del satélite en un instante dado, o null si el TLE caducó. */
export function positionOf(
  tle: ParsedTle,
  date: Date,
): { lat: number; lon: number; altKm: number } | null {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    if (!satrec || (satrec as { error?: number }).error) return null;
    const pv = satellite.propagate(satrec, date);
    if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
    const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, satellite.gstime(date));
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, altKm: geo.height };
  } catch {
    return null;
  }
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export const satelliteTools: McpTool[] = [
  {
    definition: {
      name: "telemetry.satellites",
      title: "Posiciones de satélites",
      description:
        "Posición actual (latitud, longitud, altitud) de los satélites del catálogo CelesTrak. " +
        "Con `match` se filtra por nombre, p. ej. \"ISS\" o \"STARLINK\".",
      minTier: "free",
      inputSchema: {
        type: "object",
        properties: {
          group: {
            type: "string",
            enum: ["stations", "active"],
            description: "`stations` (ISS y estaciones) o `active` (toda la flota activa).",
            default: "stations",
          },
          match: { type: "string", description: "Filtro por nombre, sin distinguir mayúsculas." },
          limit: {
            type: "integer",
            description: "Cuántos satélites devolver como máximo (1-50).",
            default: 10,
            minimum: 1,
            maximum: 50,
          },
        },
      },
    },
    run: async (args, context) => {
      const group = args.group === "active" ? "active" : "stations";
      const match = typeof args.match === "string" ? args.match.trim().toUpperCase() : "";
      const limit = asInt(args.limit, 10, 1, 50);

      const response = await context.fetch(TLE_URL[group], {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`CelesTrak respondió ${response.status}`);
      }

      const catalogue = parseTleText(await response.text());
      if (catalogue.length === 0) throw new Error("CelesTrak devolvió un catálogo vacío");

      const now = new Date();
      const selected = (match ? catalogue.filter((tle) => tle.name.toUpperCase().includes(match)) : catalogue)
        .slice(0, limit);

      const satellites = selected
        .map((tle) => {
          const position = positionOf(tle, now);
          if (!position) return null;
          return {
            name: tle.name,
            lat: Number(position.lat.toFixed(4)),
            lon: Number(position.lon.toFixed(4)),
            altKm: Number(position.altKm.toFixed(1)),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      return toolResult({
        source: "celestrak.org",
        group,
        at: now.toISOString(),
        catalogSize: catalogue.length,
        satellites,
      });
    },
  },
];
