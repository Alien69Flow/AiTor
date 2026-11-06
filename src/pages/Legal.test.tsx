import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import Privacy from "./Privacy";
import Terms from "./Terms";

/**
 * Google revisa /privacy y /terms al publicar la app OAuth, así que no basta con
 * que las rutas existan: tienen que ser documentos de verdad. Esta prueba fija
 * lo que una página vacía o de relleno rompería — secciones, responsable,
 * contacto, derechos y las advertencias de mercado — para que el siguiente
 * cambio de maquetación no deje la verificación en "revisión pendiente".
 *
 * Se usan las APIs del DOM (no `jest-dom`, que este proyecto no instala).
 */
function renderLegal(page: React.ReactElement, path: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
    </HelmetProvider>,
  );
}

describe("páginas legales", () => {
  it("la política de privacidad explica qué datos trata y cómo ejercer derechos", () => {
    renderLegal(<Privacy />, "/privacy");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/política de privacidad/i);
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(10);

    const body = document.body.textContent ?? "";
    // Responsable, contacto y base legal son lo primero que busca el revisor.
    expect(body).toMatch(/ΔlieπFlΦw DAO/);
    expect(body).toMatch(/contact@alienflow\.space/);
    expect(body).toMatch(/base legal/i);
    // Derechos GDPR y la vía de reclamación.
    expect(body).toMatch(/Agencia Española de Protección de Datos/);
    expect(body).toMatch(/portabilidad/i);
    // Permisos de Google: se piden solo perfil y se pueden revocar.
    expect(body).toMatch(/myaccount\.google\.com\/permissions/);
    // Borrado de cuenta con plazo concreto.
    expect(body).toMatch(/30 días/);
  });

  it("los términos cubren cuenta, uso aceptable, IA, créditos y responsabilidad", () => {
    renderLegal(<Terms />, "/terms");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/términos de servicio/i);
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(10);

    const body = document.body.textContent ?? "";
    expect(body).toMatch(/uso aceptable/i);
    expect(body).toMatch(/modelos de lenguaje/i);
    expect(body).toMatch(/créditos/i);
    expect(body).toMatch(/limitación de responsabilidad/i);
    expect(body).toMatch(/legislación española/i);
    // La restricción real de Polymarket se avisa, no se esconde.
    expect(body).toMatch(/Polymarket/);
    expect(body).toMatch(/España/);
  });

  it("cada página enlaza a la otra y vuelve al terminal", () => {
    const { unmount } = renderLegal(<Privacy />, "/privacy");
    const privacyArticle = screen.getByRole("article");
    expect(
      within(privacyArticle).getByRole("link", { name: /términos de servicio/i }).getAttribute("href"),
    ).toBe("/terms");
    expect(screen.getByRole("link", { name: /volver al terminal/i }).getAttribute("href")).toBe("/");
    unmount();

    renderLegal(<Terms />, "/terms");
    expect(
      within(screen.getByRole("article"))
        .getByRole("link", { name: /política de privacidad/i })
        .getAttribute("href"),
    ).toBe("/privacy");
  });
});
