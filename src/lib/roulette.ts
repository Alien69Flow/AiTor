/**
 * Ruleta del arcade, con fichas simbólicas.
 *
 * Se pide una ruleta y lo primero que hay que decidir es qué se apuesta y
 * cuánto paga. Aquí son apuestas planas de mesa francesa (37 casillas, sin
 * doble cero) sobre color, paridad y docena: las que se pueden explicar en una
 * frase sin manual.
 *
 * La bola sale de la semilla, no de `Math.random`: una tirada se puede repetir
 * si hace falta depurar y el reto diario podría fijarla. Repartir 36 casillas
 * con un generador determinista no sesga a nadie que no conozca la semilla, y
 * la semilla la elige el navegador al empezar.
 *
 * No hay dinero: las fichas son puntos de la mesa, y perder deja el marcador
 * en cero, nunca en negativo.
 */

export const ROULETTE_POCKETS = 37;

export type RouletteBet = "rojo" | "negro" | "par" | "impar" | "docena1" | "docena2" | "docena3";

/** Multiplicador del premio, incluida la ficha: rojo paga 1 a 1. */
export const ROULETTE_ODDS: Record<RouletteBet, number> = {
	rojo: 2,
	negro: 2,
	par: 2,
	impar: 2,
	docena1: 3,
	docena2: 3,
	docena3: 3,
};

/** Las casillas rojas de la ruleta francesa; el 0 no es ni rojo ni negro. */
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** Casilla que sale para una tirada, entre 0 y 36. Misma semilla, misma bola. */
export function spinOf(seed: number): number {
	let state = (Math.floor(seed) || 0) >>> 0;
	state = (state + 0x6d2b79f5) >>> 0;
	let t = Math.imul(state ^ (state >>> 15), state | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) % ROULETTE_POCKETS;
}

/** ¿Gana la apuesta con esta casilla? */
export function betWins(bet: RouletteBet, pocket: number): boolean {
	const value = Math.floor(pocket);
	if (!Number.isFinite(value) || value < 0 || value >= ROULETTE_POCKETS) return false;
	if (bet === "rojo") return value > 0 && RED.has(value);
	if (bet === "negro") return value > 0 && !RED.has(value);
	if (bet === "par") return value > 0 && value % 2 === 0;
	if (bet === "impar") return value > 0 && value % 2 === 1;
	const dozen = bet === "docena1" ? 1 : bet === "docena2" ? 2 : 3;
	return value > 0 && Math.ceil(value / 12) === dozen;
}

/**
 * Resultado neto de la tirada para una ficha dada.
 *
 * Ganar devuelve `ficha × (pago − 1)` porque la ficha vuelve a la mesa;
 * perder devuelve la ficha en negativo. Con ficha cero no pasa nada.
 */
export function spinNet(bet: RouletteBet, pocket: number, stake: number): number {
	const amount = Math.max(0, Math.floor(stake));
	if (amount === 0) return 0;
	if (!betWins(bet, pocket)) return -amount;
	return amount * (ROULETTE_ODDS[bet] - 1);
}

/** Marcador tras la tirada: nunca baja de cero. */
export function afterSpin(chips: number, bet: RouletteBet, pocket: number, stake: number): number {
	const current = Math.max(0, Math.floor(chips));
	return Math.max(0, current + spinNet(bet, pocket, stake));
}
