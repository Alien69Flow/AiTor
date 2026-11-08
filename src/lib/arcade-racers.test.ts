import { describe, expect, it } from "vitest";
import {
  CHICKEN_CROSS_POINTS,
  CHICKEN_START_X,
  CLASH_ADVANCE,
  CLASH_HIT_DAMAGE,
  CLASH_LANES,
  CLASH_SHIP_HP,
  KART_ACCEL,
  KART_CURVE_PULL,
  KART_DRAG,
  KART_DRIFT_RATE,
  KART_GRIP_LIMIT,
  KART_LAP_LENGTH,
  KART_LAPS,
  KART_MAX_SPEED,
  ROAD_LANES,
  carAt,
  chickenCrossed,
  chickenScore,
  chickenStart,
  chickenStep,
  clashScore,
  clashStart,
  clashTick,
  clashWave,
  kartCurve,
  kartFinished,
  kartScore,
  kartStart,
  kartStep,
  trafficAt,
  type TrafficCar,
} from "./arcade-racers";

/** El motor acota el paso a un décimo de segundo: las pruebas lo usan tal cual. */
const STEP = 0.1;

describe("kart", () => {
  it("arranca parado y acelera en el primer paso", () => {
    const after = kartStep(kartStart(), { steer: 0 }, 0, STEP);
    const speed = (KART_ACCEL - KART_DRAG) * STEP;
    expect(kartStart().speed).toBe(0);
    expect(after.speed).toBeCloseTo(speed, 6);
    expect(after.distance).toBeCloseTo(speed * STEP, 6);
    expect(after.lap).toBe(1);
  });

  it("un paso más largo que el máximo se acota igual", () => {
    expect(kartStep(kartStart(), { steer: 0 }, 0, 1)).toEqual(
      kartStep(kartStart(), { steer: 0 }, 0, STEP),
    );
  });

  it("frenar no deja velocidad negativa", () => {
    let state = { ...kartStart(), speed: 100, distance: 500 };
    for (let i = 0; i < 10; i++) state = kartStep(state, { steer: 0, brake: true }, 0, STEP);
    expect(state.speed).toBe(0);
    expect(state.distance).toBeGreaterThan(500);
  });

  it("no pasa de la velocidad máxima", () => {
    let state = kartStart();
    for (let i = 0; i < 80; i++) state = kartStep(state, { steer: 0 }, 0, 0.05);
    expect(state.speed).toBe(KART_MAX_SPEED);
  });

  it("la curva saca el coche y el volante lo devuelve", () => {
    const pull = (KART_CURVE_PULL / KART_MAX_SPEED) * KART_DRIFT_RATE * STEP;
    let state = { ...kartStart(), speed: KART_MAX_SPEED };
    for (let i = 0; i < 10; i++) state = kartStep(state, { steer: 0 }, 1, STEP);
    expect(state.drift).toBeCloseTo(pull * 10, 6);
    // La curva empuja a la derecha: el volante a la izquierda devuelve el coche.
    expect(kartStep(state, { steer: -1 }, 1, STEP).drift).toBeLessThan(state.drift);
    // Y a la derecha lo saca aún más: el volante empuja hacia donde se pulsa.
    expect(kartStep(state, { steer: 1 }, 1, STEP).drift).toBeGreaterThan(state.drift);
  });

  it("fuera de pista se cobra en distancia y se marca el tiempo", () => {
    const off = { ...kartStart(), speed: KART_MAX_SPEED, drift: KART_GRIP_LIMIT + 0.1 };
    let state = off;
    for (let i = 0; i < 10; i++) state = kartStep(state, { steer: 0 }, 0, STEP);
    expect(state.offTrack).toBeCloseTo(1, 6);
    expect(state.distance).toBeLessThan(KART_MAX_SPEED);
  });

  it("vuelve al asfalto y el contador de fuera de pista se resetea", () => {
    const back = { ...kartStart(), speed: 100, drift: 0, offTrack: 3 };
    expect(kartStep(back, { steer: 0 }, 0, STEP).offTrack).toBe(0);
  });

  it("la vuelta sube al cruzar la meta y la partida termina a las dos", () => {
    const nearEnd = { ...kartStart(), distance: KART_LAP_LENGTH - 10, speed: KART_MAX_SPEED };
    const after = kartStep(nearEnd, { steer: 0 }, 0, 0.5);
    expect(after.lap).toBe(2);
    expect(kartFinished(after)).toBe(false);
    expect(kartFinished({ ...after, distance: KART_LAPS * KART_LAP_LENGTH })).toBe(true);
  });

  it("el marcador no se pasa del techo de la partida", () => {
    const perfect = { ...kartStart(), distance: KART_LAPS * KART_LAP_LENGTH };
    expect(kartScore(kartStart())).toBe(0);
    expect(kartScore(perfect)).toBe(KART_LAPS * 1000);
    // Ya en la meta el parcial no cuenta: el techo son las vueltas de la partida.
    expect(kartScore({ ...perfect, distance: KART_LAPS * KART_LAP_LENGTH * 3 })).toBe(KART_LAPS * 1000);
    expect(kartScore({ ...kartStart(), distance: KART_LAP_LENGTH / 2 })).toBe(200);
  });

  it("la pista es determinista y cabe en el rango de pendiente", () => {
    expect(kartCurve(9, 3)).toBe(kartCurve(9, 3));
    for (let i = 0; i < 50; i++) {
      const curve = kartCurve(1234, i);
      expect(curve).toBeGreaterThanOrEqual(-1);
      expect(curve).toBeLessThanOrEqual(1);
    }
    expect(kartCurve(9, 3)).not.toBe(kartCurve(9, 4));
  });

  it("un paso de cero segundos no mueve nada", () => {
    const state = { ...kartStart(), speed: 120, distance: 30 };
    const after = kartStep(state, { steer: 1 }, 1, 0);
    expect(after.distance).toBe(30);
    expect(after.speed).toBe(120);
  });
});

