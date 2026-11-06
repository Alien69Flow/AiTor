import type { AnomalyRecord } from "./war-gov-uap";

export type { AnomalyRecord };

/**
 * How many records each feed may contribute to the anomaly registry.
 *
 * The registry sorts everything by date, newest first, and the three feeds have
 * very different shapes: the official releases are a finite archive (478
 * records today) published between May and October 2026, the UAP table holds a
 * handful of rows, and the NUFORC mirror is a frozen snapshot that stopped in
 * 2022. Without a cap the mirror alone could push the network payload up by tens
 * of thousands of rows; with a cap per source, one feed growing cannot silently
 * evict another, which is exactly what happened when the official releases were
 * missing entirely.
 */
export const ANOMALY_SOURCE_LIMITS = {
  /** The whole published archive, with headroom for a few more releases. */
  warGov: 480,
  /** Newest reports of a frozen mirror; they are the oldest entries by far. */
  nuforc: 180,
} as const;

export interface AnomalySources {
  /** Rows stored in the `uap_sightings` table. */
  table: AnomalyRecord[];
  /** Official releases from war.gov/ufo. */
  warGov: AnomalyRecord[];
  /** Third-party reports from the open NUFORC mirror. */
  nuforc: AnomalyRecord[];
}

export interface AnomalyRegistry {
  records: AnomalyRecord[];
  counts: {
    table: number;
    warGov: number;
    nuforc: number;
    total: number;
  };
}

/** Newest first; the id breaks ties so a same-day release has a stable order. */
function byDateDesc(a: AnomalyRecord, b: AnomalyRecord) {
  const toTime = (value: string | null) => {
    const time = Date.parse(value ?? "");
    return Number.isNaN(time) ? 0 : time;
  };
  const delta = toTime(b.date_reported) - toTime(a.date_reported);
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/** Drops records whose id was already taken by a feed higher in the list. */
function unique(records: AnomalyRecord[], seen: Set<string>) {
  const kept: AnomalyRecord[] = [];
  for (const record of records) {
    if (!record.id || seen.has(record.id)) continue;
    seen.add(record.id);
    kept.push(record);
  }
  return kept;
}

/**
 * Merges the three feeds into the single chronological list the registry paints.
 *
 * `table` first (it is the app's own data), then the official releases, then the
 * mirror: on a duplicate id the higher feed wins, and each feed is capped before
 * the merge so the totals stay predictable whatever a source returns.
 */
export function mergeAnomalyRecords(sources: AnomalySources): AnomalyRegistry {
  const seen = new Set<string>();

  const table = unique([...sources.table].sort(byDateDesc), seen);
  const warGov = unique([...sources.warGov].sort(byDateDesc).slice(0, ANOMALY_SOURCE_LIMITS.warGov), seen);
  const nuforc = unique([...sources.nuforc].sort(byDateDesc).slice(0, ANOMALY_SOURCE_LIMITS.nuforc), seen);

  const records = [...table, ...warGov, ...nuforc].sort(byDateDesc);

  return {
    records,
    counts: {
      table: table.length,
      warGov: warGov.length,
      nuforc: nuforc.length,
      total: records.length,
    },
  };
}
