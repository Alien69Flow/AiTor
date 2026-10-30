import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GlobeScaleHud } from "./GlobeScaleHud";
import { nextZoomAltitude, zoomRangeLabel } from "@/lib/globe-scale";

/**
 * La barra de escala tiene que decir kilómetros reales y avisar cuando no pudo
 * medirlos sobre el globo; si no, el usuario compara dos vistas con una regla
 * inventada.
 */
describe("GlobeScaleHud", () => {
  it("muestra la distancia de la barra, la altura y la superficie que abarca la vista", () => {
    render(
      <GlobeScaleHud
        scale={{ altitudeM: 20_000_000, metresPerPixel: 16_500, viewportWidthPx: 1440, estimated: false }}
      />,
    );

    expect(screen.getByTestId("globe-scale-label").textContent).toBe("2000 km");
    expect(screen.getByText("20.000 km")).toBeTruthy();
    // A 20 000 km se ve casi todo el planeta: 152° de arco, 16 906 km. La versión
    // anterior multiplicaba píxeles por escala (23 760 km) y se pasaba un 40 %.
    const span = screen.getByTestId("globe-span-value").textContent ?? "";
    expect(span).toContain("16.906 km");
    expect(span).toContain("152°");
    expect(screen.getByText(/rueda o pellizco para acercar/i)).toBeTruthy();
  });

  it("cambia de magnitud al acercar la cámara", () => {
    const { rerender } = render(
      <GlobeScaleHud
        scale={{ altitudeM: 20_000_000, metresPerPixel: 16_500, viewportWidthPx: 1440, estimated: false }}
      />,
    );
    const far = screen.getByTestId("globe-scale-label").textContent;

    rerender(
      <GlobeScaleHud
        scale={{ altitudeM: 12_000, metresPerPixel: 12, viewportWidthPx: 1440, estimated: false }}
      />,
    );
    const near = screen.getByTestId("globe-scale-label").textContent;

    expect(far).toBe("2000 km");
    expect(near).toBe("1 km");
    expect(near).not.toBe(far);
  });

  it("avisa cuando la escala es estimada y no medida sobre el globo", () => {
    render(
      <GlobeScaleHud
        scale={{ altitudeM: 500_000, metresPerPixel: 800, viewportWidthPx: 1440, estimated: true }}
      />,
    );
    expect(screen.getByText(/escala estimada/i)).toBeTruthy();
  });

  it("los botones de zoom llaman a la cámara y respetan los topes", () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const { rerender } = render(
      <GlobeScaleHud
        scale={{ altitudeM: 500_000, metresPerPixel: 800, viewportWidthPx: 1440, estimated: false }}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Acercar" }));
    fireEvent.click(screen.getByRole("button", { name: "Alejar" }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    // En el suelo del rango ya no se puede acercar más.
    rerender(
      <GlobeScaleHud
        scale={{ altitudeM: 250, metresPerPixel: 0.4, viewportWidthPx: 1440, estimated: false }}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />,
    );
    expect((screen.getByRole("button", { name: "Acercar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Alejar" }) as HTMLButtonElement).disabled).toBe(false);

    // Y en el techo (63 000 km) tampoco se puede alejar más.
    rerender(
      <GlobeScaleHud
        scale={{ altitudeM: 63_000_000, metresPerPixel: 52_000, viewportWidthPx: 1440, estimated: false }}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />,
    );
    expect((screen.getByRole("button", { name: "Acercar" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Alejar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("no pinta botones si no hay control de cámara", () => {
    render(
      <GlobeScaleHud scale={{ altitudeM: 500_000, metresPerPixel: 800, viewportWidthPx: 1440, estimated: false }} />,
    );
    expect(screen.queryByRole("button", { name: "Acercar" })).toBeNull();
  });

  it("anuncia el rango completo 250 m – 63.000 km", () => {
    expect(zoomRangeLabel()).toBe("250 m – 63.000 km");
    expect(nextZoomAltitude(250, "in")).toBeNull();
    expect(nextZoomAltitude(63_000_000, "out")).toBeNull();
    expect(nextZoomAltitude(1_000, "in")).toBe(600);
    expect(nextZoomAltitude(1_000, "out")).toBeCloseTo(1666.67, 1);
    expect(nextZoomAltitude(400, "in")).toBe(250);
  });

  it("marca el progreso de zoom disponible", () => {
    render(
      <GlobeScaleHud
        scale={{ altitudeM: 12_000, metresPerPixel: 12, viewportWidthPx: 1440, estimated: false }}
      />,
    );
    const bar = screen.getByRole("progressbar", { name: /acercamiento disponible/i });
    const value = Number(bar.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThan(50);
    expect(value).toBeLessThanOrEqual(100);
  });
});
