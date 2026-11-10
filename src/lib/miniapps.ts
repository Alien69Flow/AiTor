/**
 * Registro de miniapps: el contrato que comparten todos los módulos del arcade.
 *
 * Un módulo no es una carpeta con un componente suelto: es una ficha aquí, un
 * motor puro en `src/lib` y una tarjeta en `GamesArcade`, en `ArcadeRacers` o en
 * su propio fichero dentro de `components/games`. Añadir una carta, un
 * plataformas o una mina consiste en escribir el motor, probarlo y añadir la
 * ficha; la pestaña los monta.
 *
 * Lo que paga y lo que no se declara explícitamente: hoy ningún módulo mueve
 * dinero, y una ficha con premios reales no puede entrar sin riel, custodia y
 * condiciones de uso. Las que están diseñadas dicen qué les falta.
 */

import type { GameId } from "./mini-games";

export type MiniAppKind = "arcade" | "cartas" | "casino" | "plataformas" | "mineria";

/** `jugable` = se puede jugar ya; `diseñado` = ficha y reglas, sin motor todavía. */
export type MiniAppStatus = "jugable" | "diseñado";

/** Riel de pago. `ninguno` es el estado real de todo lo jugable hoy. */
export type PayoutRail = "ninguno" | "sats" | "ton";

export type PayoutState = "sin premios" | "diseñado" | "activo";

export interface MiniApp {
	/** Identificador estable; coincide con `GameId` en los módulos jugables. */
	id: string;
	name: string;
	kind: MiniAppKind;
	status: MiniAppStatus;
	/** Una línea de qué es, para la ficha. */
	tagline: string;
	/** Cómo se juega, en una frase. */
	controls: string;
	/** Qué suma puntos y cuánto. */
	pointsRule: string;
	/** ¿Entra en el reto diario? */
	challenge: boolean;
	/** Componente que lo monta, si está jugable. */
	component?: string;
	/** Fichero del motor puro que decide sus reglas. */
	engine?: string;
	/** Qué falta para construirlo, si está diseñado. */
	requires?: string;
	payouts: {
		rail: PayoutRail;
		state: PayoutState;
		note: string;
	};
}

export const KIND_LABEL: Record<MiniAppKind, string> = {
	arcade: "Arcade",
	cartas: "Cartas",
	casino: "Mesa",
	plataformas: "Plataformas",
	mineria: "Minería",
};

/** Puntos que no salen del navegador: la marca es local y no toca la liga. */
const LOCAL_NOTE = "Puntos locales del arcade: no suman a la liga del servidor.";

