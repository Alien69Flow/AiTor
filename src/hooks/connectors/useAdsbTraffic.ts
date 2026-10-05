import { safeFetchJson, usePolledConnector } from "@/lib/connectors";
import type { Flight } from "@/hooks/useAirTraffic";

const ADSB_LADD = "https://api.adsb.lol/v2/ladd";

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  r?: string;
  t?: string;
  category?: string;
}

/**
 * ADSB.lol open feed — replaces OpenSky as the primary aviation source
 * (OpenSky anonymous rate limits make a 15s refresh impossible).
 */
export function useAdsbTraffic(enabled: boolean, intervalMs = 15_000, maxAircraft = 300) {
  return usePolledConnector<Flight[]>(
    async (signal) => {
      const json = await safeFetchJson<{ ac?: AdsbAircraft[]; now?: number }>(ADSB_LADD, {
        signal,
        timeoutMs: 8000,
      });
      if (!json || !Array.isArray(json.ac)) {
        throw new Error("Invalid ADS-B response: expected an aircraft array");
      }
      const list = json.ac;
      const responseTime = Number(json.now);
      const now = Number.isFinite(responseTime) && responseTime > 0
        ? new Date(responseTime < 1e12 ? responseTime * 1000 : responseTime).toISOString()
        : new Date().toISOString();
      const out: Flight[] = [];
      for (const a of list) {
        if (
          !Number.isFinite(a.lat) ||
          !Number.isFinite(a.lon) ||
          (a.lat as number) < -90 ||
          (a.lat as number) > 90 ||
          (a.lon as number) < -180 ||
          (a.lon as number) > 180
        ) continue;
        out.push({
          icao24: (a.hex ?? "").trim().toLowerCase(),
          callsign: (a.flight ?? a.r ?? a.hex ?? "").trim(),
          aircraftType: a.t?.trim().toUpperCase() || null,
          aircraftCategory: a.category?.trim().toUpperCase() || null,
          origin: null,
          destination: null,
          latitude: a.lat as number,
          longitude: a.lon as number,
          altitude: typeof a.alt_baro === "number" ? a.alt_baro * 0.3048 : 0,
          velocity: (a.gs ?? 0) * 0.514444,
          heading: a.track ?? 0,
          timestamp: now,
        });
        if (out.length >= maxAircraft) break;
      }
      if (out.length === 0) {
        throw new Error("ADS-B response contained no valid aircraft positions");
      }
      return out;
    },
    [],
    intervalMs,
    enabled,
  );
}
