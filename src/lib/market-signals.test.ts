/**
 * Pruebas del motor de señales de mercado.
 *
 * Se comprueban las tres cosas que pueden salir mal en un panel así: que la
 * aritmética del funding esté bien normalizada, que una misma base CEX/DEX no
 * signifique lo mismo con liquidez fina que con liquidez honda, y que con datos
 * incompletos el motor calle en vez de inventar.
 */
import { describe, expect, it } from "vitest";
import {
  DEX_SHARE_SMALL,
  FUNDING_EXTREME_ANNUAL,
  annualizeFunding,
  analyzeMarket,
  cexDexBasisBps,
  maxTradeForImpact,
  riskScore,
  turnoverRatio,
} from "./market-signals";

const ids = (snapshot: Parameters<typeof analyzeMarket>[0]) =>
  analyzeMarket(snapshot).map((signal) => signal.id);

describe("funding anualizado", () => {
  it("normaliza el periodo: 0,01 % cada 8 h es un 10,95 % anual", () => {
    // El error clásico es leer la tasa del periodo como si fuera anual.
    expect(annualizeFunding(0.0001, 8)).toBeCloseTo(0.1095, 6);
    expect(annualizeFunding(0.0001, 4)).toBeCloseTo(0.219, 6);
    expect(annualizeFunding(0.0001, 1)).toBeCloseTo(0.876, 6);
  });

  it("dos exchanges con el mismo coste real dan el mismo anualizado", () => {
    // 0,01 % cada 8 h y 0,02 % cada 4 h cobran lo mismo por hora.
    expect(annualizeFunding(0.0001, 8)).toBeCloseTo(annualizeFunding(0.0002, 4), 9);
  });

  it("respeta el signo y el periodo por defecto", () => {
    expect(annualizeFunding(-0.0002, 8)).toBeCloseTo(-0.219, 6);
    expect(annualizeFunding(0.00005)).toBeCloseTo(annualizeFunding(0.00005, 8), 9);
  });

  it("un periodo imposible no se convierte en infinito", () => {
    expect(annualizeFunding(0.0001, 0)).toBe(0);
    expect(annualizeFunding(0.0001, -8)).toBe(0);
    expect(annualizeFunding(0.0001, Number.NaN)).toBe(0);
    expect(annualizeFunding(Number.NaN, 8)).toBe(0);
    expect(annualizeFunding(null, 8)).toBe(0);
    expect(Number.isFinite(annualizeFunding(0.0001, 0))).toBe(true);
  });
});

describe("impacto de una orden sobre la liquidez", () => {
  it("a 1 % de impacto en un pool de 1 M$ la orden es de 10,1 k$", () => {
    // x = L · i / (1 − i): el 1 % se mide contra el precio final, no el inicial.
    expect(maxTradeForImpact(1_000_000, 1)).toBeCloseTo(10_101.01, 1);
    expect(maxTradeForImpact(1_000_000, 2)).toBeCloseTo(20_408.16, 1);
  });

  it("es monótono y acotado", () => {
    const values = [0.5, 1, 2, 5, 10].map((impact) => maxTradeForImpact(500_000, impact));
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    // Un impacto del 0 % o del 100 % no tiene orden finita: se devuelve 0.
    expect(maxTradeForImpact(500_000, 0)).toBe(0);
    expect(maxTradeForImpact(500_000, 100)).toBe(0);
    expect(maxTradeForImpact(0, 1)).toBe(0);
    expect(maxTradeForImpact(Number.NaN, 1)).toBe(0);
  });

  it("la rotación es volumen entre liquidez y no divide por cero", () => {
    expect(turnoverRatio(10_000_000, 2_000_000)).toBe(5);
    expect(turnoverRatio(1_000_000, 0)).toBe(0);
    expect(turnoverRatio(null, 1_000_000)).toBe(0);
  });

  it("la base CEX/DEX se mide en puntos básicos", () => {
    expect(cexDexBasisBps(100, 100)).toBe(0);
    expect(cexDexBasisBps(100, 101)).toBeCloseTo(100, 6);
    expect(cexDexBasisBps(100, 99)).toBeCloseTo(-100, 6);
    expect(cexDexBasisBps(0, 100)).toBe(0);
    expect(cexDexBasisBps(Number.NaN, 100)).toBe(0);
  });
});

describe("funding contra interés abierto", () => {
  it("funding extremo y OI subiendo es alerta de longs apiñados", () => {
    const signals = analyzeMarket({
      fundingRate: 0.0006, // 65,7 % anual
      fundingIntervalHours: 8,
      openInterestChange24hPct: 12,
    });
    expect(signals.map((s) => s.id)).toContain("funding-longs-crowded");
    expect(signals[0].severity).toBe("alert");
    expect(annualizeFunding(0.0006, 8)).toBeGreaterThanOrEqual(FUNDING_EXTREME_ANNUAL);
  });

  it("funding muy negativo y OI subiendo es alerta de shorts apiñados", () => {
    const signals = analyzeMarket({
      fundingRate: -0.0006,
      fundingIntervalHours: 8,
      openInterestChange24hPct: 9,
    });
    expect(signals.map((s) => s.id)).toEqual(["funding-shorts-crowded"]);
    expect(signals[0].severity).toBe("alert");
  });

  it("funding alto con OI cayendo es un eco, no apalancamiento nuevo", () => {
    const signals = analyzeMarket({
      fundingRate: 0.0003, // 32,8 % anual
      fundingIntervalHours: 8,
      openInterestChange24hPct: -20,
    });
    expect(signals.map((s) => s.id)).toEqual(["funding-unwind"]);
    expect(signals[0].severity).toBe("info");
  });

  it("sin variación de OI no se afirma que entre dinero nuevo", () => {
    const signals = analyzeMarket({ fundingRate: 0.0003, fundingIntervalHours: 8 });
    expect(signals.map((s) => s.id)).toEqual(["funding-elevated-no-oi"]);
    expect(signals[0].detail).toContain("no se");
  });

  it("funding bajo no genera señal", () => {
    expect(ids({ fundingRate: 0.00005, openInterestChange24hPct: 40 })).toEqual([]);
    expect(ids({ fundingRate: 0 })).toEqual([]);
  });
});

