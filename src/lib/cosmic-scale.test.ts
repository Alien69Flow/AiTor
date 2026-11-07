import { describe, expect, it } from "vitest";
import { COSMIC_STEP, SCALE_MAX, SCALE_MIN, STAGES, nextCosmicScale } from "./cosmic-scale";

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

/**
 * La escalera tiene que ser continua: si una ventana empieza después de que
 * acabe la anterior, al alejar la cámara el overlay se queda en negro entre dos
 * escenas; si se solapan demasiado, se ven dos escalas a la vez.
 */
describe("escalera cósmica", () => {
  it("va de la Tierra al universo observable sin saltos", () => {
    expect(STAGES[0].from).toBe(SCALE_MIN);
    expect(STAGES[STAGES.length - 1].to).toBe(SCALE_MAX);
  });

  it("cada peldaño solapa con el siguiente", () => {
    for (let i = 0; i < STAGES.length - 1; i += 1) {
      expect(STAGES[i].to).toBeGreaterThan(STAGES[i + 1].from);
      expect(STAGES[i + 1].from).toBeGreaterThanOrEqual(STAGES[i].from);
    }
  });

  it("cada peldaño ocupa al menos una década", () => {
    for (const stage of STAGES) {
      expect(stage.to - stage.from).toBeGreaterThan(1);
    }
  });

  it("los diez escalones están en orden y con nombre", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      "earth",
      "cislunar",
      "solar",
      "oort",
      "neighborhood",
      "milkyway",
      "localgroup",
      "virgo",
      "supercluster",
      "universe",
    ]);
    for (const stage of STAGES) {
      expect(stage.label.length).toBeGreaterThan(2);
      expect(stage.caption.length).toBeGreaterThan(10);
    }
  });
});