describe("cruce de carriles", () => {
  it("el tráfico es el mismo para el mismo seed y cambia con el tiempo", () => {
    const a = trafficAt(77, 2);
    const b = trafficAt(77, 2);
    const later = trafficAt(77, 3);
    expect(a).toEqual(b);
    expect(later).not.toEqual(a);
  });

  it("hay dos coches por carril y todos dentro del carril", () => {
    const cars = trafficAt(5, 0);
    expect(cars).toHaveLength(ROAD_LANES * 2);
    for (const car of cars) {
      expect(car.lane).toBeGreaterThanOrEqual(1);
      expect(car.lane).toBeLessThanOrEqual(ROAD_LANES);
      expect(car.x).toBeGreaterThanOrEqual(0);
      expect(car.x).toBeLessThan(1);
    }
  });

  it("subir avanza una fila y bajar vuelve", () => {
    const empty: TrafficCar[] = [];
    const up = chickenStep(chickenStart(), "up", empty);
    expect(up.row).toBe(1);
    expect(chickenStep(up, "down", empty).row).toBe(0);
  });

  it("no se sale de la carretera por los lados", () => {
    const empty: TrafficCar[] = [];
    let state = chickenStart();
    for (let i = 0; i < 10; i++) state = chickenStep(state, "left", empty);
    expect(state.x).toBe(0.05);
    for (let i = 0; i < 20; i++) state = chickenStep(state, "right", empty);
    expect(state.x).toBe(0.95);
  });

  it("un coche encima mata, y la acera no", () => {
    const cars: TrafficCar[] = [{ lane: 1, x: CHICKEN_START_X }];
    expect(carAt(cars, 1, CHICKEN_START_X)).toBe(true);
    expect(chickenStep(chickenStart(), "up", cars).alive).toBe(false);
    expect(chickenStep(chickenStart(), "left", cars).alive).toBe(true);
  });

  it("la meta no mata aunque el tráfico siga ahí", () => {
    const cars: TrafficCar[] = [{ lane: 1, x: CHICKEN_START_X }];
    const top = { ...chickenStart(), row: ROAD_LANES };
    const finished = chickenStep(top, "up", cars);
    expect(finished.row).toBe(ROAD_LANES + 1);
    expect(finished.alive).toBe(true);
    expect(chickenCrossed(finished)).toBe(true);
  });

  it("cruzar paga más que quedarse a medio camino", () => {
    const half = { ...chickenStart(), row: 5, hops: 5 };
    const crossed = { ...chickenStart(), row: ROAD_LANES + 1, hops: ROAD_LANES + 1 };
    expect(chickenScore(crossed) - chickenScore(half)).toBeGreaterThanOrEqual(CHICKEN_CROSS_POINTS);
    expect(chickenScore(chickenStart())).toBe(0);
  });

  it("muerta no se mueve ni suma", () => {
    const dead = { ...chickenStart(), row: 2, alive: false };
    expect(chickenStep(dead, "up", [])).toEqual(dead);
  });
});

