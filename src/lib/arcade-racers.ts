/**
 * Motores arcade del pabellón: kart, cruce de carriles y combate por carriles.
 *
 * Todo son funciones puras y deterministas: la pista, el tráfico y las oleadas
 * salen de una semilla, así que una partida se puede reproducir en la prueba y
 * el componente no decide ninguna regla, sólo pinta el estado que recibe.
 *
 * Ninguno mueve dinero: los puntos son de liga local, como en el resto del
 * arcade.
 */

/** PRNG de juguete compartido por los tres motores. */
function hash(seed: number, step: number): number {
  let h = (seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0;
  h ^= h << 13;
  h >>>= 0;
  h ^= h >>> 17;
  h ^= h << 5;
  return h >>> 0;
}

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

/* ------------------------------- Kart ----------------------------------- */

export const KART_LANES = 5;
/** Velocidad máxima, en metros por segundo. */
export const KART_MAX_SPEED = 320;
export const KART_ACCEL = 140;
export const KART_BRAKE = 260;
/** Rozamiento constante: sin gas el coche se va parando. */
export const KART_DRAG = 30;
/** Cuánto empuja una curva de pendiente máxima, en la misma unidad que el volante. */
export const KART_CURVE_PULL = 55;
/** Cuánto corrige el volante a fondo. */
export const KART_STEER_GRIP = 70;
/** Velocidad con la que cambia la deriva, en anchos de carril por segundo. */
export const KART_DRIFT_RATE = 1.6;
/** A partir de aquí las ruedas están fuera del asfalto. */
export const KART_GRIP_LIMIT = 0.9;
/** Metros por vuelta. */
export const KART_LAP_LENGTH = 2400;
export const KART_LAPS = 2;
/** Puntos por vuelta completa. */
export const KART_LAP_POINTS = 1000;
/** Puntos máximos por el tramo de vuelta en curso. */
export const KART_PARTIAL_POINTS = 400;

export interface KartState {
  distance: number;
  speed: number;
  /** Deriva lateral: 0 es el centro del asfalto, ±1 el borde. */
  drift: number;
  /** Segundos seguidos fuera de pista. */
  offTrack: number;
  lap: number;
}

export interface KartInput {
  steer: -1 | 0 | 1;
  brake?: boolean;
}

export function kartStart(): KartState {
  return { distance: 0, speed: 0, drift: 0, offTrack: 0, lap: 1 };
}

/** Pendiente del tramo `index`: -1 a la izquierda, 1 a la derecha. */
export function kartCurve(seed: number, index: number): number {
  const n = hash(seed, index);
  return ((n % 2001) - 1000) / 1000;
}

/**
 * Un paso de simulación.
 *
 * El orden importa: primero se actualiza la velocidad (gas o freno contra el
 * rozamiento) y con ella la deriva, porque una curva empuja más cuanto más
 * rápido se pasa por ella.
 */
export function kartStep(state: KartState, input: KartInput, curve: number, dt = 1 / 60): KartState {
  const step = clamp(dt, 0, 0.1);
  const throttle = input.brake ? -KART_BRAKE : KART_ACCEL;
  const speed = clamp(state.speed + (throttle - KART_DRAG) * step, 0, KART_MAX_SPEED);
  const pull = clamp(curve, -1, 1) * KART_CURVE_PULL;
  const drift = clamp(
    state.drift + ((pull - input.steer * KART_STEER_GRIP) / KART_MAX_SPEED) * KART_DRIFT_RATE * step,
    -2,
    2,
  );
  const offRoad = Math.abs(drift) > KART_GRIP_LIMIT;
  const offTrack = offRoad ? state.offTrack + step : 0;
  const distance = state.distance + speed * step * (offRoad ? 0.55 : 1);
  const lap = Math.min(KART_LAPS + 1, 1 + Math.floor(distance / KART_LAP_LENGTH));
  return { distance, speed, drift, offTrack, lap };
}

export function kartFinished(state: KartState): boolean {
  return state.distance >= KART_LAPS * KART_LAP_LENGTH;
}

/** Puntos: vueltas cerradas más el tramo de la vuelta en curso. */
export function kartScore(state: KartState): number {
  const laps = clamp(Math.floor(state.distance / KART_LAP_LENGTH), 0, KART_LAPS);
  const partial = clamp(state.distance - laps * KART_LAP_LENGTH, 0, KART_LAP_LENGTH) / KART_LAP_LENGTH;
  return Math.round(laps * KART_LAP_POINTS + partial * KART_PARTIAL_POINTS);
}

/* ------------------------- Cruce de carriles ---------------------------- */

export const ROAD_LANES = 9;
/** Posición lateral de salida, centrada. */
export const CHICKEN_START_X = 0.5;
/** Radio de colisión contra un coche, en fracción de carril. */
export const CHICKEN_HIT_RADIUS = 0.12;
/** Lo que se desplaza la gallina a los lados en cada paso. */
export const CHICKEN_SIDESTEP = 0.2;
export const CHICKEN_HOP_POINTS = 20;
export const CHICKEN_ROW_POINTS = 60;
export const CHICKEN_CROSS_POINTS = 500;

export interface TrafficCar {
  lane: number;
  /** Posición dentro del carril, 0 a 1. */
  x: number;
}

export interface ChickenState {
  row: number;
  x: number;
  hops: number;
  alive: boolean;
}

export type ChickenMove = "up" | "down" | "left" | "right";

/** Tráfico del instante `tick`: dos coches por carril, siempre los mismos. */
export function trafficAt(seed: number, tick: number): TrafficCar[] {
  const cars: TrafficCar[] = [];
  const time = Number.isFinite(tick) ? tick : 0;
  for (let lane = 1; lane <= ROAD_LANES; lane++) {
    const n = hash(seed, lane);
    for (let slot = 0; slot < 2; slot++) {
      const start = (n >>> (slot * 7)) % 1000;
      const speed = 60 + ((n >>> (slot * 5 + 3)) % 90);
      const x = (((start + speed * time) % 1000) + 1000) % 1000 / 1000;
      cars.push({ lane, x });
    }
  }
  return cars;
}

export function chickenStart(): ChickenState {
  return { row: 0, x: CHICKEN_START_X, hops: 0, alive: true };
}

/** ¿Hay un coche en ese carril lo bastante cerca como para aplastar? */
export function carAt(cars: readonly TrafficCar[], lane: number, x: number): boolean {
  return cars.some((car) => car.lane === lane && Math.abs(car.x - x) < CHICKEN_HIT_RADIUS);
}

/**
 * Un salto. La fila 0 es la acera de salida y `ROAD_LANES + 1` la de llegada:
 * sólo se puede morir en el asfalto, que es lo que hace justa la salida y la
 * meta.
 */
export function chickenStep(
  state: ChickenState,
  move: ChickenMove,
  cars: readonly TrafficCar[],
): ChickenState {
  if (!state.alive) return state;
  let { row, x, hops } = state;
  if (move === "up" && row < ROAD_LANES + 1) {
    row += 1;
    hops += 1;
  } else if (move === "down" && row > 0) {
    row -= 1;
    hops += 1;
  } else if (move === "left") {
    x = clamp(x - CHICKEN_SIDESTEP, 0.05, 0.95);
  } else if (move === "right") {
    x = clamp(x + CHICKEN_SIDESTEP, 0.05, 0.95);
  }
  const onRoad = row >= 1 && row <= ROAD_LANES;
  const alive = !onRoad || !carAt(cars, row, x);
  return { row, x, hops, alive };
}

export function chickenCrossed(state: ChickenState): boolean {
  return state.row > ROAD_LANES;
}

export function chickenScore(state: ChickenState): number {
  const rows = Math.min(state.row, ROAD_LANES);
  return Math.round(
    state.hops * CHICKEN_HOP_POINTS +
      rows * CHICKEN_ROW_POINTS +
      (chickenCrossed(state) ? CHICKEN_CROSS_POINTS : 0),
  );
}

/* -------------------------- Combate por carriles ------------------------ */

export const CLASH_LANES = 3;
export const CLASH_SHIP_HP = 100;
export const CLASH_HIT_DAMAGE = 25;
export const CLASH_KILL_POINTS = 100;
export const CLASH_WAVE_POINTS = 50;
/** Cuánto avanza una oleada por tick, de 1 (lejos) a 0 (encima). */
export const CLASH_ADVANCE = 0.34;
export const CLASH_ENEMIES_PER_WAVE = 4;

export interface ClashEnemy {
  lane: number;
  hp: number;
  /** Distancia restante, 0 es encima del jugador. */
  at: number;
}

export interface ClashState {
  lane: number;
  hp: number;
  shielded: boolean;
  enemies: ClashEnemy[];
  kills: number;
  wave: number;
  over: boolean;
}

export type ClashCommand = "left" | "right" | "fire" | "shield";

export function clashStart(): ClashState {
  return { lane: 1, hp: CLASH_SHIP_HP, shielded: false, enemies: [], kills: 0, wave: 1, over: false };
}

/** Oleada determinista: el mismo seed y la misma ola dan los mismos enemigos. */
export function clashWave(seed: number, wave: number, count = CLASH_ENEMIES_PER_WAVE): ClashEnemy[] {
  const enemies: ClashEnemy[] = [];
  for (let index = 0; index < count; index++) {
    const n = hash(seed, wave * 31 + index);
    enemies.push({
      lane: n % CLASH_LANES,
      hp: 1 + ((n >>> 5) % 2),
      at: clamp(1 - ((n >>> 11) % 20) / 100, 0.2, 1),
    });
  }
  return enemies;
}

/**
 * Un tick de combate.
 *
 * El disparo va siempre al enemigo más cercano del carril del jugador —no se
 * elige—, el escudo aguanta un golpe y la oleada avanza después de disparar,
 * así que un disparo a tiempo salva el carril y uno tarde no.
 */
export function clashTick(
  state: ClashState,
  command: ClashCommand,
  seed: number,
): ClashState {
  if (state.over) return state;
  let lane = state.lane;
  let hp = state.hp;
  let shielded = state.shielded;
  let kills = state.kills;
  let wave = state.wave;
  let enemies = state.enemies.map((enemy) => ({ ...enemy }));

  if (command === "left") lane = clamp(lane - 1, 0, CLASH_LANES - 1);
  if (command === "right") lane = clamp(lane + 1, 0, CLASH_LANES - 1);
  if (command === "shield") shielded = true;
  if (command === "fire") {
    const target = enemies
      .filter((enemy) => enemy.lane === lane)
      .sort((a, b) => a.at - b.at)[0];
    if (target) {
      target.hp -= 1;
      if (target.hp <= 0) {
        enemies = enemies.filter((enemy) => enemy !== target);
        kills += 1;
      }
    }
  }

  enemies = enemies.map((enemy) => ({ ...enemy, at: clamp(enemy.at - CLASH_ADVANCE, 0, 1) }));
  const reaching = enemies.filter((enemy) => enemy.at <= 0 && enemy.lane === lane);
  if (reaching.length > 0) {
    enemies = enemies.filter((enemy) => !reaching.includes(enemy));
    if (!shielded) hp = clamp(hp - CLASH_HIT_DAMAGE * reaching.length, 0, CLASH_SHIP_HP);
    shielded = false;
  }

  if (enemies.length === 0) {
    wave += 1;
    enemies = clashWave(seed, wave);
  }

  return { lane, hp, shielded, enemies, kills, wave, over: hp <= 0 };
}

export function clashScore(state: ClashState): number {
  return state.kills * CLASH_KILL_POINTS + (state.wave - 1) * CLASH_WAVE_POINTS;
}
