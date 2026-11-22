import { describe, expect, it } from "vitest";
import {
  buildAlert,
  dueAlerts,
  formatAlertList,
  formatAlert,
  formatCancelled,
  formatCreated,
  isDue,
  parseAlertCommand,
  parseAlertManage,
  parsePrice,
  removeAlertAt,
  sanitizeAlerts,
  type Alert,
  type GdeltAlert,
  type MoveAlert,
  type PriceAlert,
  type QuakeAlert,
} from "./_shared/alerts";
import { emptySnapshot, type AlertSnapshot } from "./_shared/alert-sources";

const priceAlert = (overrides: Partial<PriceAlert> = {}): PriceAlert => ({
  kind: "price",
  chatId: 7,
  symbol: "BTC",
  direction: "above",
  price: 100_000,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

const moveAlert = (overrides: Partial<MoveAlert> = {}): MoveAlert => ({
  kind: "move",
  chatId: 7,
  symbol: "BTC",
  direction: "above",
  percent: 5,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

const quakeAlert = (overrides: Partial<QuakeAlert> = {}): QuakeAlert => ({
  kind: "quake",
  chatId: 7,
  minMagnitude: 5.5,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

const gdeltAlert = (overrides: Partial<GdeltAlert> = {}): GdeltAlert => ({
  kind: "gdelt",
  chatId: 7,
  theme: "ARMEDCONFLICT",
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

const snapshot = (overrides: Partial<AlertSnapshot> = {}): AlertSnapshot => ({
  ...emptySnapshot(),
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

describe("parseAlertCommand · precio", () => {
  it("entiende las cuatro formas del comando", () => {
    expect(parseAlertCommand("/alerta BTC > 95000")).toEqual({ kind: "price", symbol: "BTC", direction: "above", price: 95_000 });
    expect(parseAlertCommand("/alerta eth >= 3000")).toEqual({ kind: "price", symbol: "ETH", direction: "above", price: 3_000 });
    expect(parseAlertCommand("/alerta SOL < 100")).toEqual({ kind: "price", symbol: "SOL", direction: "below", price: 100 });
    expect(parseAlertCommand("/alerta@Alien69Bot btc <= 90k")).toEqual({
      kind: "price",
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

describe("parseAlertCommand · movimiento", () => {
  it("exige signo: + sube, - baja", () => {
    expect(parseAlertCommand("/alerta BTC +5%")).toEqual({ kind: "move", symbol: "BTC", direction: "above", percent: 5 });
    expect(parseAlertCommand("/alerta eth -2.5%")).toEqual({ kind: "move", symbol: "ETH", direction: "below", percent: 2.5 });
    expect(parseAlertCommand("/alerta SOL +7,5 %")).toEqual({ kind: "move", symbol: "SOL", direction: "above", percent: 7.5 });
  });

  it("sin signo, con símbolo desconocido o con un porcentaje imposible no crea nada", () => {
    expect(parseAlertCommand("/alerta BTC 5%")).toBeNull();
    expect(parseAlertCommand("/alerta DOGE +5%")).toBeNull();
    expect(parseAlertCommand("/alerta BTC +0%")).toBeNull();
    expect(parseAlertCommand("/alerta BTC +150%")).toBeNull();
    expect(parseAlertCommand("/alerta BTC +mucho%")).toBeNull();
  });
});

describe("parseAlertCommand · sismos", () => {
  it("acepta magnitud con punto o coma, en singular o plural", () => {
    expect(parseAlertCommand("/alerta sismos 5.5")).toEqual({ kind: "quake", minMagnitude: 5.5 });
    expect(parseAlertCommand("/alerta sismo 4,8")).toEqual({ kind: "quake", minMagnitude: 4.8 });
    expect(parseAlertCommand("/alerta SISMOS 6")).toEqual({ kind: "quake", minMagnitude: 6 });
  });

  it("una magnitud fuera de rango o no numérica no crea nada", () => {
    expect(parseAlertCommand("/alerta sismos 0.5")).toBeNull();
    expect(parseAlertCommand("/alerta sismos 12")).toBeNull();
    expect(parseAlertCommand("/alerta sismos fuerte")).toBeNull();
    expect(parseAlertCommand("/alerta sismos")).toBeNull();
  });
});

describe("parseAlertCommand · GDELT", () => {
  it("normaliza el tema a mayúsculas", () => {
    expect(parseAlertCommand("/alerta gdelt ARMEDCONFLICT")).toEqual({ kind: "gdelt", theme: "ARMEDCONFLICT" });
    expect(parseAlertCommand("/alerta GDELT protest")).toEqual({ kind: "gdelt", theme: "PROTEST" });
  });

  it("rechaza temas inventados y sobras", () => {
    expect(parseAlertCommand("/alerta gdelt 9")).toBeNull();
    expect(parseAlertCommand("/alerta gdelt ARMEDCONFLICT extra")).toBeNull();
    expect(parseAlertCommand("/alerta gdelt")).toBeNull();
  });
});

describe("buildAlert", () => {
  it("guarda la clase que se pidió, con chat y hora", () => {
    expect(buildAlert({ kind: "price", symbol: "BTC", direction: "above", price: 95_000 }, 7, "2026-11-19T10:00:00.000Z")).toEqual(
      priceAlert({ price: 95_000 }),
    );
    expect(buildAlert({ kind: "move", symbol: "ETH", direction: "below", percent: 3 }, 7, "2026-11-19T10:00:00.000Z")).toEqual(
      moveAlert({ symbol: "ETH", direction: "below", percent: 3 }),
    );
    expect(buildAlert({ kind: "quake", minMagnitude: 6 }, 7, "2026-11-19T10:00:00.000Z")).toEqual(
      quakeAlert({ minMagnitude: 6 }),
    );
    expect(buildAlert({ kind: "gdelt", theme: "PROTEST" }, 7, "2026-11-19T10:00:00.000Z")).toEqual(
      gdeltAlert({ theme: "PROTEST" }),
    );
  });
});

describe("formatCreated", () => {
  it("el de precio conserva su texto de siempre", () => {
    expect(formatCreated(priceAlert({ price: 95_000 }))).toBe(
      "✅ Aviso creado: BTC ≥ $95.000. Te escribo cuando lo cruce.",
    );
  });

  it("cada clase dice lo que vigila, sin jerga", () => {
    expect(formatCreated(moveAlert({ percent: 5 }))).toContain("BTC se mueva +5 % en 24 h");
    expect(formatCreated(quakeAlert({ minMagnitude: 5.5 }))).toContain("sismo de magnitud ≥ 5,5");
    expect(formatCreated(gdeltAlert())).toContain("evento nuevo del tema ARMEDCONFLICT");
  });
});

describe("isDue / dueAlerts", () => {
  it("el precio dispara al llegar, no antes", () => {
    expect(isDue(priceAlert({ price: 100 }), 99)).toBe(false);
    expect(isDue(priceAlert({ price: 100 }), 100)).toBe(true);
    expect(isDue(priceAlert({ price: 100 }), 101)).toBe(true);
    expect(isDue(priceAlert({ direction: "below", price: 100 }), 101)).toBe(false);
    expect(isDue(priceAlert({ direction: "below", price: 100 }), 100)).toBe(true);
    expect(isDue(priceAlert(), null)).toBe(false);
  });

  it("el movimiento respeta el signo de la variación", () => {
    const up = moveAlert({ direction: "above", percent: 5 });
    const down = moveAlert({ direction: "below", percent: 5 });

    expect(dueAlerts([up], snapshot({ changes: { BTC: 5.2 } }))).toHaveLength(1);
    expect(dueAlerts([up], snapshot({ changes: { BTC: 4.9 } }))).toHaveLength(0);
    expect(dueAlerts([down], snapshot({ changes: { BTC: 5.2 } }))).toHaveLength(0);
    expect(dueAlerts([down], snapshot({ changes: { BTC: -6 } }))).toHaveLength(1);
    // Sin variación no se dispara: no es un cero, es un hueco.
    expect(dueAlerts([up], snapshot({ changes: { BTC: null } }))).toHaveLength(0);
  });

  it("un sismo sólo cuenta si cruza el umbral y es posterior a la alerta", () => {
    const alert = quakeAlert({ minMagnitude: 5.5, createdAt: "2026-11-19T10:00:00.000Z" });
    const quake = (id: string, magnitude: number, atIso: string) => ({ id, magnitude, place: "mar", atIso });

    expect(dueAlerts([alert], snapshot({ quakes: [quake("a", 6.1, "2026-11-19T11:00:00.000Z")] }))).toHaveLength(1);
    // Más fuerte, pero de antes de crear el aviso: no es noticia.
    expect(dueAlerts([alert], snapshot({ quakes: [quake("b", 7.2, "2026-11-18T11:00:00.000Z")] }))).toHaveLength(0);
    expect(dueAlerts([alert], snapshot({ quakes: [quake("c", 5.0, "2026-11-19T11:00:00.000Z")] }))).toHaveLength(0);
  });

  it("un evento de GDELT sólo cuenta si tiene fecha posterior a la alerta", () => {
    const alert = gdeltAlert({ createdAt: "2026-11-19T10:00:00.000Z" });
    const event = (url: string, atIso: string | null) => ({ url, name: "un sitio", domain: "ejemplo.com", atIso });

    expect(
      dueAlerts([alert], snapshot({ gdelt: { ARMEDCONFLICT: [event("https://a", "2026-11-19T12:00:00.000Z")] } })),
    ).toHaveLength(1);
    // Sin fecha legible no se puede decir que sea nuevo: no dispara.
    expect(dueAlerts([alert], snapshot({ gdelt: { ARMEDCONFLICT: [event("https://b", null)] } }))).toHaveLength(0);
    expect(
      dueAlerts([alert], snapshot({ gdelt: { ARMEDCONFLICT: [event("https://c", "2026-11-18T12:00:00.000Z")] } })),
    ).toHaveLength(0);
    // Otro tema no cuenta.
    expect(
      dueAlerts([gdeltAlert({ theme: "PROTEST" })], snapshot({ gdelt: { ARMEDCONFLICT: [event("https://d", "2026-11-19T12:00:00.000Z")] } })),
    ).toHaveLength(0);
  });

  it("separa las que tocan de las que no, cada una por su motivo", () => {
    const alerts: Alert[] = [
      priceAlert({ symbol: "BTC", price: 100 }),
      priceAlert({ symbol: "ETH", price: 5_000 }),
      moveAlert({ symbol: "SOL", direction: "below", percent: 4 }),
      quakeAlert({ minMagnitude: 6 }),
      gdeltAlert({ theme: "PROTEST" }),
    ];
    const due = dueAlerts(
      alerts,
      snapshot({
        prices: { BTC: 150, ETH: 4_000 },
        changes: { SOL: -4.5 },
        quakes: [{ id: "x", magnitude: 6.4, place: "mar", atIso: "2026-11-19T11:00:00.000Z" }],
        gdelt: { PROTEST: [{ url: "https://x", name: "plaza", domain: "ejemplo.com", atIso: "2026-11-19T11:30:00.000Z" }] },
      }),
    );
    expect(due.map((item) => item.kind)).toEqual(["price", "move", "quake", "gdelt"]);
  });
});

describe("formatAlert", () => {
  it("el de precio dice el precio actual y el aviso", () => {
    const text = formatAlert(priceAlert({ price: 100_000 }), snapshot({ prices: { BTC: 105_000 } }));
    expect(text).toContain("BTC");
    expect(text).toContain("≥");
    expect(text).toContain("105.000");
    expect(text).toContain("100.000");
  });

  it("el de movimiento dice la variación con su signo", () => {
    expect(formatAlert(moveAlert({ percent: 5 }), snapshot({ changes: { BTC: 5.24 } }))).toContain("+5,24 %");
    expect(formatAlert(moveAlert({ direction: "below", percent: 5 }), snapshot({ changes: { BTC: -6 } }))).toContain("-6 %");
  });

  it("el de sismo dice magnitud y lugar; el de GDELT, el enlace", () => {
    expect(
      formatAlert(
        quakeAlert({ minMagnitude: 5.5 }),
        snapshot({ quakes: [{ id: "x", magnitude: 6.1, place: "90 km NNW of Aleneva, Alaska", atIso: "2026-11-19T11:00:00.000Z" }] }),
      ),
    ).toContain("M6,1 — 90 km NNW of Aleneva, Alaska");

    expect(
      formatAlert(
        gdeltAlert(),
        snapshot({ gdelt: { ARMEDCONFLICT: [{ url: "https://ejemplo.com/n", name: "Moscú", domain: "ejemplo.com", atIso: "2026-11-19T12:00:00.000Z" }] } }),
      ),
    ).toContain("https://ejemplo.com/n");
  });

  it("sin dato lo dice en vez de inventar una cifra", () => {
    expect(formatAlert(priceAlert(), emptySnapshot())).toContain("sin precio");
    expect(formatAlert(moveAlert(), emptySnapshot())).toContain("sin variación");
    expect(formatAlert(quakeAlert(), emptySnapshot())).toContain("sin dato");
    expect(formatAlert(gdeltAlert(), emptySnapshot())).toContain("sin evento nuevo");
  });
});

describe("parseAlertManage", () => {
  it("reconoce /alerta lista, con o sin el nombre del bot", () => {
    expect(parseAlertManage("/alerta lista")).toEqual({ action: "list" });
    expect(parseAlertManage("/alerta@Alien69Bot LISTA")).toEqual({ action: "list" });
  });

  it("lee el número de /alerta borra <n>", () => {
    expect(parseAlertManage("/alerta borra 2")).toEqual({ action: "delete", position: 2 });
    expect(parseAlertManage("/alerta borra 12")).toEqual({ action: "delete", position: 12 });
  });

  it("sin número utilizable lo distingue de un comando que no entiende", () => {
    expect(parseAlertManage("/alerta borra")).toEqual({ action: "delete", position: null });
    expect(parseAlertManage("/alerta borra 0")).toEqual({ action: "delete", position: null });
    expect(parseAlertManage("/alerta borra dos")).toEqual({ action: "delete", position: null });
    expect(parseAlertManage("/alerta borra 12 extra")).toEqual({ action: "delete", position: null });
  });

  it("no se come una alerta normal ni una orden con sobras", () => {
    expect(parseAlertManage("/alerta BTC > 95000")).toBeNull();
    expect(parseAlertManage("/alerta sismos 5.5")).toBeNull();
    expect(parseAlertManage("/alerta lista extra")).toBeNull();
    expect(parseAlertManage("/alerta")).toBeNull();
  });
});

describe("formatAlertList", () => {
  it("numera desde 1 con el nombre corto de cada clase", () => {
    const text = formatAlertList([
      priceAlert({ price: 95_000 }),
      moveAlert(),
      quakeAlert(),
      gdeltAlert(),
    ]);
    expect(text).toContain("4 de 10");
    expect(text).toContain("1. BTC ≥ $95.000");
    expect(text).toContain("2. BTC +5 % 24 h");
    expect(text).toContain("3. sismo ≥ 5,5");
    expect(text).toContain("4. GDELT ARMEDCONFLICT");
    expect(text).toContain("/alerta borra 2");
  });

  it("con un solo aviso sugiere el 1, y sin avisos no inventa una lista", () => {
    expect(formatAlertList([priceAlert()])).toContain("/alerta borra 1");
    expect(formatAlertList([])).toBe("📋 No tienes avisos. Crea uno con /alerta BTC > 95000.");
  });
});

describe("removeAlertAt", () => {
  it("quita el indicado y deja el resto en orden", () => {
    const alerts: Alert[] = [priceAlert({ symbol: "BTC" }), priceAlert({ symbol: "ETH" }), priceAlert({ symbol: "SOL" })];
    const result = removeAlertAt(alerts, 2);
    expect(result?.removed.symbol).toBe("ETH");
    expect(result?.alerts.map((alert) => alert.symbol)).toEqual(["BTC", "SOL"]);
    // No toca el original: quien llama decide si lo guarda.
    expect(alerts.map((alert) => alert.symbol)).toEqual(["BTC", "ETH", "SOL"]);
  });

  it("fuera de rango no quita nada", () => {
    expect(removeAlertAt([priceAlert()], 0)).toBeNull();
    expect(removeAlertAt([priceAlert()], 2)).toBeNull();
    expect(removeAlertAt([], 1)).toBeNull();
  });
});

describe("formatCancelled", () => {
  it("dice qué aviso se canceló", () => {
    expect(formatCancelled(priceAlert({ price: 95_000 }))).toBe("✅ Aviso cancelado: BTC ≥ $95.000.");
  });
});

describe("sanitizeAlerts", () => {
  it("una alerta guardada antes de existir `kind` se lee como alerta de precio", () => {
    const legacy = { chatId: 7, symbol: "BTC", direction: "above", price: 95_000, createdAt: "2026-11-19T10:00:00.000Z" };
    expect(sanitizeAlerts([legacy])).toEqual([priceAlert({ price: 95_000 })]);
  });

  it("conserva las clases nuevas cuando están bien formadas", () => {
    const stored = [moveAlert(), quakeAlert(), gdeltAlert()];
    expect(sanitizeAlerts(stored)).toEqual(stored);
  });

  it("tira lo que Redis pueda tener corrupto", () => {
    const stored = [
      priceAlert(),
      { kind: "price", symbol: "DOGE", price: 1, direction: "above", chatId: 7, createdAt: "x" },
      { kind: "price", symbol: "BTC", price: 0, direction: "above", chatId: 7, createdAt: "x" },
      { kind: "price", symbol: "BTC", price: 5, direction: "sideways", chatId: 7, createdAt: "x" },
      { kind: "price", symbol: "BTC", price: 5, direction: "above", createdAt: "x" },
      { kind: "move", symbol: "BTC", percent: 0, direction: "above", chatId: 7, createdAt: "x" },
      { kind: "move", symbol: "DOGE", percent: 5, direction: "above", chatId: 7, createdAt: "x" },
      { kind: "quake", minMagnitude: 99, chatId: 7, createdAt: "x" },
      { kind: "gdelt", theme: "armed conflict", chatId: 7, createdAt: "x" },
      { kind: "desconocido", chatId: 7, createdAt: "x" },
      "basura",
      null,
    ];
    expect(sanitizeAlerts(stored)).toEqual([priceAlert()]);
    expect(sanitizeAlerts(null)).toEqual([]);
  });
});
