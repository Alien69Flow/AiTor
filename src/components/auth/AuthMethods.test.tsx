import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authClient } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthMethods } from "./AuthMethods";

/**
 * The login surface is the only place every method into the account meets, so
 * this covers what can silently regress: which methods are offered, that the
 * four direct modes swap their fields and second step, that a backend refusing
 * a send is translated to the panel where the feature gets enabled, and that
 * the session bar reports the identities actually linked to the account.
 *
 * Supabase, the wallet kit, analytics and Turnstile are all replaced: no
 * request leaves the test and no widget is rendered.
 */

/**
 * Provider readiness is a network probe against Supabase. In tests it is a
 * plain object, so no request leaves the process and each case can decide which
 * providers are dead.
 */
const providerStates = vi.hoisted(() => ({ current: {} as Record<string, string> }));

const refreshProviders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-provider-status", () => ({
  useProviderAvailability: () => ({
    states: providerStates.current,
    checked: true,
    refresh: refreshProviders,
  }),
  providerStateLabel: (state?: string) =>
    state === "missing-secret" ? "sin configurar" : state === "disabled" ? "no activado" : null,
}));

// The login surface talks to the identity client, not to the data one: the
// session is issued by the project that has the providers configured.
vi.mock("@/integrations/supabase/client", () => ({
  authClient: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
      signInWithPasskey: vi.fn(async () => ({ error: null })),
      registerPasskey: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: { url: "https://example.test/authorize" }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
  },
}));

vi.mock("@/hooks/useWalletAuth", () => ({
  useWalletAuth: vi.fn(() => ({
    signIn: vi.fn(async () => false),
    busy: false,
    error: null,
    isConnected: false,
    address: undefined,
  })),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackSupabaseError: vi.fn(),
}));

