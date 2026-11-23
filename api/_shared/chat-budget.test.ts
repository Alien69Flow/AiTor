import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetBudgetForTest,
  budgetDay,
  budgetKey,
  budgetResetAt,
  dailyLimit,
  DEFAULT_DAILY_LIMIT,
  formatBudgetExceeded,
  peekBudget,
  takeTurn,
} from "./chat-budget.js";

/**
 * El tope tiene que cortar de verdad: contar por chat, reiniciarse cada día UTC
 * y decir lo usado. Sin Redis se cuenta por instancia y se declara así.
 */

const NOON = new Date("2026-11-23T12:00:00Z");

beforeEach(() => {
  __resetBudgetForTest();
});

describe("configuración", () => {
  it("el tope por defecto es 40", () => {
    expect(DEFAULT_DAILY_LIMIT).toBe(40);
    expect(dailyLimit(undefined)).toBe(40);
  });

  it("CHAT_DAILY_TURN_LIMIT manda si es un entero positivo", () => {
    expect(dailyLimit("5")).toBe(5);
    expect(dailyLimit(" 12 ")).toBe(12);
    expect(dailyLimit("0")).toBe(DEFAULT_DAILY_LIMIT);
    expect(dailyLimit("-3")).toBe(DEFAULT_DAILY_LIMIT);
    expect(dailyLimit("muchas")).toBe(DEFAULT_DAILY_LIMIT);
  });
});

describe("clave y día", () => {
  it("el día es UTC y el reinicio es la medianoche siguiente", () => {
    expect(budgetDay(NOON)).toBe("2026-11-23");
    expect(budgetResetAt(NOON)).toBe("2026-11-24T00:00:00.000Z");
    expect(budgetDay(new Date("2026-11-23T23:59:59Z"))).toBe("2026-11-23");
  });

  it("la clave no lleva el chat_id en claro", () => {
    const key = budgetKey(123456, "2026-11-23");
    expect(key).toContain("2026-11-23");
    expect(key).not.toContain("123456");
    expect(key).toMatch(/[0-9a-f]{16}$/);
  });
});

describe("takeTurn (sin Redis)", () => {
  it("permite hasta el tope y luego corta", async () => {
    const options = { now: NOON, limit: 2 };
    expect((await takeTurn(7, options)).allowed).toBe(true);
    expect((await takeTurn(7, options)).allowed).toBe(true);
    const third = await takeTurn(7, options);
    expect(third.allowed).toBe(false);
    expect(third.used).toBe(3);
    expect(third.limit).toBe(2);
    expect(third.storage).toBe("memory");
  });

  it("cuenta por chat: el tope de uno no gasta el de otro", async () => {
    const options = { now: NOON, limit: 1 };
    expect((await takeTurn(7, options)).allowed).toBe(true);
    expect((await takeTurn(7, options)).allowed).toBe(false);
    expect((await takeTurn(8, options)).allowed).toBe(true);
  });

  it("se reinicia al cambiar el día UTC", async () => {
    const limit = 1;
    expect((await takeTurn(7, { now: new Date("2026-11-23T23:00:00Z"), limit })).allowed).toBe(true);
    expect((await takeTurn(7, { now: new Date("2026-11-23T23:30:00Z"), limit })).allowed).toBe(false);
    expect((await takeTurn(7, { now: new Date("2026-11-24T00:00:01Z"), limit })).allowed).toBe(true);
  });

  it("el aviso dice lo usado, el tope y cuándo vuelve a cero", async () => {
    const decision = await takeTurn(7, { now: NOON, limit: 1 });
    const text = formatBudgetExceeded(await takeTurn(7, { now: NOON, limit: 1 }));
    expect(decision.allowed).toBe(true);
    expect(text).toContain("Tope diario");
    expect(text).toContain("1 de 1");
    expect(text).toContain("00:00 UTC");
    expect(text).toContain("/senal");
  });
});

describe("peekBudget", () => {
  it("no suma: dice lo que hay", async () => {
    await takeTurn(7, { now: NOON, limit: 5 });
    await takeTurn(7, { now: NOON, limit: 5 });
    const peek = await peekBudget(7, { now: NOON, limit: 5 });
    expect(peek).toEqual({ used: 2, limit: 5, storage: "memory" });
    expect((await peekBudget(7, { now: NOON, limit: 5 })).used).toBe(2);
  });

  it("un chat que no ha hablado está a cero", async () => {
    expect(await peekBudget(99, { now: NOON, limit: 5 })).toEqual({
      used: 0,
      limit: 5,
      storage: "memory",
    });
  });
});
