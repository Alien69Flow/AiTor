import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VesselFinderAis = {
  MMSI?: number;
  TIMESTAMP?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
  COURSE?: number;
  SPEED?: number;
  HEADING?: number;
  NAME?: string;
  TYPE?: number;
  DESTINATION?: string;
};

type VesselFinderRecord = { AIS?: VesselFinderAis };

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
  const userKey = Deno.env.get("VESSELFINDER_API_KEY");

  if (!userKey) {
    return json({
      available: false, code: "MISSING_VESSELFINDER_API_KEY",
      error: "Marine AIS source is not configured", count: 0, ships: [], bbox,
      timestamp: new Date().toISOString(),
    }, 503);
  }

  try {
    const params = new URLSearchParams({
      userkey: userKey, format: "json", interval: "5", errormode: "409",
    });
    const response = await fetch(
      `https://api.vesselfinder.com/livedata?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      console.warn("VesselFinder LiveData error:", response.status, detail);
      return json({
        available: false, code: "UPSTREAM_UNAVAILABLE",
        error: "Marine AIS upstream is unavailable", count: 0, ships: [], bbox,
        timestamp: new Date().toISOString(),
      }, 502);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return json({
        available: false, code: "INVALID_UPSTREAM_RESPONSE",
        error: "Marine AIS upstream returned an unexpected response",
        count: 0, ships: [], bbox, timestamp: new Date().toISOString(),
      }, 502);
    }

    const ships = payload
      .map((record: VesselFinderRecord) => record.AIS)
      .filter(isValidAis)
      .filter((ais) =>
        ais.LATITUDE >= bbox.minLat && ais.LATITUDE <= bbox.maxLat &&
        ais.LONGITUDE >= bbox.minLon && ais.LONGITUDE <= bbox.maxLon
      )
      .slice(0, 500)
      .map((ais) => ({
        mmsi: String(ais.MMSI),
        name: ais.NAME?.trim() || "Unknown",
        type: vesselType(ais.TYPE),
        latitude: ais.LATITUDE,
        longitude: ais.LONGITUDE,
        speed: ais.SPEED ?? 0,
        heading: normalizeHeading(ais.HEADING, ais.COURSE),
        destination: ais.DESTINATION?.trim() || "Unknown",
        timestamp: ais.TIMESTAMP
          ? new Date(ais.TIMESTAMP.replace(" UTC", "Z")).toISOString()
          : new Date().toISOString(),
      }));

    return json({
      available: true, source: "VesselFinder LiveData / AIS",
      count: ships.length, ships, bbox, timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Marine traffic error:", error);
    return json({
      available: false, code: "MARINE_FETCH_FAILED",
      error: "Failed to fetch marine AIS data", count: 0, ships: [], bbox,
      timestamp: new Date().toISOString(),
    }, 502);
  }
});

function parseFiniteNumber(value: string | null, fallback: number): number {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidAis(
  ais: VesselFinderAis | undefined,
): ais is VesselFinderAis & { MMSI: number; LATITUDE: number; LONGITUDE: number } {
  return Boolean(
    ais &&
      Number.isFinite(ais.MMSI) &&
      Number.isFinite(ais.LATITUDE) &&
      Number.isFinite(ais.LONGITUDE) &&
      ais.LATITUDE >= -90 && ais.LATITUDE <= 90 &&
      ais.LONGITUDE >= -180 && ais.LONGITUDE <= 180,
  );
}

function normalizeHeading(heading?: number, course?: number): number {
  if (typeof heading === "number" && heading >= 0 && heading < 360) return heading;
  if (typeof course === "number" && course >= 0 && course < 360) return course;
  return 0;
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