describe("combate por carriles", () => {
  it("la oleada es determinista y cae en los tres carriles", () => {
    const wave = clashWave(31, 1);
    expect(wave).toHaveLength(4);
    expect(clashWave(31, 1)).toEqual(wave);
    expect(clashWave(31, 2)).not.toEqual(wave);
    for (const enemy of wave) {
      expect(enemy.lane).toBeGreaterThanOrEqual(0);
      expect(enemy.lane).toBeLessThan(CLASH_LANES);
    }
  });

  it("el disparo mata al más cercano del carril y suma puntos", () => {
    const state = {
      ...clashStart(),
      enemies: [
        { lane: 1, hp: 1, at: 0.9 },
        { lane: 1, hp: 1, at: 0.4 },
        { lane: 0, hp: 1, at: 0.2 },
      ],
    };
    const after = clashTick(state, "fire", 7);
    expect(after.kills).toBe(1);
    expect(after.enemies).toHaveLength(2);
    expect(clashScore(after)).toBeGreaterThan(0);
  });

  it("un enemigo con dos puntos de vida aguanta el primer tiro", () => {
    const state = { ...clashStart(), enemies: [{ lane: 1, hp: 2, at: 1 }] };
    const after = clashTick(state, "fire", 7);
    expect(after.kills).toBe(0);
    expect(after.enemies).toHaveLength(1);
    expect(after.enemies[0].hp).toBe(1);
  });

  it("el escudo aguanta un golpe y se gasta", () => {
    const state = { ...clashStart(), enemies: [{ lane: 1, hp: 2, at: CLASH_ADVANCE }] };
    const shielded = clashTick(state, "shield", 7);
    expect(shielded.hp).toBe(CLASH_SHIP_HP);
    expect(shielded.shielded).toBe(false);
    // Sin escudo y sin mover de carril, el golpe entra.
    const hit = clashTick(state, "fire", 7);
    expect(hit.hp).toBe(CLASH_SHIP_HP - CLASH_HIT_DAMAGE);
    // Y moverse de carril esquiva: el enemigo se queda en el suyo.
    expect(clashTick(state, "left", 7).hp).toBe(CLASH_SHIP_HP);
  });

  it("el casco se vacía y la partida termina", () => {
    const state = { ...clashStart(), hp: CLASH_HIT_DAMAGE, enemies: [{ lane: 1, hp: 2, at: CLASH_ADVANCE }] };
    const after = clashTick(state, "fire", 7);
    expect(after.hp).toBe(0);
    expect(after.over).toBe(true);
    expect(clashTick(after, "right", 7)).toEqual(after);
  });

  it("moverse no se sale de los carriles", () => {
    let state = clashStart();
    for (let i = 0; i < 5; i++) state = clashTick({ ...state, enemies: [{ lane: 0, hp: 3, at: 1 }] }, "left", 7);
    expect(state.lane).toBe(0);
    for (let i = 0; i < 5; i++) state = clashTick({ ...state, enemies: [{ lane: 0, hp: 3, at: 1 }] }, "right", 7);
    expect(state.lane).toBe(CLASH_LANES - 1);
  });

  it("al limpiar la oleada entra la siguiente", () => {
    const state = { ...clashStart(), enemies: [{ lane: 1, hp: 1, at: 1 }] };
    const after = clashTick(state, "fire", 7);
    expect(after.wave).toBe(2);
    expect(after.enemies.length).toBeGreaterThan(0);
  });
});