describe("liquidez y rotación", () => {
  it("liquidez fina es alerta y dice cuánto cuesta mover el precio", () => {
    const signals = analyzeMarket({ liquidityUsd: 90_000, volume24hUsd: 300_000 });
    const thin = signals.find((s) => s.id === "liquidity-thin");
    expect(thin?.severity).toBe("alert");
    expect(thin?.detail).toContain("1 %");
  });

  it("volumen veinte veces la liquidez es rotación extrema", () => {
    expect(ids({ liquidityUsd: 1_000_000, volume24hUsd: 25_000_000 })).toContain("turnover-high");
    expect(ids({ liquidityUsd: 1_000_000, volume24hUsd: 9_000_000 })).toContain("turnover-elevated");
    expect(ids({ liquidityUsd: 1_000_000, volume24hUsd: 2_000_000 })).toEqual([]);
  });

  it("sin liquidez no se opina de rotación", () => {
    // Volumen alto sin profundidad conocida no permite decir nada del libro.
    expect(ids({ volume24hUsd: 900_000_000 })).toEqual([]);
  });
});

describe("CEX contra DEX", () => {
  it("la misma base es alerta con liquidez fina y aviso con liquidez honda", () => {
    const thin = analyzeMarket({
      cexPrice: 100,
      dexPrice: 104,
      liquidityUsd: 200_000,
    }).find((s) => s.id === "basis-wide");
    expect(thin?.severity).toBe("alert");
    expect(thin?.detail).toContain("provocar");

    const deep = analyzeMarket({
      cexPrice: 100,
      dexPrice: 104,
      liquidityUsd: 40_000_000,
    }).find((s) => s.id === "basis-wide");
    expect(deep?.severity).toBe("alert");
    expect(deep?.detail).toContain("arbitraje");
  });

  it("una base moderada es aviso y una normal no dice nada", () => {
    expect(ids({ cexPrice: 100, dexPrice: 100.8 })).toContain("basis-wide-watch");
    expect(ids({ cexPrice: 100, dexPrice: 100.05 })).toEqual([]);
  });

  it("si casi todo el volumen es CEX, el precio DEX informa poco", () => {
    const signal = analyzeMarket({ cexVolume24hUsd: 100_000_000, dexVolume24hUsd: 1_000_000 })
      .find((s) => s.id === "cex-dominated");
    expect(signal?.severity).toBe("info");
    expect(signal?.metric).toBeLessThan(DEX_SHARE_SMALL);
  });

  it("un mercado repartido no dispara nada", () => {
    expect(ids({ cexVolume24hUsd: 10_000_000, dexVolume24hUsd: 9_000_000 })).toEqual([]);
  });
});

describe("composición", () => {
  it("un retrato sano no genera señales", () => {
    expect(
      ids({
        fundingRate: 0.00005,
        fundingIntervalHours: 8,
        openInterestChange24hPct: 1,
        volume24hUsd: 10_000_000,
        liquidityUsd: 50_000_000,
        cexPrice: 100,
        dexPrice: 100.05,
        cexVolume24hUsd: 40_000_000,
        dexVolume24hUsd: 20_000_000,
      }),
    ).toEqual([]);
  });

  it("ordena de más a menos urgente y es determinista", () => {
    const snapshot = {
      fundingRate: 0.0006,
      fundingIntervalHours: 8,
      openInterestChange24hPct: 15,
      liquidityUsd: 100_000,
      volume24hUsd: 5_000_000,
      cexPrice: 100,
      dexPrice: 110,
      cexVolume24hUsd: 90_000_000,
      dexVolume24hUsd: 500_000,
    };
    const first = analyzeMarket(snapshot);
    const second = analyzeMarket(snapshot);
    expect(first.map((s) => s.id)).toEqual(second.map((s) => s.id));
    expect(first[0].severity).toBe("alert");
    expect(first[first.length - 1].severity).toBe("info");
    for (let i = 1; i < first.length; i += 1) {
      const order = { alert: 0, watch: 1, info: 2 } as const;
      expect(order[first[i].severity]).toBeGreaterThanOrEqual(order[first[i - 1].severity]);
    }
  });

  it("un retrato vacío no lanza y puntúa cero", () => {
    expect(analyzeMarket({})).toEqual([]);
    expect(riskScore([])).toBe(0);
    expect(riskScore(analyzeMarket({ fundingRate: 0.0006, openInterestChange24hPct: 20 }))).toBe(25);
    expect(riskScore(analyzeMarket({ liquidityUsd: 50_000, volume24hUsd: 9_000_000 }))).toBe(35);
    expect(riskScore([
      { id: "a", severity: "alert", title: "", detail: "" },
      { id: "b", severity: "watch", title: "", detail: "" },
      { id: "c", severity: "info", title: "", detail: "" },
    ])).toBe(38);
  });
});
