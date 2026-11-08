/**
 * Mus con baraja española, en funciones puras.
 *
 * La baraja es la de 40: cuatro palos por diez cartas, sin ochos ni nueves.
 * Aquí viven las cinco cosas que pide la mesa —descartes, pares, juego, punto
 * y piedras— sin React y sin temporizadores, para que se puedan probar.
 *
 * Se juega a 40 piedras. Una mano reparte cuatro cartas a cada jugador, se
 * descartan hasta cuatro, y se cantan los tres lances en orden: pares, juego y
 * punto. Quien gana más lances se lleva las piedras.
 */
import { seededRandom } from "./card-games";

export type MusSuit = "espadas" | "bastos" | "oros" | "copas";
/** 1-7 y las figuras: 10 sota, 11 caballo, 12 rey. */
export type MusRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface MusCard {
  rank: MusRank;
  suit: MusSuit;
}

export const MUS_SUITS: MusSuit[] = ["espadas", "bastos", "oros", "copas"];
export const MUS_RANKS: MusRank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const MUS_DECK_SIZE = 40;
export const MUS_HAND_SIZE = 4;
export const MUS_PLAYERS = 4;
/** Piedras que hay que juntar para ganar la partida. */
export const PIEDRAS_TO_WIN = 40;
/** El juego más alto que existe: la treinta y una. */
export const MUS_MAX_JUEGO = 31;

/** `5 de oros`, `R de espadas`: como se canta en la mesa. */
export function musCardLabel(card: MusCard): string {
  const rank = card.rank === 10 ? "S" : card.rank === 11 ? "C" : card.rank === 12 ? "R" : String(card.rank);
  return `${rank} de ${card.suit}`;
}

/** Baraja completa, sin barajar. */
export function musDeck(): MusCard[] {
  const deck: MusCard[] = [];
  for (const suit of MUS_SUITS) {
    for (const rank of MUS_RANKS) deck.push({ rank, suit });
  }
  return deck;
}

/** Barajado determinista: la misma semilla da la misma mano. */
export function musShuffle(seed: number): MusCard[] {
  const deck = musDeck();
  const random = seededRandom(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Reparte `hands` manos de `size` cartas y devuelve lo que sobra en el mazo. */
export function musDeal(
  deck: readonly MusCard[],
  hands = MUS_PLAYERS,
  size = MUS_HAND_SIZE,
): { hands: MusCard[][]; rest: MusCard[] } {
  const cards = Math.max(0, hands * size);
  const dealt = deck.slice(0, cards);
  const result: MusCard[][] = [];
  for (let hand = 0; hand < hands; hand++) {
    result.push(dealt.slice(hand * size, hand * size + size));
  }
  return { hands: result, rest: deck.slice(cards) };
}

/**
 * Descarte: se van las cartas marcadas y quedan las demás.
 *
 * Los índices fuera de rango se ignoran en vez de romper: en la mesa se puede
 * pulsar de más y la mano no debería volverse inválida por eso.
 */
export function musDiscard(
  hand: readonly MusCard[],
  indices: readonly number[],
): { kept: MusCard[]; discarded: MusCard[] } {
  const drop = new Set(
    indices.filter((index) => Number.isInteger(index) && index >= 0 && index < hand.length),
  );
  const kept: MusCard[] = [];
  const discarded: MusCard[] = [];
  hand.forEach((card, index) => (drop.has(index) ? discarded : kept).push(card));
  return { kept, discarded };
}

export type MusPairsLabel = "nada" | "par" | "medias" | "duples";

export interface MusPairs {
  /** Cuántas parejas distintas hay: 0, 1, 2 o 3. */
  count: number;
  label: MusPairsLabel;
  ranks: number[];
}

/** Pares, medias (dos parejas) y duples (tres). */
export function musPairs(hand: readonly MusCard[]): MusPairs {
  const byRank = new Map<number, number>();
  for (const card of hand) byRank.set(card.rank, (byRank.get(card.rank) ?? 0) + 1);
  const ranks = [...byRank.entries()]
    .filter(([, count]) => count >= 2)
    .map(([rank]) => rank)
    .sort((a, b) => a - b);
  const count = ranks.length;
  const label: MusPairsLabel =
    count >= 3 ? "duples" : count === 2 ? "medias" : count === 1 ? "par" : "nada";
  return { count, label, ranks };
}

/** Las figuras cuentan diez; el resto, su número. */
export function musValue(card: MusCard): number {
  return card.rank > 7 ? 10 : card.rank;
}

/** Juego: suma de las cuatro cartas, válida hasta 31. `null` es no hay juego. */
export function musJuego(hand: readonly MusCard[]): number | null {
  const total = hand.reduce((sum, card) => sum + musValue(card), 0);
  return total <= MUS_MAX_JUEGO ? total : null;
}

export function musJuegoLabel(value: number | null): string {
  if (value === null) return "no hay juego";
  if (value === MUS_MAX_JUEGO) return "treinta y una";
  if (value === 30) return "treinta";
  return `juego de ${value}`;
}

/** Punto: sólo cuentan las cartas del 1 al 7; las figuras valen cero. */
export function musPunto(hand: readonly MusCard[]): number {
  return hand.reduce((sum, card) => sum + (card.rank > 7 ? 0 : card.rank), 0);
}

export interface MusCount {
  pares: MusPairs;
  juego: number | null;
  punto: number;
}

export function musCount(hand: readonly MusCard[]): MusCount {
  return { pares: musPairs(hand), juego: musJuego(hand), punto: musPunto(hand) };
}

const sign = (mine: number, rival: number): 1 | 0 | -1 =>
  mine > rival ? 1 : mine < rival ? -1 : 0;

export interface MusVerdict {
  pares: 1 | 0 | -1;
  juego: 1 | 0 | -1;
  punto: 1 | 0 | -1;
  /** Piedras que se lleva quien canta: 0 si las pierde. */
  stones: number;
}

/**
 * Compara los tres lances en orden de mesa: pares, luego juego, luego punto.
 *
 * Una mano sin juego cuenta como la más baja; ganar dos lances paga dos piedras
 * y ganar los tres paga tres. Si se pierden dos o los tres, no se lleva nada.
 */
export function musCompare(mine: MusCount, rival: MusCount): MusVerdict {
  const pares = sign(mine.pares.count, rival.pares.count);
  const juego = sign(mine.juego ?? -1, rival.juego ?? -1);
  const punto = sign(mine.punto, rival.punto);
  const won = [pares, juego, punto].filter((lance) => lance === 1).length;
  const lost = [pares, juego, punto].filter((lance) => lance === -1).length;
  return { pares, juego, punto, stones: lost >= won ? 0 : won };
}

/** Suma de piedras acotada a la partida. */
export function sumPiedras(total: number, stones: number): number {
  return Math.max(0, Math.min(PIEDRAS_TO_WIN, total + Math.max(0, stones)));
}

export function musWon(stones: number): boolean {
  return stones >= PIEDRAS_TO_WIN;
}
