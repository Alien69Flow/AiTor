import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./Index";

/**
 * Nivel de app: se renderiza `Index` (cabecera, navegación, Suspense y lazy
 * import reales) con `?tab=alien` y se comprueba el orden de las secciones tal y
 * como las ve el visitante. El test del componente cubre lo mismo en
 * aislamiento; este detecta lo que sólo rompe al montar la página — un tab que
 * no carga, un orden distinto por el shell, o el módulo Alien detrás de otro.
 *
 * Se sustituyen las piezas que necesitan red o WebGL (wallet, chat flotante,
 * fondo animado, fuentes de datos), no la estructura que se quiere verificar.
 */
vi.mock("@/components/web3/ConnectWalletButton", () => ({
  ConnectWalletButton: () => <button type="button">Wallet</button>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, signOut: async () => ({ error: null }) }),
}));

vi.mock("@/hooks/useTier", () => ({
  useTier: () => ({ tier: "signal", loading: false, authed: false }),
}));

vi.mock("@/components/dashboard/PricingModal", () => ({ PricingModal: () => null }));
vi.mock("@/components/SpaceBackground", () => ({ SpaceBackground: () => null }));
vi.mock("@/components/chat/ChatDock", () => ({ ChatDock: () => null }));
vi.mock("@/components/dashboard/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/chat/ChatContainer", () => ({ ChatContainer: () => <div>chat</div> }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

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
}));

vi.mock("@/lib/uap-sightings", () => ({
  fetchAllUapSightingsRows: vi.fn(async () => fixtures.tableRows),
  isUapSightingsTableMissing: () => false,
}));

vi.mock("@/lib/nuforc-records", () => ({
  NUFORC_SOURCE: { label: "NUFORC (espejo abierto)", datasetUrl: "", officialUrl: "" },
  fetchNuforcRecords: vi.fn(async () => fixtures.nuforcRows),
  fetchNuforcMeta: vi.fn(async () => null),
}));

vi.mock("@/components/dashboard/LiveStage", () => ({
  LiveStage: ({ signal }: { signal: { label: string } }) => <div data-testid="stage">{signal.label}</div>,
}));

function renderApp() {
  return render(
    <HelmetProvider>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/?tab=alien"]}>
          <Index />
        </MemoryRouter>
      </TooltipProvider>
    </HelmetProvider>,
  );
}

describe("página principal · pestaña Alien", () => {
  it("monta el monitor UAP dentro del shell de la app", async () => {
    renderApp();

    expect(await screen.findByText(/Monitor UAP — anomalías y cámaras en directo/i)).toBeTruthy();
    // La cabecera de escritorio y la barra inferior comparten etiqueta.
    expect(screen.getAllByRole("navigation", { name: /Secciones del terminal/i }).length).toBeGreaterThan(0);
  });

  it("mantiene el orden fuentes → cámaras → registro → histórico", async () => {
    renderApp();

    // El módulo entra por lazy import y la lista de cámaras es grande: se espera
    // a su primera sección con margen, sin depender de la velocidad del runner.
    const sources = await screen.findByLabelText("Fuentes oficiales", {}, { timeout: 10_000 });
    await waitFor(() => expect(document.querySelectorAll("article").length).toBeGreaterThan(0));

    const live = screen.getByLabelText("Señales en directo");
    const registry = screen.getByLabelText("Registro de avistamientos");
    const historic = screen.getByLabelText("Registro histórico");

    const before = (first: HTMLElement, second: HTMLElement) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(before(sources, live)).toBeTruthy();
    expect(before(live, registry)).toBeTruthy();
    expect(before(registry, historic)).toBeTruthy();
  });

  it("abre la pestaña Alien desde el parámetro de la URL", async () => {
    renderApp();
    await screen.findByLabelText("Fuentes oficiales", {}, { timeout: 10_000 });

    // Si el shell hubiese caído en Agentes, el monitor no estaría montado.
    expect(screen.queryByText("chat")).toBeNull();
    expect(screen.getByRole("group", { name: "Categorías de señal" })).toBeTruthy();
  });
});
