import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-ts";
const RELOAD_WINDOW_MS = 30_000;

/**
 * Recarga la página una sola vez por ventana de tiempo.
 *
 * Devuelve `false` cuando ya se recargó hace menos de 30 s: sin ese freno, un
 * chunk que de verdad no existe produciría un bucle de recargas, que es peor
 * que el propio error.
 *
 * Lo comparten el `lazy` de abajo y el aviso global `vite:preloadError`, para
 * que dos mecanismos no se pisen y recarguen dos veces seguidas.
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sin `sessionStorage` (modo privado, storage bloqueado): se intenta igual,
    // aunque no se pueda recordar el intento.
  }
  window.location.reload();
  return true;
}

/**
 * React.lazy with resilience against stale/missing chunks after a redeploy.
 * Retries once, then forces a single full reload to fetch the new manifest.
 * The component type is inferred as-is, so callers keep their exact props.
 */
export function lazyWithRetry<C extends ComponentType<never>>(
  factory: () => Promise<{ default: C }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        // Nothing to clean up when storage is blocked.
      }
      return mod;
    } catch {
      // one retry (transient network)
      try {
        return await factory();
      } catch (err2) {
        if (reloadOnceForStaleChunk()) {
          // never resolves; page is reloading
          return await new Promise<{ default: C }>(() => {});
        }
        throw err2;
      }
    }
  });
}
