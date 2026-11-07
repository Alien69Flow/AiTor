import { describe, expect, it } from "vitest";
import {
  AURORA_CALM_KP,
  AURORA_LAYERS,
  AURORA_STORM_KP,
  auroraLayersToRelease,
  hasStormPassed,
  isGeomagneticStorm,
  kpToStormScale,
} from "./aurora-storm";

/**
 * El encendido automático de la aurora no se puede probar a ojo: depende de un
 * Kp que cambia cada diez minutos. Estas pruebas fijan el umbral, la
 * histéresis y qué capas se sueltan al terminar la tormenta.
 */
describe("aurora automática por tormenta geomagnética", () => {
  it("sólo es tormenta a partir de Kp 5 (G1)", () => {
    expect(AURORA_STORM_KP).toBe(5);
    expect(isGeomagneticStorm(4.9)).toBe(false);
    expect(isGeomagneticStorm(5)).toBe(true);
    expect(isGeomagneticStorm(7.5)).toBe(true);
  });

  it("un Kp ausente no enciende la aurora", () => {
    expect(isGeomagneticStorm(Number.NaN)).toBe(false);
    expect(hasStormPassed(Number.NaN)).toBe(true);
  });

  it("suelta la capa por debajo de Kp 4, no al bajar de 5", () => {
    expect(AURORA_CALM_KP).toBe(4);
    // Con histéresis: entre 4 y 5 ni enciende ni apaga, se queda como está.
    expect(hasStormPassed(4.5)).toBe(false);
    expect(hasStormPassed(3.9)).toBe(true);
    expect(hasStormPassed(5)).toBe(false);
  });

  it("la escala G sale del Kp", () => {
    expect(kpToStormScale(4.9)).toBeNull();
    expect(kpToStormScale(5)).toBe("G1");
    expect(kpToStormScale(6.2)).toBe("G2");
    expect(kpToStormScale(7)).toBe("G3");
    expect(kpToStormScale(8.7)).toBe("G4");
    expect(kpToStormScale(9)).toBe("G5");
    // Por encima de 9 no existe G6: se queda en G5.
    expect(kpToStormScale(12)).toBe("G5");
  });

  it("enciende las dos capas que dibujan la aurora", () => {
    expect([...AURORA_LAYERS]).toEqual(["magnetosphere", "solarActivity"]);
  });

  it("al terminar sólo apaga lo que encendió el aviso", () => {
    // El usuario ya tenía la magnetosfera puesta: se queda.
    expect(auroraLayersToRelease(["magnetosphere"])).toEqual(["solarActivity"]);
    // Sin nada puesto, se sueltan las dos.
    expect(auroraLayersToRelease([])).toEqual(["magnetosphere", "solarActivity"]);
    // Con las dos puestas antes, no se apaga ninguna.
    expect(auroraLayersToRelease(["magnetosphere", "solarActivity"])).toEqual([]);
  });
});
