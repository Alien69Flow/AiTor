import { describe, expect, it } from "vitest";
import { COSMIC_STEP, SCALE_MAX, SCALE_MIN, nextCosmicScale } from "./cosmic-scale";

/**
 * Los botones del zoom cósmico comparten este paso con las flechas del teclado.
 * Si el rango o el tope se rompen, el botón mueve la cámara a un sitio donde el
 * overlay no puede dibujar nada: por eso el tope se comprueba aquí y no a ojo.
 */
describe("cosmic scale step", () => {
  it("acercar resta un paso y alejar lo suma", () => {
    expect(nextCosmicScale(10, "in")).toBeCloseTo(10 - COSMIC_STEP, 6);
    expect(nextCosmicScale(10, "out")).toBeCloseTo(10 + COSMIC_STEP, 6);
  });

  it("no se sale del rango del overlay", () => {
    const nearTop = SCALE_MAX - COSMIC_STEP / 2;
    expect(nextCosmicScale(nearTop, "out")).toBe(SCALE_MAX);
    const nearBottom = SCALE_MIN + COSMIC_STEP / 2;
    expect(nextCosmicScale(nearBottom, "in")).toBe(SCALE_MIN);
  });

  it("devuelve null en los topes para poder desactivar el botón", () => {
    expect(nextCosmicScale(SCALE_MAX, "out")).toBeNull();
    expect(nextCosmicScale(SCALE_MIN, "in")).toBeNull();
    expect(nextCosmicScale(Number.NaN, "out")).toBeNull();
  });

  it("el rango cubre del radio terrestre al universo observable", () => {
    // 10^6,6 m ≈ 4 000 km · 10^27,6 m ≈ 4 × 10^27 m (92 000 M años luz).
    expect(SCALE_MIN).toBeLessThan(Math.log10(6.371e6));
    expect(SCALE_MAX).toBeGreaterThan(26);
  });
});
