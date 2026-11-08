/**
 * Mina de sats: el motor del minijuego de minería, en funciones puras.
 *
 * El registro de miniapps lo declaraba con una condición explícita: «sin
 * proveedor configurado no se promete ni un sat: el saldo se queda en cero y
 * así se dice». Este motor cumple esa condición al pie de la letra:
 *
 *  - Acumula hashes simulados y encuentra bloques con dificultad creciente.
 *  - Suma sats **de liga**, con tope diario, para que la partida tenga sentido
 *    y no se pueda inflar dejando la pestaña abierta.
 *  - El retiro **no existe**: `withdraw` devuelve siempre el motivo por el que
 *    no se puede cobrar. No hay riel, no hay custodia y no hay saldo real;
 *    fingir lo contrario sería prometer dinero que nadie puede pagar.
 *
 * Cuando haya proveedor (ZBD o Speed Wallet con webhook firmado), lo que cambia
 * es `WITHDRAWAL_RAIL` y se añade la llamada al servidor: la aritmética de
 * bloques y topes no se toca.
 */

/** Hashes que cuesta el primer bloque. */
export const MINING_BASE_DIFFICULTY = 900;
/** Cuánto sube la dificultad por bloque encontrado. */
export const MINING_GROWTH = 1.18;
/** Sats que paga un bloque, en la simulación. */
export const MINING_BLOCK_REWARD_SATS = 25;
/** Tope de sats por día simulado. */
export const MINING_DAILY_CAP_SATS = 500;
/** Riel real de pago. Hoy no hay ninguno, y se declara. */
export const WITHDRAWAL_RAIL = "none" as const;

/** Estado de una sesión de minado. */
export interface MiningState {
	/** Hashes acumulados hacia el bloque en curso. */
	hashes: number;
	blocks: number;
	/** Sats de liga, nunca dinero. */
	sats: number;
	/** Segundos simulados. */
	seconds: number;
	/** Día al que pertenece el tope (`YYYY-MM-DD`). */
	day: string;
}

/** Dificultad del bloque número `blocks` (0 = el primero). */
export function difficultyFor(blocks: number): number {
	const index = Math.max(0, Math.floor(blocks));
	return Math.round(MINING_BASE_DIFFICULTY * MINING_GROWTH ** index);
}

export function createMiningState(day: string): MiningState {
	return { hashes: 0, blocks: 0, sats: 0, seconds: 0, day };
}

/**
 * Un segundo de minado.
 *
 * `hashrate` es hashes por segundo del nodo simulado. Se resuelven varios
 * bloques en el mismo segundo si la dificultad es baja (al principio pasa),
 * con un tope de vueltas para que un `hashrate` absurdo no cuelgue el bucle.
 */
export function mineSecond(state: MiningState, hashrate: number, day = state.day): MiningState {
	// Cambio de día: el tope se renueva y el contador de bloques sigue, que es
	// lo que impide minar barato reiniciando la pestaña.
	const sats = day === state.day ? state.sats : 0;
	let hashes = state.hashes + Math.max(0, Number.isFinite(hashrate) ? hashrate : 0);
	let blocks = state.blocks;
	let total = sats;

	for (let guard = 0; guard < 1000; guard += 1) {
		const difficulty = difficultyFor(blocks);
		if (hashes < difficulty) break;
		hashes -= difficulty;
		blocks += 1;
		total = Math.min(MINING_DAILY_CAP_SATS, total + MINING_BLOCK_REWARD_SATS);
	}

	return { hashes, blocks, sats: total, seconds: state.seconds + 1, day };
}

/** ¿Se ha tocado el tope del día? */
export function capReached(state: MiningState): boolean {
	return state.sats >= MINING_DAILY_CAP_SATS;
}

/** Puntos de liga que aporta la sesión: un bloque vale, el saldo no. */
export function miningPoints(state: MiningState): number {
	return state.blocks * 20;
}

export interface WithdrawalResult {
	ok: boolean;
	reason?: string;
	state: MiningState;
}

/**
 * Retirada. Siempre falla, y el motivo es el real: no hay riel configurado.
 *
 * Devolver `ok: true` con un saldo simulado sería el peor fallo posible: la
 * interfaz diría «cobrado» sobre sats que no existen.
 */
export function withdraw(state: MiningState, amount: number): WithdrawalResult {
	if (WITHDRAWAL_RAIL === "none") {
		return {
			ok: false,
			reason:
				"Sin proveedor de pagos configurado (ZBD o Speed Wallet): los sats de la mina son puntos de liga, no saldo cobrable.",
			state,
		};
	}
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, reason: "Cantidad no válida.", state };
	}
	if (amount > state.sats) {
		return { ok: false, reason: "No hay saldo suficiente en la sesión.", state };
	}
	return { ok: false, reason: "Riel no implementado.", state };
}
