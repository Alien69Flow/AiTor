import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LIVE_CATEGORIES, LIVE_SIGNALS } from "@/lib/live-signals";
import { LIVE_REVIVED_STORAGE_KEY } from "@/lib/live-revived";
import { UFOMonitorTab } from "./UFOMonitorTab";

/**
 * Una cámara marcada «sin emisión» por el informe semanal puede estar emitiendo
 * otra vez. En cuanto el reproductor arranca, la marca debe caer sin recargar.
 * Se fuerza el estado offline de la primera cámara de la primera categoría y se
 * simula el `onReady` del reproductor.
 */
const first = LIVE_SIGNALS.find((signal) => signal.category === LIVE_CATEGORIES[0].id)!;

vi.mock("@/lib/live-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/live-status")>();
  return {
    ...actual,
    signalLiveState: (signal: { id: string }) =>
      signal.id === first.id ? "offline" : actual.signalLiveState(signal),
  };
});

vi.mock("@/lib/uap-sightings", () => ({
  fetchAllUapSightingsRows: vi.fn(async () => []),
  isUapSightingsTableMissing: () => false,
}));

vi.mock("@/lib/nuforc-records", () => ({
  NUFORC_SOURCE: { label: "NUFORC (espejo abierto)", datasetUrl: "", officialUrl: "" },
  fetchNuforcRecords: vi.fn(async () => []),
  fetchNuforcMeta: vi.fn(async () => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("./LiveStage", () => ({
  LiveStage: ({ signal, onLive }: { signal: { id: string; label: string }; onLive?: (s: unknown) => void }) => (
    <div data-testid="stage">
      {signal.label}
      <button type="button" onClick={() => onLive?.(signal)}>
        simular directo
      </button>
    </div>
  ),
}));

describe("Monitor UAP · cámara que vuelve a emitir", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retira la marca de sin emisión en cuanto el reproductor arranca", async () => {
    render(<UFOMonitorTab />);

    await userEvent.click(screen.getByRole("button", { name: new RegExp(LIVE_CATEGORIES[0].label, "i") }));

    const card = await screen.findByRole("button", { name: new RegExp(first.label, "i") });
    expect(card.textContent).toContain("Sin emisión");
    expect(screen.getByText(/no encontró emisión/i)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "simular directo" }));

    await waitFor(() => expect(card.textContent).toContain("En directo"));
    expect(card.textContent).not.toContain("Sin emisión");
    expect(screen.queryByText(/no encontró emisión/i)).toBeNull();

    const revived = JSON.parse(localStorage.getItem(LIVE_REVIVED_STORAGE_KEY) ?? "{}");
    expect(revived[first.id]).toBeTruthy();
  });

  it("no repite el desmarque ni lo aplica a otras cámaras", async () => {
    render(<UFOMonitorTab />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(LIVE_CATEGORIES[0].label, "i") }));
    await userEvent.click(await screen.findByRole("button", { name: "simular directo" }));

    const revived = JSON.parse(localStorage.getItem(LIVE_REVIVED_STORAGE_KEY) ?? "{}");
    expect(Object.keys(revived)).toEqual([first.id]);
  });
});
