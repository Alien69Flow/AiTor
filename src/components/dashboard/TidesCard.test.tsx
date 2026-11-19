import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TidesPanel } from "./TidesCard";
import { TIDE_COVERAGE, TIDE_SOURCE, type TideReading } from "@/lib/tides";

const STATION = { id: "acoruna", name: "A Coruña", region: "Atlántico norte", lat: 43.37, lon: -8.4 };

const reading = (overrides: Partial<TideReading> = {}): TideReading => ({
  station: STATION,
  heightM: 1,
  trend: "subiendo",
  next: { kind: "pleamar", heightM: 1.4, atIso: "2026-11-19T06:00:00.000Z" },
  currentKmh: 1.2,
  currentDirectionDeg: 290,
  covered: true,
  ...overrides,
});

const base = {
  readings: [reading()],
  loading: false,
  error: null as string | null,
  lastUpdate: new Date("2026-11-19T12:00:00.000Z"),
  covered: 1,
};

describe("TidesPanel", () => {
  it("con dato muestra altura, rumbo y la fuente con su cobertura", () => {
    render(<TidesPanel {...base} />);

    expect(screen.getByText("A Coruña")).toBeTruthy();
    expect(screen.getByText("+1.00 m")).toBeTruthy();
    expect(screen.getByText(/▲ pleamar 06:00/)).toBeTruthy();
    expect(screen.getByText(/corriente 1\.2 km\/h · ONO/)).toBeTruthy();
    expect(screen.getByText(new RegExp(TIDE_SOURCE))).toBeTruthy();
    expect(screen.getByText(new RegExp(TIDE_COVERAGE))).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("si la fuente no responde lo dice y no enseña ninguna cifra", () => {
    render(<TidesPanel {...base} readings={[]} covered={0} error="HTTP 503" />);

    expect(screen.getByText(/no responde/i)).toBeTruthy();
    expect(screen.getByText("SIN FUENTE")).toBeTruthy();
    // Ninguna altura: ni real ni estimada.
    expect(screen.queryByText(/\d,\d\d m|\d\.\d\d m/)).toBeNull();
    expect(screen.queryByText("LIVE")).toBeNull();
  });

  it("un punto sin cobertura se dice, no se rellena con cero", () => {
    render(
      <TidesPanel
        {...base}
        readings={[reading({ heightM: null, trend: null, next: null, covered: false })]}
        covered={0}
      />,
    );

    expect(screen.getByText("sin cobertura")).toBeTruthy();
    expect(screen.getByText("SIN COBERTURA")).toBeTruthy();
    expect(screen.queryByText(/\d\.\d\d m/)).toBeNull();
    // Sigue diciendo de dónde vendría el dato y qué cubre.
    expect(screen.getByText(new RegExp(TIDE_SOURCE))).toBeTruthy();
    expect(screen.getByText(new RegExp(TIDE_COVERAGE))).toBeTruthy();
  });

  it("mientras carga no afirma nada", () => {
    render(<TidesPanel {...base} readings={[]} covered={0} loading lastUpdate={null} />);

    expect(screen.getByText(/Consultando Open-Meteo Marine/)).toBeTruthy();
    expect(screen.getByText("CARGANDO")).toBeTruthy();
  });
});
