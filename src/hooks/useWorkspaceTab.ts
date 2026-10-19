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
export function useWorkspaceTab(): readonly [TabId, (tab: TabId) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("tab");
  const tab = useMemo<TabId>(() => (isTabId(requested) ? requested : DEFAULT_TAB), [requested]);

  const setTab = useCallback(
    (next: TabId) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const current = params.get("tab");
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

  return [tab, setTab] as const;
}
