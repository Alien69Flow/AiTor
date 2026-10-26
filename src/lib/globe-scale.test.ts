import { describe, expect, it } from "vitest";
import {
  ZOOM_MAX_ALTITUDE_M,
  ZOOM_MIN_ALTITUDE_M,
  describeView,
  formatAltitude,
  formatDistance,
  groundWidthFromFov,
  scaleBar,
  zoomProgress,
} from "./globe-scale";

describe("escala del globo", () => {
  it("escribe distancias con la unidad que corresponde", () => {
    expect(formatDistance(0.4)).toBe("40 cm");
    expect(formatDistance(4.2)).toBe("4,2 m");
    expect(formatDistance(870)).toBe("870 m");
    expect(formatDistance(8_400)).toBe("8,4 km");
    expect(formatDistance(870_000)).toBe("870 km");
    // 10^6 m son 1 000 km, no un millón de km: el umbral estaba mal.
    expect(formatDistance(1_500_000)).toBe("1500 km");
    expect(formatDistance(6_371_000)).toBe("6371 km");
    expect(formatDistance(20_000_000)).toBe("20.000 km");
    expect(formatDistance(384_400_000)).toBe("384.400 km");
    expect(formatDistance(2_000_000_000)).toBe("2,00 millones de km");
  });

  it("no inventa números con entradas imposibles", () => {
    expect(formatDistance(Number.NaN)).toBe("—");
    expect(formatDistance(-5)).toBe("—");
    expect(formatAltitude(-1)).toBe("0 m");
  });

  it("elige una barra redonda que cabe en el ancho disponible", () => {
    // 1 km por píxel y 132 px: la barra cómoda es 100 km (100 px).
    const bar = scaleBar(1_000, 132);
    expect(bar).not.toBeNull();
    expect(bar!.metres).toBe(100_000);
    expect(bar!.pixels).toBe(100);
    expect(bar!.label).toBe("100 km");
    expect(bar!.pixels).toBeLessThanOrEqual(132);
  });

  it("la barra cambia de magnitud al acercar la cámara", () => {
    const far = scaleBar(1_000, 132);
    const near = scaleBar(2, 132);
    expect(far!.metres).toBeGreaterThan(near!.metres);
    expect(near!.metres).toBe(200);
  });

  it("descarta escalas no utilizables", () => {
    expect(scaleBar(0, 132)).toBeNull();
    expect(scaleBar(-1, 132)).toBeNull();
    expect(scaleBar(Number.NaN, 132)).toBeNull();
    expect(scaleBar(1_000, 4)).toBeNull();
    // 1 cm por píxel en una barra de 132 px: elegiría 100 cm, no 1 km.
    expect(scaleBar(0.01, 132)!.metres).toBe(1);
  });

  it("calcula el ancho de vista de reserva con el campo de visión", () => {
    const width = groundWidthFromFov(10_000, Math.PI / 3, 16 / 9);
    expect(width).toBeGreaterThan(10_000);
    expect(groundWidthFromFov(0, Math.PI / 3, 1)).toBe(0);
  });

  it("nombra lo que se ve según la altura", () => {
    expect(describeView(800)).toBe("Distrito");
    expect(describeView(12_000)).toBe("Ciudad");
    expect(describeView(120_000)).toBe("Región");
    expect(describeView(1_500_000)).toBe("Continente");
    expect(describeView(8_000_000)).toBe("Hemisferio");
    expect(describeView(40_000_000)).toBe("Disco terrestre");
  });

  it("el progreso de zoom va de 0 (lejos) a 1 (pegado al suelo)", () => {
    expect(zoomProgress(ZOOM_MAX_ALTITUDE_M)).toBeCloseTo(0, 5);
    expect(zoomProgress(ZOOM_MIN_ALTITUDE_M)).toBeCloseTo(1, 5);
    expect(zoomProgress(1_000_000)).toBeGreaterThan(0);
    expect(zoomProgress(1_000_000)).toBeLessThan(1);
  });
});
