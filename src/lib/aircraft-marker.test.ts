import { describe, expect, it } from "vitest";
import {
  MARKER_EDGE,
  MARKER_HALO,
  aircraftMarkerIcon,
  aircraftMarkerSvg,
} from "./aircraft-marker";

/**
 * El icono del tráfico aéreo era un avión verde con borde oscuro de 1 px: sobre
 * tierra verde no se distinguía y a pocos cientos de kilómetros de cámara la
 * etiqueta desaparecía. Estas comprobaciones fijan lo que lo hacía ilegible:
 * el halo claro debajo, el contorno oscuro encima y una figura por categoría.
 */
describe("marcador de aeronave", () => {
  it("devuelve un data URI que se puede decodificar", () => {
    const uri = aircraftMarkerIcon("A3", "#E2E8F0");
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(aircraftMarkerSvg("A3", "#E2E8F0")).toContain("<svg");
  });

  it("lleva halo claro y contorno oscuro: legible sobre mar, selva y nieve", () => {
    const svg = aircraftMarkerSvg("A3", "#E2E8F0");
    expect(svg).toContain(`stroke="${MARKER_HALO}"`);
    expect(svg).toContain(`stroke="${MARKER_EDGE}"`);
  });

  it("el halo es más grueso que el contorno", () => {
    const svg = aircraftMarkerSvg("A3", "#E2E8F0");
    const halo = Number(/stroke-width="([\d.]+)" stroke-linejoin="round">/.exec(svg)?.[1]);
    const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    // El primero es el halo; el segundo, el borde de la figura.
    expect(widths[0]).toBeGreaterThan(widths[widths.length - 1]);
    expect(halo).toBeGreaterThan(3);
  });

  it("pinta con el color que le da el catálogo", () => {
    expect(aircraftMarkerSvg("A3", "#E2E8F0")).toContain('fill="#E2E8F0"');
    expect(aircraftMarkerSvg("A3", "#69AF00")).toContain('fill="#69AF00"');
  });

  it("cada categoría ADS-B tiene su figura", () => {
    // A7 rotorcraft, B2 globo/dirigible, B6 no tripulada; el resto, avión.
    expect(aircraftMarkerSvg("A7", "#fff")).toContain("<path d=\"M4 8.5h32v2.4H4z\"/>");
    expect(aircraftMarkerSvg("B2", "#fff")).toContain("M20 3.5c5.4 0");
    expect(aircraftMarkerSvg("B6", "#fff")).toContain('circle cx="11" cy="11" r="5"');
    expect(aircraftMarkerSvg(null, "#fff")).toContain("M20 2.5 23 12.5");
  });

  it("una categoría desconocida no inventa una figura", () => {
    // Mejor un avión genérico que un dron falso.
    expect(aircraftMarkerSvg("ZZ", "#fff")).toBe(aircraftMarkerSvg("A1", "#fff"));
  });

  it("cada tipo de vuelo tiene una forma distinta", () => {
    const shapes = ["pasajeros", "carga", "militar", "gobierno", "privado"] as const;
    const svgs = shapes.map((role) => aircraftMarkerSvg(null, "#fff", role));
    expect(new Set(svgs).size).toBe(shapes.length);
    // Pasajeros es el avión de siempre; militar, una flecha; Estado, una estrella.
    expect(aircraftMarkerSvg(null, "#fff", "pasajeros")).toBe(aircraftMarkerSvg(null, "#fff"));
    expect(aircraftMarkerSvg(null, "#fff", "militar")).toContain("M20 3 34.5 34");
    expect(aircraftMarkerSvg(null, "#fff", "gobierno")).toContain("l4.4 11.1");
  });

  it("la categoría física manda sobre el tipo inferido", () => {
    // Un helicóptero militar sigue siendo un helicóptero, no una flecha.
    expect(aircraftMarkerSvg("A7", "#fff", "militar")).toBe(aircraftMarkerSvg("A7", "#fff"));
    expect(aircraftMarkerSvg("B6", "#fff", "carga")).toBe(aircraftMarkerSvg("B6", "#fff"));
  });

  it("el color es el que le pasa la banda de altitud", () => {
    expect(aircraftMarkerSvg(null, "#fbbf24", "pasajeros")).toContain('fill="#fbbf24"');
    expect(aircraftMarkerSvg(null, "#34d399", "carga")).toContain('fill="#34d399"');
  });
});
