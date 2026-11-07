import { describe, expect, it } from "vitest";
import { kpToGeomagneticLevel, scaleLevel, spaceWeatherAlert } from "./space-weather-alert";

const base = { kpIndex: 0, stormLevel: "none", radioBlackout: "none", geomagneticStorm: "none" };

describe("alerta de clima espacial", () => {
  it("sin escalas activas no hay alerta", () => {
    expect(spaceWeatherAlert(base)).toBeNull();
  });

  it("una tormenta geomagnética se nombra como tal, no como radiación solar", () => {
    const alert = spaceWeatherAlert({ ...base, geomagneticStorm: "G2", kpIndex: 6 });
    expect(alert?.text).toBe("GEOMAGNETIC STORM G2 — Kp 6.0");
    expect(alert?.text).not.toMatch(/RADIATION|none/);
    expect(alert?.severity).toBe("HIGH");
  });

  it("no imprime «none» de las escalas que no están activas", () => {
    const alert = spaceWeatherAlert({ ...base, radioBlackout: "R1" });
    expect(alert?.text).toBe("RADIO BLACKOUT R1");
  });

  it("la gravedad sale de la escala más alta, no del simple hecho de haber tormenta", () => {
    expect(spaceWeatherAlert({ ...base, stormLevel: "S1" })?.severity).toBe("HIGH");
    expect(spaceWeatherAlert({ ...base, stormLevel: "S3" })?.severity).toBe("CRITICAL");
    expect(spaceWeatherAlert({ ...base, radioBlackout: "R5" })?.severity).toBe("CRITICAL");
  });

  it("con varias escalas activas se listan todas en orden de impacto", () => {
    const alert = spaceWeatherAlert({
      kpIndex: 8.25,
      geomagneticStorm: "G4",
      stormLevel: "S2",
      radioBlackout: "R1",
    });
    expect(alert?.text).toBe(
      "GEOMAGNETIC STORM G4 · SOLAR RADIATION STORM S2 · RADIO BLACKOUT R1 — Kp 8.3",
    );
    expect(alert?.severity).toBe("CRITICAL");
  });

  it("el Kp por debajo de tormenta no ensucia el titular", () => {
    expect(spaceWeatherAlert({ ...base, radioBlackout: "R1", kpIndex: 2 })?.text).toBe(
      "RADIO BLACKOUT R1",
    );
  });

  it("una tormenta geomagnética se nombra como tal, no como radiación solar (Kp alto)", () => {
    const alert = spaceWeatherAlert({ ...base, kpIndex: 6 });
    expect(alert?.text).not.toMatch(/RADIATION|none/);
  });

  it("avisa con sólo el Kp cuando la escala G resumen va retrasada", () => {
    const alert = spaceWeatherAlert({ ...base, kpIndex: 6 });
    expect(alert?.text).toBe("GEOMAGNETIC STORM G2 — Kp 6.0");
    expect(alert?.severity).toBe("HIGH");
  });

  it("el Kp no rebaja una escala G mayor que la que implica", () => {
    const alert = spaceWeatherAlert({ ...base, geomagneticStorm: "G4", kpIndex: 5 });
    expect(alert?.text).toBe("GEOMAGNETIC STORM G4 — Kp 5.0");
  });

  it("traduce Kp a escala G como NOAA (5→G1 … 9→G5)", () => {
    expect(kpToGeomagneticLevel(4)).toBe(0);
    expect(kpToGeomagneticLevel(5)).toBe(1);
    expect(kpToGeomagneticLevel(6.7)).toBe(2);
    expect(kpToGeomagneticLevel(9)).toBe(5);
    expect(kpToGeomagneticLevel(Number.NaN)).toBe(0);
  });

  it("entiende las escalas como las manda NOAA (null, número o etiqueta)", () => {
    expect(scaleLevel(null)).toBe(0);
    expect(scaleLevel(undefined)).toBe(0);
    expect(scaleLevel("none")).toBe(0);
    expect(scaleLevel("G2")).toBe(2);
    expect(scaleLevel("2")).toBe(2);
    expect(scaleLevel(3)).toBe(3);
  });
});
