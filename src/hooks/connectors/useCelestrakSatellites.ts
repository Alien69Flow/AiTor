import { useEffect, useRef, useState } from "react";
import * as satellite from "satellite.js";
import { safeFetchJson } from "@/lib/connectors";

export interface SatellitePosition {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altKm: number;
}

interface GpJson {
  OBJECT_NAME?: string;
  NORAD_CAT_ID?: number;
  TLE_LINE1?: string;
  TLE_LINE2?: string;
  EPOCH?: string;
  MEAN_MOTION?: number;
  ECCENTRICITY?: number;
  INCLINATION?: number;
  RA_OF_ASC_NODE?: number;
  ARG_OF_PERICENTER?: number;
  MEAN_ANOMALY?: number;
  BSTAR?: number;
  CLASSIFICATION_TYPE?: string;
  ELEMENT_SET_NO?: number;
  EPHEMERIS_TYPE?: number;
  REV_AT_EPOCH?: number;
}

const GP_ACTIVE = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json";
const GP_TLE_FALLBACK = "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle";

type Rec = { name: string; satrec: satellite.SatRec };

function pad(n: number, len: number, dec: number) {
  return n.toFixed(dec).padStart(len, "0");
}

/** Rebuilds the two TLE lines from CelesTrak GP JSON (OMM) fields. */
function jsonToTle(o: GpJson): [string, string] | null {
  if (o.TLE_LINE1 && o.TLE_LINE2) return [o.TLE_LINE1, o.TLE_LINE2];
  const id = o.NORAD_CAT_ID;
  const epoch = o.EPOCH;
  if (!id || !epoch) return null;
  const d = new Date(epoch);
  const yy = String(d.getUTCFullYear()).slice(2);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const doy = (d.getTime() - start) / 86400000 + 1;
  const l1 =
    `1 ${String(id).padStart(5, "0")}U 00000A   ${yy}${pad(doy, 12, 8)} ` +
    ` .00000000  00000-0  00000-0 0  9990`;
  const l2 =
    `2 ${String(id).padStart(5, "0")} ${pad(o.INCLINATION ?? 0, 8, 4)} ` +
    `${pad(o.RA_OF_ASC_NODE ?? 0, 8, 4)} ` +
    `${String((o.ECCENTRICITY ?? 0).toFixed(7)).slice(2)} ` +
    `${pad(o.ARG_OF_PERICENTER ?? 0, 8, 4)} ${pad(o.MEAN_ANOMALY ?? 0, 8, 4)} ` +
    `${pad(o.MEAN_MOTION ?? 0, 11, 8)}${String(o.REV_AT_EPOCH ?? 0).padStart(5, "0")}0`;
  return [l1, l2];
}

async function loadRecords(signal: AbortSignal, max: number): Promise<Rec[]> {
  const out: Rec[] = [];
  try {
    const json = await safeFetchJson<GpJson[]>(GP_ACTIVE, { signal, timeoutMs: 20000 });
    const step = Math.max(1, Math.floor(json.length / max));
    for (let i = 0; i < json.length && out.length < max; i += step) {
      const o = json[i];
      const tle = jsonToTle(o);
      if (!tle) continue;
      try {
        const satrec = satellite.twoline2satrec(tle[0], tle[1]);
        if (satrec && !(satrec as any).error) {
          out.push({ name: o.OBJECT_NAME ?? `NORAD ${o.NORAD_CAT_ID}`, satrec });
        }
      } catch {
        /* skip malformed element set */
      }
    }
  } catch {
    /* fall through to plain TLE stations feed */
  }

  if (out.length) return out;

  try {
    const res = await fetch(GP_TLE_FALLBACK, { signal });
    if (!res.ok) return out;
    const lines = (await res.text()).split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i + 2 < lines.length && out.length < max; i += 3) {
      if (!lines[i + 1].startsWith("1 ") || !lines[i + 2].startsWith("2 ")) continue;
      try {
        out.push({ name: lines[i], satrec: satellite.twoline2satrec(lines[i + 1], lines[i + 2]) });
      } catch {
        /* skip */
      }
    }
  } catch {
    /* silent */
  }
  return out;
}

/**
 * CelesTrak GP (active catalogue) propagated client-side with satellite.js.
 * The catalogue load is deferred; propagation runs on a light 5s tick.
 */
export function useCelestrakSatellites(enabled: boolean, max = 180) {
  const [positions, setPositions] = useState<SatellitePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recsRef = useRef<Rec[]>([]);

  useEffect(() => {
    if (!enabled) {
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    let timer: number | undefined;
    setLoading(true);

    const tick = () => {
      const now = new Date();
      const gmst = satellite.gstime(now);
      const next: SatellitePosition[] = [];
      recsRef.current.forEach((r, i) => {
        try {
          const pv = satellite.propagate(r.satrec, now);
          if (!pv || typeof pv.position === "boolean" || !pv.position) return;
          const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
          const lat = satellite.degreesLat(geo.latitude);
          const lon = satellite.degreesLong(geo.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
          next.push({ id: `sat-${i}`, name: r.name, lat, lon, altKm: geo.height });
        } catch {
          /* decayed object */
        }
      });
      if (!ctrl.signal.aborted) setPositions(next);
    };

    (async () => {
      try {
        if (!recsRef.current.length) recsRef.current = await loadRecords(ctrl.signal, max);
        if (ctrl.signal.aborted) return;
        if (!recsRef.current.length) setError("catalogue unavailable");
        tick();
        timer = window.setInterval(tick, 5000);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "satellite error");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      if (timer) clearInterval(timer);
    };
  }, [enabled, max]);

  return { positions, loading, error };
}
