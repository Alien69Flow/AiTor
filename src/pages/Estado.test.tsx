import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import Estado from "./Estado";

/**
 * Tres estados, que son los que importan: veredicto leído, servidor que
 * contesta que no puede leer, y petición que no llega. El último es el que
 * antes se rellenaba con un verde falso.
 */

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Estado />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const healthy = {
  status: "HEALTHY",
  dataStatus: "OK",
  checkedAt: new Date().toISOString(),
  summary: { total: 5, ok: 5, stale: 0, empty: 0, error: 0 },
  problems: [],
  upstreams: [
    { key: "telegram", label: "Telegram", status: "OK" },
    { key: "chat", label: "Función chat", status: "UNCONFIGURED" },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/estado", () => {
  it("enseña veredicto, frescura y upstreams de la vista compacta", async () => {
    const fetchMock = respond(healthy);
    renderPage();

    expect(await screen.findByText("Sano")).toBeTruthy();
    expect(screen.getByText("Estado de los datos: OK")).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "LI" &&
          (element.textContent ?? "").replace(/\s+/g, " ").includes("5 de 5 conjuntos dentro de su ventana"),
      ),
    ).toBeTruthy();
    expect(screen.getByText("Telegram")).toBeTruthy();
    expect(screen.getByText("sin configurar (no es un fallo)")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health?compact=1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("no inventa un veredicto cuando el servidor no puede leer su almacén", async () => {
    respond(
      { error: "redis unreachable", code: "redis_down", requestId: "2026-11-23T00:00:00Z" },
      503,
    );
    renderPage();

    expect(await screen.findByText("Sin datos ahora mismo")).toBeTruthy();
    expect(screen.getByText("redis_down")).toBeTruthy();
    expect(screen.getByText("2026-11-23T00:00:00Z")).toBeTruthy();
    expect(screen.queryByText("Sano")).toBeNull();
  });

  it("dice que la petición no llegó en vez de quedarse en blanco", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("network"))));
    renderPage();

    expect(await screen.findByText("La petición no llegó al servidor.")).toBeTruthy();
  });

  it("con el despliegue sin almacén enseña lo que falta, no un recuento falso", async () => {
    respond({
      status: "UNCONFIGURED",
      dataStatus: "UNKNOWN",
      checkedAt: new Date().toISOString(),
      detail: "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_*) no están definidas",
      upstreams: [{ key: "telegram", label: "Telegram", status: "UNCONFIGURED" }],
    });
    renderPage();

    expect(await screen.findByText("Sin configurar")).toBeTruthy();
    expect(screen.getByText(/No hay recuento que enseñar/)).toBeTruthy();
    expect(screen.getByText(/UPSTASH_REDIS_REST_URL/)).toBeTruthy();
  });

  it("descarta una respuesta con forma desconocida", async () => {
    respond({ hello: "world" });
    renderPage();

    expect(await screen.findByText("Sin datos ahora mismo")).toBeTruthy();
    expect(screen.getByText("La respuesta no tenía el formato de la vista compacta.")).toBeTruthy();
  });
});
