/**
 * Tablero party del arcade: dado, casillas, monedas y estrellas.
 *
 * Un modo de tablero no es un juego de reflejos: se juega por turnos y todo lo
 * que pasa se puede calcular de antemano. Por eso el dado es determinista
 * (`seed` y número de tiradas) y el movimiento vive en `partyStep`, que recibe
 * la tirada ya hecha. Así una partida se puede reproducir en una prueba sin
 * depender de `Math.random`.
 *
 * Reglas, escritas aquí para que no haya sorpresas al leer la interfaz:
 * tablero de 12 casillas en bucle, seis rondas, cinco monedas de salida, la
 * casilla 3 da tres monedas y la 8 vende una estrella por diez monedas.
 *
 * Sin dinero: las monedas y las estrellas son de la partida y no salen de ella.
 */

export const PARTY = {
	tiles: 12,
	rounds: 6,
	startCoins: 5,
	coinTile: 3,
	starTile: 8,
	starCost: 10,
	coinsPerTile: 3,
	diceFaces: 6,
} as const;

export interface PartyPlayer {
	tile: number;
	coins: number;
	stars: number;
}

export interface PartyState {
	you: PartyPlayer;
	rival: PartyPlayer;
	turn: 0 | 1;
	round: number;
	/** Tiradas hechas: de aquí sale el dado, junto con la semilla. */
	rolls: number;
	lastRoll: number | null;
	/** Últimas jugadas, de la más reciente a la más vieja. */
	log: string[];
	over: boolean;
	winner: 0 | 1 | null;
	seed: number;
}

const MAX_LOG = 4;

export function partyStart(seed = 1): PartyState {
	return {
		you: { tile: 0, coins: PARTY.startCoins, stars: 0 },
		rival: { tile: 0, coins: PARTY.startCoins, stars: 0 },
		turn: 0,
		round: 1,
		rolls: 0,
		lastRoll: null,
		log: ["Sale el jugador de casa"],
		over: false,
		winner: null,
		seed,
	};
}

function winnerOfParty(you: PartyPlayer, rival: PartyPlayer): 0 | 1 | null {
	if (you.stars !== rival.stars) return you.stars > rival.stars ? 0 : 1;
	if (you.coins === rival.coins) return null;
	return you.coins > rival.coins ? 0 : 1;
}

/**
 * Resuelve una tirada ya conocida.
 *
 * La partida se cierra cuando el rival termina su turno de la última ronda, que
 * es cuando el contador pasa de `rounds`; así los dos juegan las mismas veces.
 */
export function partyStep(state: PartyState, roll: number): PartyState {
	if (state.over) return state;

	const face = Math.min(PARTY.diceFaces, Math.max(1, Math.floor(roll) || 1));
	const moving = state.turn === 0 ? state.you : state.rival;
	const tile = (moving.tile + face) % PARTY.tiles;

	let coins = moving.coins;
	let stars = moving.stars;
	const entries: string[] = [`Dado ${face} → casilla ${tile}`];

	if (tile === PARTY.coinTile) {
		coins += PARTY.coinsPerTile;
		entries.push(`+${PARTY.coinsPerTile} monedas`);
	}

	if (tile === PARTY.starTile) {
		if (coins >= PARTY.starCost) {
			coins -= PARTY.starCost;
			stars += 1;
			entries.push("estrella comprada");
		} else {
			entries.push(`faltan ${PARTY.starCost - coins} monedas para la estrella`);
		}
	}

	const player: PartyPlayer = { tile, coins, stars };
	const you = state.turn === 0 ? player : state.you;
	const rival = state.turn === 0 ? state.rival : player;
	const nextTurn = (1 - state.turn) as 0 | 1;
	const round = nextTurn === 0 ? state.round + 1 : state.round;
	const over = round > PARTY.rounds;

	return {
		...state,
		you,
		rival,
		turn: over ? state.turn : nextTurn,
		round,
		rolls: state.rolls + 1,
		lastRoll: face,
		over,
		winner: over ? winnerOfParty(you, rival) : null,
		log: [...entries, ...state.log].slice(0, MAX_LOG),
	};
}

/** Tirada del dado: misma semilla y misma cuenta, misma cara. */
export function partyRoll(state: PartyState): PartyState {
	const face = 1 + ((state.seed * 31 + state.rolls * 17) % PARTY.diceFaces);
	return partyStep(state, face);
}

/** Marca local: la estrella vale 500 y cada moneda 10. */
export function partyScore(state: PartyState): number {
	return state.you.stars * 500 + state.you.coins * 10;
}
