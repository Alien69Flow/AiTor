/**
 * Shared plumbing for the real-time public data connectors used by the globe.
 *
 * Every connector:
 *  - aborts on timeout (no hanging sockets, no GPU stalls waiting on data)
 *  - fails silently (a dead endpoint never blocks the other layers)
 *  - polls with a deferred schedule (idle callback) so the main thread stays free
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface ConnectorState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => void;
}

export interface LayerStatus {
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  count: number;
}

export async function safeFetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; init?: RequestInit; signal?: AbortSignal } = {},
): Promise<T> {
  const { timeoutMs = 9000, init, signal } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function safeFetchText(
  url: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const { timeoutMs = 9000, signal } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Runs `cb` when the browser is idle (falls back to a macrotask). */
function whenIdle(cb: () => void): () => void {
  const ric = (window as any).requestIdleCallback as
    | ((c: () => void, o?: { timeout: number }) => number)
    | undefined;
  if (ric) {
    const id = ric(cb, { timeout: 2000 });
    return () => (window as any).cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 0);
  return () => clearTimeout(id);
}

/**
 * Generic deferred-polling connector hook with independent loading/error state.
 * The fetcher must reject on failure; the previous payload is retained so the
 * layer keeps rendering stale-but-valid data instead of flickering to empty.
 */
export function usePolledConnector<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  intervalMs: number,
  enabled = true,
): ConnectorState<T> {
  const [state, setState] = useState<{
    data: T;
    loading: boolean;
    error: string | null;
    lastUpdate: Date | null;
  }>({ data: fallback, loading: enabled, error: null, lastUpdate: null });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inFlight = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetcherRef.current(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setState({ data, loading: false, error: null, lastUpdate: new Date() });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      // Silent failure: keep prior data, expose the error on this layer only.
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "connector error",
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      inFlight.current?.abort();
      setState({ data: fallback, loading: false, error: null, lastUpdate: null });
      return;
    }
    const cancelIdle = whenIdle(() => void run());
    const id = window.setInterval(() => void run(), intervalMs);
    return () => {
      cancelIdle();
      clearInterval(id);
      inFlight.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, run]);

  return { ...state, refresh: run };
}

export function toStatus(s: { loading: boolean; error: string | null; lastUpdate: Date | null }, count: number): LayerStatus {
  return { loading: s.loading, error: s.error, lastUpdate: s.lastUpdate, count };
}
