import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface TideObservation { station: string; name: string; lat: number; lon: number; heightM: number; time: string; source: string; provisional: boolean }
const STATIONS = ["8518750", "9414290", "1612340"];
interface TideResponse {
  metadata?: { id: string; name: string; lat: string; lon: string };
  data?: { t: string; v: string; q: string }[];
}

export function useTides() {
  return usePolledConnector<TideObservation[]>(async signal => {
    const result = await Promise.allSettled(STATIONS.map(async station => {
      const data = await safeFetchJson<TideResponse>(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&date=latest&datum=MLLW&station=${station}&time_zone=gmt&units=metric&format=json`, { signal, timeoutMs: 9000 });
      const row = data.data?.[0]; const meta = data.metadata;
      if (!row || !meta || !row.v.trim() || !Number.isFinite(Number(row.v))) return null;
      return { station, name: meta.name, lat: Number(meta.lat), lon: Number(meta.lon), heightM: Number(row.v), time: row.t.replace(" ", "T") + "Z", source: "NOAA CO-OPS", provisional: row.q === "p" } satisfies TideObservation;
    }));
    const rows = result.flatMap(r => r.status === "fulfilled" && r.value ? [r.value] : []);
    if (!rows.length) throw new Error("No coastal observations available");
    return rows;
  }, [], 360000, true);
}