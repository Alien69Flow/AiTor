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
      const list = json.ac ?? [];
      const now = new Date(json.now ?? Date.now()).toISOString();
      const out: Flight[] = [];
      for (const a of list) {
        if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
        out.push({
          icao24: a.hex ?? "",
          callsign: (a.flight ?? a.r ?? a.hex ?? "").trim(),
          origin: a.t ?? null,
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
      if (!out.length) throw new Error("no aircraft in feed");
      return out;
    },
    [],
    intervalMs,
    enabled,
  );
}
