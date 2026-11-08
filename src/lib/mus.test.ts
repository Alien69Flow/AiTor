import { describe, expect, it } from "vitest";
import {
  MUS_DECK_SIZE,
  MUS_HAND_SIZE,
  MUS_MAX_JUEGO,
  PIEDRAS_TO_WIN,
  musCardLabel,
  musCompare,
  musCount,
  musDeal,
  musDeck,
  musDiscard,
  musJuego,
  musJuegoLabel,
  musPairs,
  musPunto,
  musShuffle,
  musValue,
  musWon,
  sumPiedras,
  type MusCard,
  type MusRank,
} from "./mus";

const card = (rank: MusRank, suit: MusCard["suit"] = "oros"): MusCard => ({ rank, suit });

describe("baraja española", () => {
  it("tiene 40 cartas distintas y ninguna es un ocho o un nueve", () => {
    const deck = musDeck();
    expect(deck).toHaveLength(MUS_DECK_SIZE);
    expect(new Set(deck.map(musCardLabel)).size).toBe(MUS_DECK_SIZE);
    expect(deck.some((one) => one.rank === 8 || one.rank === 9)).toBe(false);
    expect(new Set(deck.map((one) => one.suit)).size).toBe(4);
  });

  it("la misma semilla da el mismo reparto y otra lo cambia", () => {
    const a = musShuffle(99).map(musCardLabel);
    const b = musShuffle(99).map(musCardLabel);
    const c = musShuffle(100).map(musCardLabel);
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  it("reparte cuatro manos de cuatro y deja el mazo en 24", () => {
    const { hands, rest } = musDeal(musShuffle(7));
    expect(hands).toHaveLength(4);
    for (const hand of hands) expect(hand).toHaveLength(MUS_HAND_SIZE);
    expect(rest).toHaveLength(MUS_DECK_SIZE - 4 * MUS_HAND_SIZE);
    expect(new Set([...hands.flat(), ...rest].map(musCardLabel)).size).toBe(MUS_DECK_SIZE);
  });

  it("canta las cartas como en la mesa", () => {
    expect(musCardLabel(card(1, "espadas"))).toBe("1 de espadas");
    expect(musCardLabel(card(10, "copas"))).toBe("S de copas");
    expect(musCardLabel(card(11, "bastos"))).toBe("C de bastos");
    expect(musCardLabel(card(12, "oros"))).toBe("R de oros");
  });
});

describe("descartes", () => {
  it("separa lo que se va y lo que se queda, en el orden de la mano", () => {
    const hand = [card(1), card(2), card(3), card(4)];
    const { kept, discarded } = musDiscard(hand, [1, 3]);
    expect(kept.map((one) => one.rank)).toEqual([1, 3]);
    expect(discarded.map((one) => one.rank)).toEqual([2, 4]);
  });

  it("ignora índices imposibles en vez de romper la mano", () => {
    const hand = [card(5), card(6)];
    const { kept, discarded } = musDiscard(hand, [-1, 7, 1.5, 0]);
    expect(discarded).toHaveLength(1);
    expect(kept).toHaveLength(1);
  });

  it("sin índices no se descarta nada", () => {
    const hand = [card(5), card(6)];
    expect(musDiscard(hand, []).discarded).toEqual([]);
    expect(musDiscard(hand, []).kept).toHaveLength(2);
  });
});

describe("pares", () => {
  it("no hay nada sin parejas", () => {
    expect(musPairs([card(1), card(2), card(3), card(4)])).toMatchObject({ count: 0, label: "nada" });
  });

  it("una pareja es par", () => {
    expect(musPairs([card(3), card(3), card(5), card(6)])).toMatchObject({ count: 1, label: "par" });
  });

  it("dos parejas son medias y tres son duples", () => {
    expect(musPairs([card(3), card(3), card(6, "copas"), card(6, "espadas")])).toMatchObject({
      count: 2,
      label: "medias",
    });
    expect(
      musPairs([card(1), card(1, "copas"), card(4), card(4, "bastos"), card(7), card(7, "espadas")]),
    ).toMatchObject({ count: 3, label: "duples" });
  });
});

describe("juego y punto", () => {
  it("las figuras valen diez", () => {
    expect(musValue(card(10))).toBe(10);
    expect(musValue(card(11))).toBe(10);
    expect(musValue(card(12))).toBe(10);
    expect(musValue(card(7))).toBe(7);
  });

  it("la treinta y una es el juego más alto", () => {
    expect(musJuego([card(7), card(7, "copas"), card(7, "bastos"), card(10)])).toBe(MUS_MAX_JUEGO);
    expect(musJuegoLabel(31)).toBe("treinta y una");
    expect(musJuegoLabel(30)).toBe("treinta");
    expect(musJuegoLabel(null)).toBe("no hay juego");
  });

  it("pasarse de 31 es no hay juego", () => {
    expect(musJuego([card(7), card(7, "copas"), card(7, "bastos"), card(11)])).toBeNull();
  });

  it("el punto sólo cuenta del 1 al 7", () => {
    expect(musPunto([card(7), card(7, "copas"), card(12), card(3)])).toBe(17);
    expect(musPunto([card(12), card(11)])).toBe(0);
  });
});

describe("piedras", () => {
  const strong = musCount([card(5), card(5, "copas"), card(7), card(7, "bastos")]);
  const weak = musCount([card(1), card(2, "copas"), card(3), card(4, "bastos")]);

  it("quien gana los tres lances se lleva tres piedras", () => {
    const verdict = musCompare(strong, weak);
    expect(verdict).toMatchObject({ pares: 1, juego: 1, punto: 1, stones: 3 });
  });

  it("ganar dos lances paga dos piedras", () => {
    const mine = musCount([card(5), card(5, "copas"), card(2), card(3)]);
    const rival = musCount([card(1), card(1, "copas"), card(2, "bastos"), card(7)]);
    const verdict = musCompare(mine, rival);
    expect(verdict.stones).toBeGreaterThanOrEqual(1);
    expect(verdict.stones).toBeLessThanOrEqual(2);
  });

  it("perder no da piedras", () => {
    expect(musCompare(weak, strong).stones).toBe(0);
  });

  it("quien no tiene juego pierde el lance del juego", () => {
    const noJuego = musCount([card(7), card(7, "copas"), card(7, "bastos"), card(11)]);
    const conJuego = musCount([card(7), card(7, "copas"), card(3), card(4)]);
    expect(musCompare(noJuego, conJuego).juego).toBe(-1);
  });

  it("la partida se cierra a 40 piedras", () => {
    expect(sumPiedras(38, 3)).toBe(PIEDRAS_TO_WIN);
    expect(sumPiedras(PIEDRAS_TO_WIN, 3)).toBe(PIEDRAS_TO_WIN);
    expect(sumPiedras(10, -5)).toBe(10);
    expect(musWon(PIEDRAS_TO_WIN)).toBe(true);
    expect(musWon(PIEDRAS_TO_WIN - 1)).toBe(false);
  });
});
