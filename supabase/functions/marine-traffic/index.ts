import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AisRecord = {
  MMSI?: number;
  TIME?: string;
  TSTAMP?: string;
  TIMESTAMP?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
  COG?: number;
  COURSE?: number;
  SOG?: number;
  SPEED?: number;
  HEADING?: number;
  NAME?: string;
  TYPE?: number;
  DEST?: string;
  DESTINATION?: string;
};

type VesselFinderRecord = { AIS?: AisRecord };

type Ship = {
  mmsi: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  destination: string;
  timestamp: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const blocked = guardPublic(req, corsHeaders, 180);
  if (blocked) return blocked;

  const url = new URL(req.url);
  const bbox = {
    minLat: parseFiniteNumber(url.searchParams.get("minLat"), -90),
    maxLat: parseFiniteNumber(url.searchParams.get("maxLat"), 90),
    minLon: parseFiniteNumber(url.searchParams.get("minLon"), -180),
    maxLon: parseFiniteNumber(url.searchParams.get("maxLon"), 180),
  };

  const vesselFinderKey = Deno.env.get("VESSELFINDER_API_KEY");
  const aishubUsername = Deno.env.get("AISHUB_USERNAME");

  if (!vesselFinderKey && !aishubUsername) {
    return unavailable(
      "MISSING_AIS_PROVIDER",
      "No marine AIS provider is configured",
      bbox,
      503,
    );
  }

  if (vesselFinderKey) {
    const vesselFinder = await fetchVesselFinder(vesselFinderKey, bbox);
    if (vesselFinder.ok) return json({
      available: true,
      source: "VesselFinder LiveData / AIS",
      count: vesselFinder.ships.length,
      ships: vesselFinder.ships,
      bbox,
      timestamp: new Date().toISOString(),
    });

    console.warn("VesselFinder unavailable:", vesselFinder.error);
  }

  if (aishubUsername) {
    const aishub = await fetchAishub(aishubUsername, bbox);
    if (aishub.ok) return json({
      available: true,
      source: "AISHub / AIS",
      count: aishub.ships.length,
      ships: aishub.ships,
      bbox,
      timestamp: new Date().toISOString(),
    });

    console.warn("AISHub unavailable:", aishub.error);
  }

  return unavailable(
    "ALL_AIS_PROVIDERS_UNAVAILABLE",
    "Configured marine AIS providers are unavailable",
    bbox,
    502,
  );
});

async function fetchVesselFinder(
  userKey: string,
  bbox: typeof DEFAULT_BBOX,
): Promise<{ ok: true; ships: Ship[] } | { ok: false; error: string }> {
  try {
    const params = new URLSearchParams({
      userkey: userKey,
      format: "json",
      interval: "5",
      errormode: "409",
    });
    const response = await fetch(
      `https://api.vesselfinder.com/livedata?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      return { ok: false, error: `HTTP ${response.status}: ${detail}` };
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return { ok: false, error: "Unexpected VesselFinder response" };
    }

    const ships = payload
      .map((record: VesselFinderRecord) => record.AIS)
      .filter(isValidAis)
      .filter((ais) => inBounds(ais, bbox))
      .slice(0, 500)
      .map(toShip);

    return { ok: true, ships };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "VesselFinder request failed" };
  }
}

async function fetchAishub(
  username: string,
  bbox: typeof DEFAULT_BBOX,
): Promise<{ ok: true; ships: Ship[] } | { ok: false; error: string }> {
  try {
    const params = new URLSearchParams({
      username,
      format: "1",
      output: "json",
      compress: "0",
      latmin: String(bbox.minLat),
      latmax: String(bbox.maxLat),
      lonmin: String(bbox.minLon),
      lonmax: String(bbox.maxLon),
      interval: "10",
    });

    const response = await fetch(
      `https://data.aishub.net/ws.php?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      return { ok: false, error: `HTTP ${response.status}: ${detail}` };
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      return { ok: false, error: "Unexpected AISHub response" };
    }

    const ships = payload[1]
      .filter(isValidAis)
      .filter((ais) => inBounds(ais, bbox))
      .slice(0, 500)
      .map(toShip);

    return { ok: true, ships };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "AISHub request failed" };
  }
}

const DEFAULT_BBOX = {
  minLat: -90,
  maxLat: 90,
  minLon: -180,
  maxLon: 180,
};

function parseFiniteNumber(value: string | null, fallback: number): number {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidAis(
  ais: AisRecord | undefined,
): ais is AisRecord & { MMSI: number; LATITUDE: number; LONGITUDE: number } {
  return Boolean(
    ais &&
      Number.isFinite(ais.MMSI) &&
      Number.isFinite(ais.LATITUDE) &&
      Number.isFinite(ais.LONGITUDE) &&
      ais.LATITUDE >= -90 && ais.LATITUDE <= 90 &&
      ais.LONGITUDE >= -180 && ais.LONGITUDE <= 180,
  );
}

function inBounds(
  ais: { LATITUDE: number; LONGITUDE: number },
  bbox: typeof DEFAULT_BBOX,
): boolean {
  return (
    ais.LATITUDE >= bbox.minLat &&
    ais.LATITUDE <= bbox.maxLat &&
    ais.LONGITUDE >= bbox.minLon &&
    ais.LONGITUDE <= bbox.maxLon
  );
}

function toShip(ais: AisRecord & { MMSI: number; LATITUDE: number; LONGITUDE: number }): Ship {
  return {
    mmsi: String(ais.MMSI),
    name: ais.NAME?.trim() || "Unknown",
    type: vesselType(ais.TYPE),
    latitude: ais.LATITUDE,
    longitude: ais.LONGITUDE,
    speed: normalizeSpeed(ais.SPEED ?? ais.SOG),
    heading: normalizeHeading(ais.HEADING, ais.COURSE ?? ais.COG),
    destination: (ais.DESTINATION ?? ais.DEST)?.trim() || "Unknown",
    timestamp: normalizeTimestamp(ais.TIMESTAMP ?? ais.TSTAMP ?? ais.TIME),
  };
}

function normalizeSpeed(speed?: number): number {
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) return 0;
  return speed;
}

function normalizeHeading(heading?: number, course?: number): number {
  if (typeof heading === "number" && heading >= 0 && heading < 360) return heading;
  if (typeof course === "number" && course >= 0 && course < 360) return course;
  return 0;
}

function normalizeTimestamp(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value.replace(" UTC", "Z"));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function vesselType(type?: number): string {
  if (typeof type !== "number") return "Unknown";
  if (type >= 20 && type <= 29) return "Wing in Ground";
  if (type >= 30 && type <= 39) return "Special Craft";
  if (type >= 40 && type <= 49) return "High-Speed Craft";
  if (type >= 50 && type <= 59) return "Pilot / Service";
  if (type >= 60 && type <= 69) return "Passenger";
  if (type >= 70 && type <= 79) return "Cargo";
  if (type >= 80 && type <= 89) return "Tanker";
  if (type >= 90 && type <= 99) return "Other";
  return `AIS ${type}`;
}

function unavailable(
  code: string,
  error: string,
  bbox: typeof DEFAULT_BBOX,
  status: number,
): Response {
  return json({
    available: false,
    code,
    error,
    count: 0,
    ships: [],
    bbox,
    timestamp: new Date().toISOString(),
  }, status);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=180",
    },
  });
}
