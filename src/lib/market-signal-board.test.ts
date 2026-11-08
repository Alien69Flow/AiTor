import { describe, expect, it } from "vitest";

import { buildSignalBoard, snapshotFromEvent } from "./market-signal-board";

describe("snapshotFromEvent", () => {
  it("convierte la profundidad y el volumen aunque vengan como texto", () => {
    const snapshot = snapshotFromEvent({
      title: " ¿Gana el Madrid? ",
      liquidity: "50000",
      volume24hr: 400_000,
    });

    expect(snapshot.symbol).toBe("¿Gana el Madrid?");
    expect(snapshot.liquidityUsd).toBe(50_000);
    expect(snapshot.volume24hUsd).toBe(400_000);
  });

  it("deja en null lo que no es un número, en vez de convertirlo en 0", () => {
    const snapshot = snapshotFromEvent({ liquidity: "n/a", volume24hr: null });

    expect(snapshot.liquidityUsd).toBeNull();
    expect(snapshot.volume24hUsd).toBeNull();
    expect(snapshot.symbol).toBeUndefined();
  });
});

describe("buildSignalBoard", () => {
  it("pone arriba el mercado con más riesgo", () => {
    // El motor suma 25 por alerta y 10 por aviso, con tope en 100.
    const board = buildSignalBoard([
      // Profundidad fina (alerta) y rotación de 8 vueltas (aviso): 35 puntos.
      { id: "fino", title: "Fino", liquidity: 50_000, volume24hr: 400_000 },
      // Profundidad fina y rotación de 40 vueltas: dos alertas, 50 puntos.
      { id: "extremo", title: "Extremo", liquidity: 50_000, volume24hr: 2_000_000 },
      // Un millón de fondo con 25 vueltas: sólo alerta de rotación, 25 puntos.
      { id: "hondo", title: "Hondo", liquidity: 1_000_000, volume24hr: 25_000_000 },
    ]);

    expect(board.map((entry) => entry.id)).toEqual(["extremo", "fino", "hondo"]);
    expect(board.map((entry) => entry.score)).toEqual([50, 35, 25]);
  });

  it("deja fuera los mercados sin datos: el motor no inventa", () => {
    const board = buildSignalBoard([
      { id: "mudo", title: "Sin profundidad" },
      { id: "sano", title: "Sano", liquidity: 5_000_000, volume24hr: 1_000_000 },
    ]);

    expect(board).toEqual([]);
  });

  it("respeta el orden de gravedad dentro de la misma puntuación", () => {
    // Las dos valen 25 y las dos empiezan por alerta: manda el nombre.
    const board = buildSignalBoard([
      { id: "rotacion", title: "Rotación", liquidity: 1_000_000, volume24hr: 25_000_000 },
      { id: "liquidez", title: "Liquidez", liquidity: 100_000 },
    ]);

    expect(board.map((entry) => entry.score)).toEqual([25, 25]);
    expect(board.map((entry) => entry.signals[0]?.severity)).toEqual(["alert", "alert"]);
    expect(board.map((entry) => entry.label)).toEqual(["Liquidez", "Rotación"]);
  });

  it("es determinista y no repite el mismo evento", () => {
    const events = [
      { id: "uno", title: "Uno", liquidity: 50_000 },
      { id: "uno", title: "Uno repetido", liquidity: 50_000 },
      { id: "dos", title: "Dos", liquidity: 80_000 },
    ];

    const first = buildSignalBoard(events);
    const second = buildSignalBoard(events);

    // El duplicado se descarta por id, no por título: quedan dos mercados y,
    // como los dos valen 25, el desempate alfabético pone «Dos» delante.
    expect(first.map((entry) => entry.label)).toEqual(["Dos", "Uno"]);
    expect(first).toEqual(second);
  });
});