/** Fichas, en el orden en que conviene leerlas. */
export const MINIAPPS: MiniApp[] = [
	{
		id: "impulse",
		name: "Pulso orbital",
		kind: "arcade",
		status: "jugable",
		tagline: "Precisión bajo un indicador que no se detiene.",
		controls: "Detén la barra dentro de la ventana; tres fallos y se acaba.",
		pointsRule: "100 por pulso perfecto, 40 por bueno, 10 por acierto seguido (hasta 8).",
		challenge: true,
		component: "ImpulseGame",
		engine: "src/lib/mini-games.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },
	},
	{
		id: "memory",
		name: "Memoria de nodos",
		kind: "arcade",
		status: "jugable",
		tagline: "Secuencias que crecen hasta doce rondas.",
		controls: "Repite la secuencia de nodos que se enciende.",
		pointsRule: "40 puntos de liga por ronda completada.",
		challenge: true,
		component: "MemoryGame",
		engine: "src/lib/mini-games.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },
	},
	{
		id: "reactor",
		name: "Reactor de pares",
		kind: "arcade",
		status: "jugable",
		tagline: "Aritmética bajo reloj, con una sola pareja válida por ronda.",
		controls: "Elige dos números que sumen el objetivo antes de que acabe el tiempo.",
		pointsRule: "100 por pareja, más 10 por segundo restante y 10 por combo.",
		challenge: true,
		component: "ReactorGame",
		engine: "src/lib/mini-games.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },
	},
	{
		id: "veintiuna",
		name: "Veintiuna",
		kind: "cartas",
		status: "jugable",
		tagline: "Tres manos contra el crupier, con baraja determinista por semilla.",
		controls: "Pide o plántate; el crupier pide con 16 o menos.",
		pointsRule: "300 por blackjack, 180 por mano ganada, 60 por empate, nada por perder.",
		challenge: false,
		component: "VeintiunaGame",
		engine: "src/lib/card-games.ts",
		payouts: {
			rail: "ninguno",
			state: "sin premios",
			note: "Sin apuestas ni saldo: una mano no arriesga nada más que puntos de liga.",
		},
	},
	{
		id: "escalera-orbital",
		name: "Escalera orbital",
		kind: "plataformas",
		status: "jugable",
		tagline: "Salto lateral con gravedad baja y una torre que nunca repite.",
		controls: "Izquierda y derecha para moverse, espacio para saltar.",
		pointsRule: "10 puntos por metro de altura y 50 por plataforma nueva.",
		challenge: false,
		component: "EscaleraGame",
		engine: "src/lib/platformer.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: LOCAL_NOTE },
	},
	{
		id: "ovni-flappy",
		name: "OVNI Flappy",
		kind: "arcade",
		status: "jugable",
		tagline: "El platillo de siempre, con física que no se rompe al ir lento.",
		controls: "Espacio o tocar para aletear entre los restos de la estación.",
		pointsRule: "10 puntos por cada hueco superado.",
		challenge: false,
		component: "FlappyGame",
		engine: "src/lib/flappy.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: LOCAL_NOTE },
	},
	{
		id: "uno",
		name: "UNO del cinturón",
		kind: "cartas",
		status: "jugable",
		tagline: "Baraja de 108 cartas contra un bot con las mismas reglas.",
		controls: "Tira del mismo color o del mismo número; comodín siempre entra; roba si no tienes.",
		pointsRule: "20 por carta colocada y 300 por vaciar la mano.",
		challenge: false,
		component: "UnoGame",
		engine: "src/lib/uno.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: "Sin apuestas ni saldo: sólo puntos locales." },
	},
	{
		id: "kart",
		name: "Kart de la órbita",
		kind: "arcade",
		status: "jugable",
		tagline: "Dos vueltas con deriva: la curva empuja más cuanto más rápido pasas.",
		controls: "Flechas izquierda y derecha para corregir, espacio para frenar; botones en móvil.",
		pointsRule: "1000 por vuelta cerrada y hasta 400 por el tramo en curso.",
		challenge: false,
		component: "KartRaceGame",
		engine: "src/lib/arcade-racers.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: LOCAL_NOTE },
	},
	{
		id: "chicken-road",
		name: "Cruce de carriles",
		kind: "arcade",
		status: "jugable",
		tagline: "Nueve filas de tráfico y una gallina que no puede dudar.",
		controls: "Salta hacia delante y muévete de lado; el tráfico no espera.",
		pointsRule: "20 por salto, 60 por fila alcanzada y 500 por cruzar.",
		challenge: false,
		component: "ChickenCrossGame",
		engine: "src/lib/arcade-racers.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: LOCAL_NOTE },
	},
	{
		id: "lane-clash",
		name: "Combate por carriles",
		kind: "arcade",
		status: "jugable",
		tagline: "Tres carriles, oleadas que avanzan con cada orden y un escudo de un golpe.",
		controls: "Muévete de carril, dispara al más cercano y levanta el escudo.",
		pointsRule: "100 por baja y 50 por oleada superada.",
		challenge: false,
		component: "LaneClashGame",
		engine: "src/lib/arcade-racers.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: LOCAL_NOTE },
	},
	{
		id: "mus",
		name: "Mus",
		kind: "cartas",
		status: "jugable",
		tagline: "Baraja española de 40: descartes, pares, juego y punto a 40 piedras.",
		controls: "Descarta hasta cuatro cartas, canta y compara los tres lances.",
		pointsRule: "Una piedra por lance ganado: hasta tres por mano, partida a 40.",
		challenge: false,
		component: "MusGame",
		engine: "src/lib/mus.ts",
		payouts: { rail: "ninguno", state: "sin premios", note: "Sin apuestas ni saldo: sólo piedras en pantalla." },
	},
	{
		id: "ruleta",
		name: "Ruleta del hangar",
		kind: "casino",
		status: "jugable",
		tagline: "37 casillas y fichas de prueba; el cero se lo queda la casa.",
		controls: "Elige apuesta y ficha, gira; doce tiradas por sesión.",
		pointsRule: "Color y paridad pagan 1 a 1 y docena 2 a 1; las fichas no valen nada fuera de la mesa.",
		challenge: false,
		component: "RouletteGame",
		engine: "src/lib/roulette.ts",
		payouts: {
			rail: "ninguno",
			state: "sin premios",
			note: "Fichas simbólicas: no se compran ni se retiran, y el marcador nunca baja de cero.",
		},
	},
	{
		id: "mesa-dao",
		name: "Mesa de la DAO",
		kind: "casino",
		status: "diseñado",
		tagline: "Mesa de fichas simbólicas para torneos de temporada, sin dinero.",
		controls: "Fichas de prueba por temporada; sin compra, sin retirada, sin conversión.",
		pointsRule: "Puntos por puesto en la mesa; las fichas no valen nada fuera de ella.",
		challenge: false,
		engine: "src/lib/table.ts",
		requires:
			"Reglamento escrito, revisión legal por jurisdicción y un riel de premios aprobado antes de mover valor real.",
		payouts: {
			rail: "ton",
			state: "diseñado",
			note: "Un casino con premios reales exige licencia y custodia; hoy sólo se puede jugar con fichas simbólicas.",
		},
	},
	{
		id: "mina-de-sats",
		name: "Mina de sats",
		kind: "mineria",
		status: "diseñado",
		tagline: "Minado simbólico por hash rate y retiros en Lightning.",
		controls: "El nodo mina mientras la pestaña está abierta; el saldo se retira a una dirección Lightning.",
		pointsRule: "Sats por bloque encontrado, con dificultad creciente y tope diario.",
		challenge: false,
		engine: "src/lib/mining.ts",
		requires:
			"Riel de pago real (ZBD o Speed Wallet con su API y webhook firmado), saldo en servidor, límites antifraude y custodia declarada.",
		payouts: {
			rail: "sats",
			state: "diseñado",
			note: "Sin proveedor configurado no se promete ni un sat: el saldo se queda en cero y así se dice.",
		},
	},
];

/** Los que ya se pueden jugar. */
export const liveMiniApps = (): MiniApp[] => MINIAPPS.filter((app) => app.status === "jugable");

/** Los diseñados: ficha y requisitos, sin motor montado. */
export const plannedMiniApps = (): MiniApp[] => MINIAPPS.filter((app) => app.status === "diseñado");

/** Ficha por id, o `undefined` si no existe (mejor que un objeto vacío). */
export function miniAppById(id: string): MiniApp | undefined {
	return MINIAPPS.find((app) => app.id === id);
}

/**
 * Ids que puntúan en la liga del servidor. No son todos los jugables: los del
 * arcade extendido guardan su marca en el navegador y no envían partidas.
 */
export const PLAYABLE_IDS: GameId[] = liveMiniApps()
	.map((app) => app.id)
	.filter((id): id is GameId => id === "impulse" || id === "memory" || id === "reactor" || id === "veintiuna");
