/**
 * Cloudflare Turnstile, used as the CAPTCHA that Supabase verifies on the
 * flows that cost money to serve: sign-up and every OTP send (email or SMS).
 *
 * The site key is public and comes from `VITE_TURNSTILE_SITEKEY`; the secret
 * half lives in Supabase → Settings → Captcha. While the variable is missing
 * `turnstileToken()` resolves to null, every caller omits the token and the
 * auth calls behave exactly as before, so turning the widget on is a panel
 * change plus one environment variable — no deploy of new logic required.
 *
 * One widget is rendered off-screen and reused: each call resets it and waits
 * for the fresh token, because Turnstile tokens are single-use.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CONTAINER_ID = "aitor-turnstile";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<void> | null = null;
let widgetId: string | null = null;
let waiting: ((token: string | null) => void) | null = null;

function siteKey(): string | null {
  const key = (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined)?.trim();
  return key || null;
}

/** True when the project has a site key and a DOM to render into. */
export function turnstileEnabled(): boolean {
  return siteKey() !== null && typeof document !== "undefined";
}

function loadScript(): Promise<void> {
  if (typeof window !== "undefined" && window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("no se pudo cargar Turnstile"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

const settle = (token: string | null) => {
  const resolve = waiting;
  waiting = null;
  resolve?.(token);
};

/**
 * Resolves with a fresh single-use token, or `null` when Turnstile is not
 * configured or cannot be loaded — in that case the request still goes out,
 * and Supabase's own rate limits keep applying.
 */
export async function turnstileToken(): Promise<string | null> {
  const key = siteKey();
  if (!key || typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    await loadScript();
  } catch {
    return null;
  }

  const turnstile = window.turnstile;
  if (!turnstile) return null;

  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = "position:fixed;left:-9999px;width:0;height:0;overflow:hidden;";
    document.body.appendChild(container);
  }

  if (!widgetId) {
    widgetId = turnstile.render(container, {
      sitekey: key,
      action: "auth",
      size: "invisible",
      callback: (token: string) => {
        settle(token);
        // Un token sirve una sola vez: se limpia para el siguiente envío.
        window.setTimeout(() => {
          try {
            window.turnstile?.reset(widgetId ?? undefined);
          } catch {
            // Ya limpio o el widget desapareció; el siguiente intento lo recrea.
          }
        }, 0);
      },
      "error-callback": () => settle(null),
      "expired-callback": () => settle(null),
    });
  } else {
    try {
      turnstile.reset(widgetId);
    } catch {
      widgetId = null;
      return turnstileToken();
    }
  }

  // Si una petición anterior seguía esperando, no se queda colgada.
  waiting?.(null);

  return new Promise<string | null>((resolve) => {
    waiting = resolve;
  });
}
