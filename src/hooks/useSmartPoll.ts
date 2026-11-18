/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * `useSmartPoll` — sondeo adaptativo para datos en vivo.
 *
 * Hoy los hooks usan `setInterval(fetch, 120000)` a pelo. Eso tiene tres
 * problemas medibles:
 *
 *  1. Sin jitter, 1.000 pestañas disparan en el mismo segundo (estampida
 *     contra la fuente y contra tu propio `/api/*`).
 *  2. Con la pestaña en segundo plano sigue sondeando: batería y cuota.
 *  3. Sin backoff, una fuente caída recibe el mismo ritmo de golpes que una
 *     sana y no se recupera sola.
 *
 * Si además quieres caché de servidor y deduplicación entre componentes,
 * colócalo sobre TanStack Query (ya está en package.json):
 *
 *   const { data } = useQuery({
 *     queryKey: ["air-traffic"],
 *     queryFn: ({ signal }) => fetchAirTraffic(signal),
 *     refetchInterval: 120_000,
 *     refetchIntervalInBackground: false,
 *     staleTime: 60_000,
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface SmartPollOptions {
  /** Intervalo objetivo en ms. */
  intervalMs: number;
  enabled?: boolean;
  /** Pausa cuando la pestaña está oculta (por defecto true). */
  pauseWhenHidden?: boolean;
  /** Refresca al volver a la pestaña si el último dato tiene más de intervalMs. */
  refreshOnVisible?: boolean;
  /** Multiplicador máximo del backoff (por defecto 4). */
  maxBackoffMultiplier?: number;
  /** Fracción de jitter (0.1 = ±10%). */
  jitterFraction?: number;
  /** Timeout por petición. Debe ser menor que el lease del intervalo. */
  timeoutMs?: number;
  runImmediately?: boolean;
  onError?: (error: unknown) => void;
}

export interface SmartPollState<T> {
  data: T | null;
  error: string | null;
  /** epoch ms del último éxito. */
  updatedAt: number | null;
  isLoading: boolean;
  refresh: () => void;
}

/** Un solo listener de visibilidad para todos los hooks montados. */
const visibilitySubscribers = new Set<() => void>();
let visibilityBound = false;

function subscribeVisibility(listener: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  if (!visibilityBound) {
    document.addEventListener("visibilitychange", () => {
      for (const subscriber of visibilitySubscribers) subscriber();
    });
    visibilityBound = true;
  }
  visibilitySubscribers.add(listener);
  return () => {
    visibilitySubscribers.delete(listener);
  };
}

function jitter(intervalMs: number, fraction: number): number {
  const delta = intervalMs * fraction;
  return Math.max(1_000, Math.round(intervalMs - delta + Math.random() * delta * 2));
}

export function useSmartPoll<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: SmartPollOptions,
): SmartPollState<T> {
  const {
    intervalMs,
    enabled = true,
    pauseWhenHidden = true,
    refreshOnVisible = true,
    maxBackoffMultiplier = 4,
    jitterFraction = 0.1,
    timeoutMs = Math.min(intervalMs, 20_000),
    runImmediately = true,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const updatedAtRef = useRef<number | null>(null);
  const runCycleRef = useRef<() => void>(() => {});

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const runCycle = useCallback(async () => {
    clearTimer();
    if (!mountedRef.current) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    setIsLoading(true);
    try {
      const result = await fetcherRef.current(controller.signal);
      if (!mountedRef.current) return;
      failuresRef.current = 0;
      setData(result);
      setError(null);
      const now = Date.now();
      setUpdatedAt(now);
      updatedAtRef.current = now;
    } catch (caught) {
      if (!mountedRef.current) return;
      failuresRef.current = Math.min(failuresRef.current + 1, 6);
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      onErrorRef.current?.(caught);
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current) setIsLoading(false);
    }

    if (!mountedRef.current) return;

    const hidden = pauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden) return; // al volver, visibilitychange reprograma

    const backoff = Math.min(2 ** failuresRef.current, maxBackoffMultiplier);
    timerRef.current = setTimeout(runCycleRef.current, jitter(intervalMs * backoff, jitterFraction));
  }, [intervalMs, jitterFraction, maxBackoffMultiplier, pauseWhenHidden, timeoutMs]);

  runCycleRef.current = runCycle;

  // Ciclo principal
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      clearTimer();
      return;
    }
    if (runImmediately) {
      void runCycle();
    } else {
      timerRef.current = setTimeout(runCycleRef.current, jitter(intervalMs, jitterFraction));
    }
    return () => {
      clearTimer();
      controllerRef.current?.abort();
    };
  }, [enabled, intervalMs, jitterFraction, runImmediately, runCycle]);

  // Visibilidad
  useEffect(() => {
    if (!enabled) return;
    return subscribeVisibility(() => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        clearTimer();
        return;
      }
      if (!refreshOnVisible) return;
      const last = updatedAtRef.current;
      if (last === null || Date.now() - last >= intervalMs) void runCycleRef.current();
    });
  }, [enabled, intervalMs, refreshOnVisible]);

  // Desmontaje
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      controllerRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(() => {
    void runCycleRef.current();
  }, []);

  return { data, error, updatedAt, isLoading, refresh };
}
