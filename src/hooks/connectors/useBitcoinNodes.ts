import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface BitcoinNode {
  id: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  userAgent: string;
}

const BITNODES_URL = "https://bitnodes.io/api/v1/snapshots/latest/";

interface BitnodesSnapshot {
  // address -> [protocol, user_agent, ts, services, height, hostname, city, country, lat, lon, tz, asn, org]
  nodes?: Record<string, unknown[]>;
}

/** Bitnodes reachable-node snapshot, geolocated. Capped to protect the GPU. */
export function useBitcoinNodes(enabled: boolean, maxNodes = 600, intervalMs = 900_000) {
  return usePolledConnector<BitcoinNode[]>(
    async (signal) => {
      const json = await safeFetchJson<BitnodesSnapshot>(BITNODES_URL, { signal, timeoutMs: 15000 });
      const entries = Object.entries(json.nodes ?? {});
      const out: BitcoinNode[] = [];
      const step = Math.max(1, Math.floor(entries.length / maxNodes));
      for (let i = 0; i < entries.length; i += step) {
        const [addr, v] = entries[i];
        const lat = Number(v?.[8]);
        const lon = Number(v?.[9]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
          id: addr,
          lat,
          lon,
          city: String(v?.[6] ?? ""),
          country: String(v?.[7] ?? ""),
          userAgent: String(v?.[1] ?? ""),
        });
        if (out.length >= maxNodes) break;
      }
      if (!out.length) throw new Error("no geolocated nodes");
      return out;
    },
    [],
    intervalMs,
    enabled,
  );
}
