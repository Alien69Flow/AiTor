import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Single source of truth for the workspace (top-level section) identifiers.
 * Kept outside `pages/Index` so navigation, the palette and the deep-link hook
 * can share the type without importing the page (and its lazy chunks).
 */
export const WORKSPACE_TABS = ["agents", "alien", "cosmos", "globe", "markets", "system"] as const;

export type TabId = (typeof WORKSPACE_TABS)[number];

export const DEFAULT_TAB: TabId = "agents";

export function isTabId(value: string | null | undefined): value is TabId {
  return !!value && (WORKSPACE_TABS as readonly string[]).includes(value);
}

/**
 * Workspace state mirrored into `?tab=`, so a refresh keeps the operator on the
 * same module, deep links work (`/?tab=markets`), and back/forward move between
 * sections instead of leaving the app. The default workspace stays clean at `/`.
 */
/**
 * Cámara concreta que debe abrir la pestaña Alien. El globo sitúa las cámaras
 * del monitor, así que al pulsar una necesita cruzar de módulo y decir cuál:
 * viaja en la URL para que el enlace se pueda copiar y sobreviva a un refresco.
 */
export const CAMERA_PARAM = "cam";

/**
 * Tercer valor: abrir una cámara del Alien desde otro módulo. Hace los dos
 * cambios en **una sola** navegación —pestaña y cámara—, porque dos llamadas
 * seguidas a `setSearchParams` pueden pisarse y dejar la pestaña sin cámara (o
 * la cámara sin pestaña).
 */
/**
 * Cámara concreta que la pestaña Alien debe abrir, leída de la URL.
 *
 * La lee la página y la pasa como prop: así el monitor UAP no depende del
 * router para nada y se puede montar en una prueba sin envolverlo en uno.
 */
export function useCameraTarget(): string | null {
  const [searchParams] = useSearchParams();
  return searchParams.get(CAMERA_PARAM);
}

export function useWorkspaceTab(): readonly [TabId, (tab: TabId) => void, (cameraId: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("tab");
  const tab = useMemo<TabId>(() => (isTabId(requested) ? requested : DEFAULT_TAB), [requested]);

  const setTab = useCallback(
    (next: TabId) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const current = params.get("tab");
          // Cambiar de módulo a mano descarta la cámara apuntada: si no, volver
          // a Alien reabriría la última cámara pulsada en el globo.
          params.delete(CAMERA_PARAM);
          // No-op selections must not push duplicate history entries; an invalid
          // value still gets normalised (or dropped for the default workspace).
          if (next === DEFAULT_TAB) {
            if (current === null) return prev;
            params.delete("tab");
            return params;
          }
          if (current === next) return prev;
          params.set("tab", next);
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const openCamera = useCallback(
    (cameraId: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("tab", "alien");
          params.set(CAMERA_PARAM, cameraId);
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  return [tab, setTab, openCamera] as const;
}
