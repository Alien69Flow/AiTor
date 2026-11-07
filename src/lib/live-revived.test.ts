import { describe, expect, it } from "vitest";
import {
  LIVE_REVIVED_STORAGE_KEY,
  markRevived,
  pruneRevived,
  readRevived,
  writeRevived,
} from "./live-revived";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-25T12:00:00.000Z");

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    dump: () => Object.fromEntries(data),
  };
};

describe("cámaras revividas", () => {
  it("descarta fechas viejas, inválidas o futuras", () => {
    const map = {
      vieja: new Date(NOW - 20 * DAY).toISOString(),
      fresca: new Date(NOW - 2 * DAY).toISOString(),
      futura: new Date(NOW + DAY).toISOString(),
      rota: "ayer",
      numero: 42,
    };
    expect(pruneRevived(map, NOW)).toEqual({ fresca: map.fresca });
  });

  it("tolera datos que no son un mapa", () => {
    expect(pruneRevived(null, NOW)).toEqual({});
    expect(pruneRevived([], NOW)).toEqual({});
    expect(pruneRevived("{}", NOW)).toEqual({});
  });

  it("marca una cámara sin perder las anteriores", () => {
    const map = markRevived({ otra: "2026-10-24T00:00:00.000Z" }, "iss-hd", NOW);
    expect(map["iss-hd"]).toBe("2026-10-25T12:00:00.000Z");
    expect(map.otra).toBe("2026-10-24T00:00:00.000Z");
  });

  it("lee y escribe en el almacenamiento con la clave pactada", () => {
    const storage = memoryStorage();
    writeRevived({ "iss-hd": new Date(NOW).toISOString() }, storage);
    expect(storage.dump()[LIVE_REVIVED_STORAGE_KEY]).toContain("iss-hd");
    expect(readRevived(storage)).toEqual({ "iss-hd": new Date(NOW).toISOString() });
  });

  it("un almacenamiento corrupto o ausente no rompe la app", () => {
    const broken = { getItem: () => "{no json", setItem: () => undefined };
    expect(readRevived(broken)).toEqual({});
    expect(readRevived(null)).toEqual({});
    expect(() => writeRevived({ a: new Date(NOW).toISOString() }, null)).not.toThrow();
  });
});
