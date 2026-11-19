import { describe, expect, it } from "vitest";
import {
  dueAlerts,
  formatAlert,
  isDue,
  parseAlertCommand,
  parsePrice,
  sanitizeAlerts,
  type Alert,
} from "./_shared/alerts";

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  chatId: 7,
  symbol: "BTC",
  direction: "above",
  price: 100_000,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

describe("parsePrice", () => {
  it("acepta enteros, decimales, comas y k", () => {
    expect(parsePrice("95000")).toBe(95_000);
    expect(parsePrice("95,000")).toBe(95_000);
    expect(parsePrice("1.5")).toBe(1.5);
    expect(parsePrice("95k")).toBe(95_000);
  });

  it("rechaza lo que no es un precio positivo", () => {
    expect(parsePrice("0")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("mucho")).toBeNull();
    expect(parsePrice("10% ")).toBeNull();
  });
});

describe("parseAlertCommand", () => {
  it("entiende las cuatro formas del comando", () => {
    expect(parseAlertCommand("/alerta BTC > 95000")).toEqual({ symbol: "BTC", direction: "above", price: 95_000 });
    expect(parseAlertCommand("/alerta eth >= 3000")).toEqual({ symbol: "ETH", direction: "above", price: 3_000 });
    expect(parseAlertCommand("/alerta SOL < 100")).toEqual({ symbol: "SOL", direction: "below", price: 100 });
    expect(parseAlertCommand("/alerta@Alien69Bot btc <= 90k")).toEqual({
      symbol: "BTC",
      direction: "below",
      price: 90_000,
    });
  });

  it("rechaza símbolos sin precio y formas ambiguas", () => {
    expect(parseAlertCommand("/alerta DOGE > 1")).toBeNull();
    expect(parseAlertCommand("/alerta BTC 95000")).toBeNull();
    expect(parseAlertCommand("/alerta BTC > mucho")).toBeNull();
    expect(parseAlertCommand("/alerta")).toBeNull();
    expect(parseAlertCommand("alerta BTC > 1")).toBeNull();
  });
});

describe("isDue / dueAlerts", () => {
  it("dispara al llegar, no antes", () => {
    expect(isDue(alert({ price: 100 }), 99)).toBe(false);
    expect(isDue(alert({ price: 100 }), 100)).toBe(true);
    expect(isDue(alert({ price: 100 }), 101)).toBe(true);
    expect(isDue(alert({ direction: "below", price: 100 }), 101)).toBe(false);
    expect(isDue(alert({ direction: "below", price: 100 }), 100)).toBe(true);
  });

  it("sin precio no dispara nada", () => {
    expect(isDue(alert(), null)).toBe(false);
    expect(dueAlerts([alert(), alert({ symbol: "ETH" })], { BTC: null, ETH: 1 })).toHaveLength(0);
  });

  it("separa las que tocan de las que no", () => {
    const alerts = [
      alert({ symbol: "BTC", price: 100 }),
      alert({ symbol: "ETH", price: 5_000 }),
      alert({ symbol: "SOL", direction: "below", price: 10 }),
    ];
    const due = dueAlerts(alerts, { BTC: 150, ETH: 4_000, SOL: 9 });
    expect(due.map((item) => item.symbol)).toEqual(["BTC", "SOL"]);
  });
});

describe("formatAlert", () => {
  it("dice el precio actual y el aviso, sin adornos", () => {
    const text = formatAlert(alert({ price: 100_000 }), 105_000);
    expect(text).toContain("BTC");
    expect(text).toContain("≥");
    expect(text).toContain("105.000");
    expect(text).toContain("100.000");
  });
});

describe("sanitizeAlerts", () => {
  it("tira lo que Redis pueda tener corrupto", () => {
    const stored = [
      alert(),
      { symbol: "DOGE", price: 1, direction: "above", chatId: 7 },
      { symbol: "BTC", price: 0, direction: "above", chatId: 7 },
      { symbol: "BTC", price: 5, direction: "sideways", chatId: 7 },
      { symbol: "BTC", price: 5, direction: "above" },
      "basura",
    ];
    expect(sanitizeAlerts(stored)).toHaveLength(1);
    expect(sanitizeAlerts(null)).toEqual([]);
  });
});
