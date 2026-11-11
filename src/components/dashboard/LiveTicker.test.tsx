import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveTicker } from "./LiveTicker";

describe("coastal and orbital observations", () => {
  it("locates the observed tide station without treating it as a critical alert", () => {
    const locate = vi.fn();
    render(<LiveTicker onLocate={locate} tides={[{ station: "8518750", name: "The Battery", lat: 40.7, lon: -74.01, heightM: 0.798, time: new Date().toISOString(), provisional: true, source: "NOAA CO-OPS" }]} />);
    fireEvent.click(screen.getAllByRole("button", { name: /The Battery/ })[0]);
    expect(locate).toHaveBeenCalledWith(40.7, -74.01);
    expect(screen.queryByText("CRITICAL")).toBeNull();
  });
  it("omits an expired orbital observation", () => {
    render(<LiveTicker iss={{ lat: 20, lon: 30, altKm: 400, speedKmh: 27000, visibility: "daylight", measuredAt: Math.floor(Date.now() / 1000) - 120 }} />);
    expect(screen.queryByText(/ISS ·/)).toBeNull();
  });
});