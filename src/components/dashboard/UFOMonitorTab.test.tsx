import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LIVE_CATEGORIES, LIVE_SIGNALS, OFFICIAL_SOURCES } from "@/lib/live-signals";
import { isSignalLive } from "@/lib/live-status";
import { UFOMonitorTab } from "./UFOMonitorTab";

/**
 * Three behaviours the Alien tab is judged on, and that a stale deployment used
 * to break: newest reports first, the anomaly registry painted before anything
 * else, and no camera video or thumbnail downloaded until the visitor picks a
 * category.
 */
const fixtures = vi.hoisted(() => ({
  tableRows: [
    {
      id: "table-2026",
      location: "Global",
      date_reported: "2026-06-19",
      type: "News Report",
      severity: "investigating",
      description: "The Pentagon released a new tranche of UAP files.",
      source: "Web Search",
      source_url: "https://example.org/news",
      lat: null,
      lon: null,
    },
  ],
  nuforcRows: [
    {
      id: "nuforc-2022",
      location: "Phoenix, AZ",
      date_reported: "2022-05-12",
      type: "Light",
      severity: "signal",
      description: "Single light crossing the sky.",
      source: "NUFORC (espejo abierto)",
      source_url: "https://github.com/DataHerb/nuforc-ufo-records",
      lat: null,
      lon: null,
    },
  ],
  meta: {
    dateFrom: "2022-04-02",
    dateTo: "2022-05-12",
    generatedAt: "2026-10-25T00:00:00.000Z",
    datasetAgeDays: 1626,
    stale: true,
  },
}));

vi.mock("@/lib/uap-sightings", () => ({
  fetchAllUapSightingsRows: vi.fn(async () => fixtures.tableRows),
  isUapSightingsTableMissing: () => false,
}));

vi.mock("@/lib/nuforc-records", () => ({
  NUFORC_SOURCE: { label: "NUFORC (espejo abierto)", datasetUrl: "", officialUrl: "" },
  fetchNuforcRecords: vi.fn(async () => fixtures.nuforcRows),
  fetchNuforcMeta: vi.fn(async () => fixtures.meta),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// The real stage mounts the YouTube player; the test only needs to know that it
// is mounted at all.
vi.mock("./LiveStage", () => ({
  LiveStage: ({ signal }: { signal: { label: string } }) => (
    <div data-testid="stage">{signal.label}</div>
  ),
}));

async function renderMonitor() {
  render(<UFOMonitorTab />);
  await waitFor(() => expect(document.querySelectorAll("article").length).toBeGreaterThan(1));
}

describe("Monitor UAP", () => {
  it("lista primero los registros de 2026 y deja los históricos después", async () => {
    await renderMonitor();

    const articles = [...document.querySelectorAll("article")];
    expect(articles[0].textContent).toContain("2026-06-19");
    expect(articles[1].textContent).toContain("2022-05-12");
  });

  it("coloca las fuentes, luego las cámaras, y después registro e histórico", async () => {
    await renderMonitor();

    const sources = screen.getByLabelText("Fuentes oficiales");
    const live = screen.getByLabelText("Señales en directo");
    const registry = screen.getByLabelText("Registro de avistamientos");
    const historic = screen.getByLabelText("Registro histórico");

    const before = (first: HTMLElement, second: HTMLElement) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(before(sources, live)).toBeTruthy();
    expect(before(live, registry)).toBeTruthy();
    expect(before(registry, historic)).toBeTruthy();
  });

  it("no descarga cámaras hasta que se elige una categoría", async () => {
    await renderMonitor();

    expect(screen.queryByTestId("stage")).toBeNull();
    expect(document.querySelectorAll("img[src*='ytimg']").length).toBe(0);

    const category = LIVE_CATEGORIES[0];
    await userEvent.click(screen.getByRole("button", { name: new RegExp(category.label, "i") }));

    expect(await screen.findByTestId("stage")).toBeTruthy();
  });

  it("cuenta las cámaras oficiales, no las confunde con las fuentes", async () => {
    await renderMonitor();

    const live = LIVE_SIGNALS.filter((signal) => isSignalLive(signal)).length;
    const official = LIVE_SIGNALS.filter((signal) => signal.official).length;
    expect(screen.getByText(`${live} señales en vivo`)).toBeTruthy();
    expect(screen.getByText(`${official} cámaras oficiales`)).toBeTruthy();
    expect(
      screen.getByText(
        `${OFFICIAL_SOURCES.length} fuentes · ${official} cámaras oficiales · ${LIVE_SIGNALS.length} cámaras en total`
      )
    ).toBeTruthy();
  });
});