vi.mock("@/lib/turnstile", () => ({
  turnstileEnabled: vi.fn(() => false),
  turnstileToken: vi.fn(async () => null),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

/** Untyped handle over the mocked client, so expectations stay readable. */
const auth = authClient.auth as unknown as Record<string, ReturnType<typeof vi.fn>>;
const toastError = vi.mocked(toast.error);
const toastSuccess = vi.mocked(toast.success);

const textoDelBoton = (label: string) => screen.getByRole("button", { name: new RegExp(label, "i") });

describe("AuthMethods", () => {
  beforeEach(() => {
    providerStates.current = {};
    // Sin esto el historial de llamadas se arrastra entre casos: el recuento de
    // envíos de OTP empezaría en 1 y cualquier expectativa de "una vez" mentiría.
    vi.clearAllMocks();
  });

  it("ofrece todos los métodos: proveedores, passkey, wallet y los cuatro modos directos", async () => {
    render(<AuthMethods />);

    // La sesión inicial se resuelve en un efecto: se espera para que el primer
    // render sincrónico no dispare un estado fuera de act(...).
    await screen.findByRole("button", { name: "Google" });

    for (const proveedor of ["Apple", "GitHub", "Reddit", "WeChat"]) {
      expect(screen.getByRole("button", { name: proveedor })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: /Entrar con Passkey/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Conectar Wallet/i })).toBeTruthy();

    for (const modo of ["Clave", "Enlace", "Código", "SMS"]) {
      expect(screen.getByRole("button", { name: modo })).toBeTruthy();
    }
  });

  it("desactiva los proveedores que no pueden arrancar y dice por qué", async () => {
    providerStates.current = {
      google: "missing-secret",
      apple: "missing-secret",
      github: "disabled",
      discord: "ready",
    };

    render(<AuthMethods />);

    const google = await screen.findByRole("button", { name: /Google/i });
    expect(google).toHaveProperty("disabled", true);
    // El estado viaja en el nombre accesible y en el tooltip; el rótulo visible
    // es solo el nombre del proveedor, para que no se comprima.
    expect(google.getAttribute("aria-label")).toBe("Google — sin configurar");
    expect(google.textContent).toBe("Google");
    expect(google.getAttribute("title")).toMatch(/faltan Client ID \+ Secret/i);

    // Lo que no está activado se agrupa tras una línea, para que el formulario
    // no quede empujado fuera de pantalla por diecisiete botones muertos.
    expect(screen.queryByRole("button", { name: /GitHub/i })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Ver los 1 no activados/i }));

    const github = screen.getByRole("button", { name: /GitHub/i });
    expect(github).toHaveProperty("disabled", true);
    expect(github.getAttribute("aria-label")).toBe("GitHub — no activado");
    expect(github.textContent).toBe("GitHub");

    // Un proveedor listo sigue ofreciéndose: el aviso no puede desactivar todo.
    expect(screen.getByRole("button", { name: /Discord/i })).toHaveProperty("disabled", false);
  });

  it("al pasar a Código oculta la contraseña y, tras enviar, pide los 6 dígitos", async () => {
    const user = userEvent.setup();
    render(<AuthMethods />);

    await user.click(screen.getByRole("button", { name: "Código" }));

    expect(document.querySelector("#auth-password")).toBeNull();
    expect(document.querySelector("#auth-code")).toBeNull();

    await user.type(screen.getByLabelText(/email/i), "soberano@alienflow.space");
    await user.click(screen.getByRole("button", { name: /Enviar código/i }));

    await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalledTimes(1));
    expect(auth.signInWithOtp.mock.calls[0][0]).toMatchObject({ email: "soberano@alienflow.space" });

    const campoCodigo = await screen.findByLabelText(/código de 6 dígitos/i);
    expect(campoCodigo).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Código de 6 dígitos enviado"));
  });

  it("con el SMS sin proveedor traduce el error al panel donde se conecta", async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ error: new Error("Unable to get SMS provider") });
    const user = userEvent.setup();
    render(<AuthMethods />);

    await user.click(screen.getByRole("button", { name: "SMS" }));
    await user.type(screen.getByLabelText(/teléfono/i), "+51999888777");
    await user.click(screen.getByRole("button", { name: /Enviar código SMS/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Twilio")),
    );
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Authentication → Phone"));
    // El segundo paso no se abre si el envío falló.
    expect(document.querySelector("#auth-code")).toBeNull();
  });

  it("el acceso de respaldo manda un enlace por email sin tocar OAuth", async () => {
    const user = userEvent.setup();
    render(<AuthMethods />);

    // El respaldo está visible sin desplegar nada: el día que OAuth falla es
    // justo cuando no se puede buscar entre pestañas.
    await user.click(screen.getByRole("button", { name: /enlace por email/i }));

    // Cambia al modo enlace: ya no hay campo de contraseña.
    expect(document.querySelector("#auth-password")).toBeNull();
    await user.type(screen.getByLabelText(/email/i), "respaldo@alienflow.space");
    await user.click(screen.getByRole("button", { name: /Enviar enlace mágico/i }));

    await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalledTimes(1));
    expect(auth.signInWithOtp.mock.calls[0][0]).toMatchObject({
      email: "respaldo@alienflow.space",
      options: expect.objectContaining({ shouldCreateUser: true }),
    });
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();

    // Tarjeta de enviado con caducidad explícita y reenvío en cuenta atrás.
    const tarjeta = await screen.findByText(/Enlace enviado a/i);
    expect(tarjeta.textContent).toContain("Caduca en 1 hora");
    const reenviar = screen.getByRole("button", { name: /Reenviar en \d+s/i });
    expect(reenviar).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Usar otro email/i })).toHaveProperty("disabled", false);
  });

  it("traduce el límite de envíos de Supabase en vez de enseñar el texto crudo", async () => {
    auth.signInWithOtp.mockResolvedValueOnce({
      error: new Error("For security purposes, you can only request this after 47 seconds"),
    });
    const user = userEvent.setup();
    render(<AuthMethods />);

    await user.click(screen.getByRole("button", { name: /enlace por email/i }));
    await user.type(screen.getByLabelText(/email/i), "respaldo@alienflow.space");
    await user.click(screen.getByRole("button", { name: /Enviar enlace mágico/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining("espera un minuto")));
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Authentication → Rate Limits"));
    // Sin envío correcto no se abre la tarjeta de enviado: el formulario sigue ahí.
    expect(screen.queryByText(/Enlace enviado a/i)).toBeNull();
  });

  it("una passkey sin configurar explica en qué panel se activa", async () => {
    auth.signInWithPasskey.mockResolvedValueOnce({
      error: new Error("passkey authentication is not enabled"),
    });
    const user = userEvent.setup();
    render(<AuthMethods />);

    await user.click(screen.getByRole("button", { name: /Entrar con Passkey/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Passkeys sin configurar")));
  });

  it("la barra de sesión lista las identidades realmente enlazadas", async () => {
    auth.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "tok",
          user: {
            id: "user-1",
            email: "soberano@alienflow.space",
            identities: [
              { id: "i1", user_id: "user-1", identity_id: "i1", provider: "email" },
              { id: "i2", user_id: "user-1", identity_id: "i2", provider: "siwe" },
            ],
          },
        },
      },
    });

    render(<AuthMethods />);

    const email = await screen.findByTitle("Identidad enlazada: email");
    expect(email).toBeTruthy();
    expect(screen.getByTitle("Identidad enlazada: siwe").textContent).toBe("wallet");
    // En la sesión no se ofrecen de nuevo los métodos de entrada.
    expect(document.querySelector("#auth-password")).toBeNull();
  });
});
