import { describe, expect, it } from "vitest";
import {
  ANOMALY_SOURCE_LIMITS,
  mergeAnomalyRecords,
  type AnomalyRecord,
} from "./anomaly-registry";

function record(id: string, date: string, severity = "signal"): AnomalyRecord {
  return {
    id,
    location: "Somewhere",
    date_reported: date,
    type: "test",
    severity,
    description: null,
    source: "test",
    source_url: null,
    lat: null,
    lon: null,
  };
}

/**
 * The registry used to merge two feeds and cut the result at 300 rows, so a
 * feed with newer dates (the official releases) could silently push another
 * (the NUFORC mirror) out of the list. These checks pin the ordering and the
 * per-source caps that prevent it.
 */
describe("registro de anomalías", () => {
  it("ordena todo de más reciente a más antiguo", () => {
    const { records } = mergeAnomalyRecords({
      table: [record("t1", "2024-01-01")],
      warGov: [record("w1", "2026-10-23"), record("w2", "2026-05-08")],
      nuforc: [record("n1", "2022-05-12")],
    });
    expect(records.map((entry) => entry.id)).toEqual(["w1", "w2", "t1", "n1"]);
  });

  it("no deja que una fuente desplace a las demás", () => {
    const warGov = Array.from({ length: 300 }, (_, index) =>
      // Todas más nuevas que el espejo, que es el caso real.
      record(`w${index}`, `2026-0${(index % 9) + 1}-01`)
    );
    const { records, counts } = mergeAnomalyRecords({
      table: [record("t1", "2024-02-02")],
      warGov,
      nuforc: [record("n1", "2022-05-12"), record("n2", "2021-01-01")],
    });

    expect(counts).toEqual({ table: 1, warGov: 300, nuforc: 2, total: 303 });
    // El espejo de 2022 sigue en la lista aunque todo lo demás sea más nuevo.
    expect(records.at(-1)?.id).toBe("n2");
  });

  it("respeta el tope del espejo NUFORC", () => {
    const nuforc = Array.from({ length: ANOMALY_SOURCE_LIMITS.nuforc + 25 }, (_, index) =>
      record(`n${index}`, `2022-05-${String((index % 28) + 1).padStart(2, "0")}`)
    );
    const { counts } = mergeAnomalyRecords({ table: [], warGov: [], nuforc });
    expect(counts.nuforc).toBe(ANOMALY_SOURCE_LIMITS.nuforc);
  });

  it("descarta identificadores repetidos entre fuentes", () => {
    const { records, counts } = mergeAnomalyRecords({
      table: [record("same", "2026-01-01")],
      warGov: [record("same", "2026-02-01")],
      nuforc: [],
    });
    expect(records).toHaveLength(1);
    // La tabla es la fuente propia de la app: gana ella.
    expect(records[0].date_reported).toBe("2026-01-01");
    expect(counts.warGov).toBe(0);
  });

  it("no inventa fechas: los registros sin fecha van al final", () => {
    const { records } = mergeAnomalyRecords({
      table: [],
      warGov: [record("sin-fecha", "")],
      nuforc: [record("con-fecha", "1999-12-31")],
    });
    expect(records.map((entry) => entry.id)).toEqual(["con-fecha", "sin-fecha"]);
  });

  it("devuelve una lista vacía cuando ninguna fuente responde", () => {
    const { records, counts } = mergeAnomalyRecords({ table: [], warGov: [], nuforc: [] });
    expect(records).toEqual([]);
    expect(counts.total).toBe(0);
  });
});
