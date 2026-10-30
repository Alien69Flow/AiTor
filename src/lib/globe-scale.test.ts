import { describe, expect, it } from "vitest";
import {
  EARTH_RADIUS_M,
  ZOOM_MAX_ALTITUDE_M,
  ZOOM_MIN_ALTITUDE_M,
  describeView,
  earthDiscRadiusDeg,
  formatAltitude,
  formatArc,
  formatDistance,
  groundWidthFromFov,
  horizonArcDeg,
  horizonArcMetres,
  scaleBar,
  viewSpan,
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

  it("el horizonte limita la superficie visible, no la altura", () => {
    // A 20 000 km el suelo plano daría 23 760 km de ancho; el planeta sólo deja
    // ver 152° de arco, que son 16 906 km. Antes la barra mentía un 40 %.
    const span = viewSpan({ altitudeM: 20_000_000, metresPerPixel: 16_500, viewportWidthPx: 1440 });
    expect(span.metres).toBeCloseTo(horizonArcMetres(20_000_000), 0);
    expect(span.metres).toBeLessThan(20_000_000);
    expect(span.clippedByHorizon).toBe(true);
    expect(Math.round(span.degrees)).toBe(152);

    // De cerca manda el campo de visión: el horizonte está a 202 km pero la
    // pantalla cubre mucho menos.
    const near = viewSpan({ altitudeM: 800 });
    expect(near.metres).toBeLessThan(5_000);
    expect(near.clippedByHorizon).toBe(false);
  });

  it("mide el disco y el horizonte con la geometría de la esfera", () => {
    expect(horizonArcDeg(0)).toBe(0);
    // A una altura igual al radio, el horizonte está a 60° del nadir.
    expect(horizonArcDeg(EARTH_RADIUS_M)).toBeCloseTo(120, 5);
    // Y desde ahí el disco terrestre ocupa justo el campo de visión de 60°.
    expect(2 * earthDiscRadiusDeg(EARTH_RADIUS_M)).toBeCloseTo(60, 5);
    // Nunca puede pasar del hemisferio completo.
    expect(horizonArcDeg(400_000_000)).toBeLessThan(180);
  });

  it("nombra lo que se ve con la geometría, no con umbrales a ojo", () => {
    expect(describeView(800)).toBe("Distrito");
    expect(describeView(12_000)).toBe("Ciudad");
    expect(describeView(120_000)).toBe("Región");
    expect(describeView(1_500_000)).toBe("Continente");
    expect(describeView(5_000_000)).toBe("Hemisferio");
    // El globo entero cabe en pantalla cuando su diámetro angular no pasa del
    // campo de visión: a 8 000 km son 52,6° y a 20 000 km 28°.
    expect(describeView(8_000_000)).toBe("Globo entero");
    expect(describeView(20_000_000)).toBe("Globo entero");
    // Con un campo de visión muy estrecho, el mismo globo ya no cabe.
    expect(describeView(20_000_000, { fovYRad: 0.2, aspect: 1 })).toBe("Hemisferio");
  });

  it("escribe los ángulos sin decimales falsos", () => {
    expect(formatArc(0)).toBe("0°");
    expect(formatArc(0.4)).toBe("40′");
    expect(formatArc(2.2)).toBe("2,2°");
    expect(formatArc(152.05)).toBe("152°");
    expect(formatArc(Number.NaN)).toBe("—");
  });

  it("el progreso de zoom va de 0 (lejos) a 1 (pegado al suelo)", () => {
    expect(zoomProgress(ZOOM_MAX_ALTITUDE_M)).toBeCloseTo(0, 5);
    expect(zoomProgress(ZOOM_MIN_ALTITUDE_M)).toBeCloseTo(1, 5);
    expect(zoomProgress(1_000_000)).toBeGreaterThan(0);
    expect(zoomProgress(1_000_000)).toBeLessThan(1);
  });
});
