import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  alertFromDraft,
  describeAlert,
  draftFromAlert,
  parseStoredAlerts,
  priceConditionMet,
  uapMatches,
  upsertAlert,
  validateDraft,
  type PriceAlert,
  type UapAlert,
} from "./alerts";

const priceAlert: PriceAlert = {
  id: "p1",
  kind: "price",
  coinId: "bitcoin",
  direction: "above",
  threshold: 70000,
  active: true,
  triggered: false,
  createdAt: "2026-10-01T00:00:00.000Z",
};

const uapAlert: UapAlert = {
  id: "u1",
  kind: "uap",
  keyword: "orbe",
  active: true,
  triggered: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  seen: ["row-1"],
};

describe("alertas guardadas", () => {
  it("ignora JSON roto y valores que no son listas", () => {
    expect(parseStoredAlerts("{no es json")).toEqual([]);
    expect(parseStoredAlerts("\"hola\"")).toEqual([]);
    expect(parseStoredAlerts(null)).toEqual([]);
  });

  it("conserva las alertas actuales", () => {
    const parsed = parseStoredAlerts(JSON.stringify([priceAlert, uapAlert]));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(priceAlert);
    expect(parsed[1]).toEqual(uapAlert);
  });

  it("migra el formato antiguo de precio y descarta los tipos que no comprobaban nada", () => {
    const legacy = JSON.stringify([
      { id: "old-1", type: "price", label: "BTC > 70,000", coinId: "bitcoin", threshold: 70000, direction: "above", active: true },
      { id: "old-2", type: "uap", label: "UAP", condition: "any" },
      { id: "old-3", type: "geopolitical", label: "Geo", condition: "any" },
      { id: "old-4", type: "price", coinId: "eth", threshold: 0 },
    ]);
    const parsed = parseStoredAlerts(legacy);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "old-1", kind: "price", coinId: "bitcoin", threshold: 70000 });
  });

  it("completa los ids ya notificados cuando faltan", () => {
    const parsed = parseStoredAlerts(JSON.stringify([{ ...uapAlert, seen: undefined }]));
    expect((parsed[0] as UapAlert).seen).toEqual([]);
  });
});

describe("validación del formulario", () => {
  it("exige un umbral numérico positivo", () => {
    expect(validateDraft({ ...EMPTY_DRAFT, threshold: "" })).toMatch(/umbral/);
    expect(validateDraft({ ...EMPTY_DRAFT, threshold: "abc" })).toMatch(/número/);
    expect(validateDraft({ ...EMPTY_DRAFT, threshold: "-5" })).toMatch(/número/);
    expect(validateDraft({ ...EMPTY_DRAFT, threshold: "69000" })).toBeNull();
  });

  it("acepta coma decimal", () => {
    expect(validateDraft({ ...EMPTY_DRAFT, threshold: "0,45" })).toBeNull();
  });

  it("pide una palabra clave de longitud razonable", () => {
    expect(validateDraft({ ...EMPTY_DRAFT, kind: "uap", keyword: "or" })).toMatch(/3 caracteres/);
    expect(validateDraft({ ...EMPTY_DRAFT, kind: "uap", keyword: "x".repeat(61) })).toMatch(/60/);
    expect(validateDraft({ ...EMPTY_DRAFT, kind: "uap", keyword: "volcán" })).toBeNull();
  });
});

describe("crear y editar", () => {
  it("crea una alerta de precio nueva y activa", () => {
    const alert = alertFromDraft({ ...EMPTY_DRAFT, coinId: "solana", threshold: "150", direction: "below" });
    expect(alert.kind).toBe("price");
    expect(alert.id).toBeTruthy();
    expect(alert.active).toBe(true);
    if (alert.kind === "price") {
      expect(alert.threshold).toBe(150);
      expect(alert.direction).toBe("below");
    }
  });

  it("al editar conserva id, fecha, estado y lo ya notificado", () => {
    const edited = alertFromDraft({ ...draftFromAlert(uapAlert), keyword: "triángulo" }, uapAlert);
    expect(edited.id).toBe(uapAlert.id);
    expect(edited.createdAt).toBe(uapAlert.createdAt);
    expect(edited.active).toBe(true);
    if (edited.kind === "uap") {
      expect(edited.keyword).toBe("triángulo");
      expect(edited.seen).toEqual(["row-1"]);
    }
    expect(edited.triggered).toBe(false);
  });

  it("reemplaza en sitio en vez de duplicar", () => {
    const list = upsertAlert([priceAlert], { ...priceAlert, threshold: 80000 });
    expect(list).toHaveLength(1);
    expect((list[0] as PriceAlert).threshold).toBe(80000);
  });
});

describe("disparo", () => {
  it("compara precio según la dirección", () => {
    expect(priceConditionMet(priceAlert, 71000)).toBe(true);
    expect(priceConditionMet(priceAlert, 69000)).toBe(false);
    expect(priceConditionMet({ ...priceAlert, direction: "below" }, 69000)).toBe(true);
  });

  it("busca la palabra clave sin distinguir mayúsculas en ubicación, tipo y descripción", () => {
    expect(uapMatches(uapAlert, { location: "Hessdalen", description: "Un ORBE luminoso" })).toBe(true);
    expect(uapMatches(uapAlert, { type: "Orbe" })).toBe(true);
    expect(uapMatches(uapAlert, { description: "luces en el cielo" })).toBe(false);
  });

  it("describe la alerta en español con el símbolo de la moneda", () => {
    expect(describeAlert(priceAlert)).toContain("BTC");
    expect(describeAlert(priceAlert)).toContain("sube");
    expect(describeAlert(uapAlert)).toBe("Avistamiento con «orbe»");
  });
});
