import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mapWarGovRecords, type WarGovSnapshot } from "./war-gov-uap";

const fixture: WarGovSnapshot = {
  generatedAt: "2026-10-30T00:00:00.000Z",
  total: 2,
  latestRelease: "2026-10-23",
  earliestRelease: "2026-05-08",
  releases: [{ date: "2026-10-23", count: 2 }],
  agencies: [{ name: "Department of War", count: 2 }],
  records: [
    {
      id: "wargov-dow-uap-d155",
      release: "2026-10-23",
      title: "DOW-UAP-D155, Air Intelligence Information Report, Saudi Arabia, 1957",
      type: "PDF oficial",
      agency: "Department of War",
      incident: "1/18/1957",
      location: "Saudi Arabia",
      featured: true,
      blurb: "Air Intelligence Information Report of a 1957 incident.",
      url: "https://www.war.gov/medialink/ufo/release-07/documents/DOW-UAP-D155.pdf",
    },
    {
      id: "wargov-sin-ubicacion",
      release: "2026-10-23",
      title: "Undisclosed event",
      type: "Vídeo oficial",
      agency: null,
      incident: null,
      location: null,
      featured: false,
      blurb: null,
      url: "https://www.war.gov/ufo/",
    },
  ],
};

describe("registros oficiales de war.gov/ufo", () => {
  it("fecha cada registro por su entrega, no por el incidente", () => {
    const [first] = mapWarGovRecords(fixture);
    // El caso es de 1957 pero se publicó en 2026: si se fechara por el
    // incidente, la revelación nunca aparecería al principio del registro.
    expect(first.date_reported).toBe("2026-10-23");
    expect(first.description).toContain("Incidente: 1/18/1957");
  });

  it("marca la procedencia y enlaza el documento", () => {
    const [first] = mapWarGovRecords(fixture);
    expect(first.severity).toBe("official");
    expect(first.source).toBe("war.gov/ufo · Department of War");
    expect(first.source_url).toMatch(/^https:\/\/www\.war\.gov\//);
    expect(first.title).toContain("DOW-UAP-D155");
  });

  it("no inventa una ubicación cuando la agencia no la declara", () => {
    const [, second] = mapWarGovRecords(fixture);
    expect(second.location).toBe("Ubicación no declarada");
    expect(second.source).toBe("war.gov/ufo");
  });

  it("tolera un snapshot ausente", () => {
    expect(mapWarGovRecords(null)).toEqual([]);
    expect(mapWarGovRecords({ ...fixture, records: [] })).toEqual([]);
  });
});

/**
 * The snapshot is a committed artifact: if the sync script breaks, the file is
 * what ships. These checks read the real file so a corrupt or empty snapshot
 * fails here instead of silently emptying the anomaly feed.
 */
describe("snapshot publicado de war.gov/ufo", () => {
  // `import.meta.url` no sirve aquí: bajo jsdom es una URL http, y `readFileSync`
  // exige un esquema file. Vitest corre desde la raíz del proyecto.
  const raw = readFileSync(resolve(process.cwd(), "public/data/war-gov-uap.json"), "utf8");
  const snapshot = JSON.parse(raw) as WarGovSnapshot;

  it("contiene las entregas reales del Departamento de Guerra", () => {
    expect(snapshot.total).toBeGreaterThan(400);
    expect(snapshot.records).toHaveLength(snapshot.total);
    expect(snapshot.releases.length).toBeGreaterThanOrEqual(7);
    // La entrega más reciente del sitio, comprobada el 30 oct 2026.
    expect(snapshot.latestRelease).toBe("2026-10-23");
  });

  it("cada registro se puede pintar en el registro de anomalías", () => {
    const mapped = mapWarGovRecords(snapshot);
    expect(mapped).toHaveLength(snapshot.total);
    expect(new Set(mapped.map((entry) => entry.id)).size).toBe(mapped.length);
    for (const entry of mapped) {
      expect(entry.date_reported).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.source_url).toMatch(/^https:\/\//);
      expect(entry.location.trim()).not.toBe("");
    }
  });
});
