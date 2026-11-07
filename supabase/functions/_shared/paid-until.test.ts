import { describe, expect, it } from "vitest";
import { PERIOD_DAYS, extendPaidUntil } from "./paid-until";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe("hasta cuándo vale un plan pagado", () => {
  it("sin fecha previa cuenta desde ahora", () => {
    expect(extendPaidUntil(null, 30, NOW)).toBe(days(30));
    expect(extendPaidUntil(undefined, 90, NOW)).toBe(days(90));
    expect(extendPaidUntil("", 365, NOW)).toBe(days(365));
  });

  it("renovar antes de tiempo suma el periodo a lo que quedaba", () => {
    expect(extendPaidUntil(days(10), 30, NOW)).toBe(days(40));
  });

  it("un plan ya vencido no se hereda: se cuenta desde ahora", () => {
    expect(extendPaidUntil(days(-90), 30, NOW)).toBe(days(30));
  });

  it("vencer justo ahora se trata como vencido", () => {
    expect(extendPaidUntil(days(0), 30, NOW)).toBe(days(30));
  });

  it("una fecha corrupta no rompe el cobro", () => {
    expect(extendPaidUntil("no-es-una-fecha", 30, NOW)).toBe(days(30));
  });

  it("los periodos del cobro son los que anuncia el modal", () => {
    expect(PERIOD_DAYS).toEqual({ monthly: 30, quarterly: 90, yearly: 365 });
  });
});
