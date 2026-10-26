/**
 * Estado semanal de las cámaras, leído de `live-status.generated.ts`.
 *
 * `liveAtBuild` es una foto del día en que se curó la lista; esto es la
 * reverificación automática que la sustituye cuando existe. Si una sonda no
 * pudo determinar nada (`live: null`) se mantiene la foto original: no se
 * declara muerta una cámara por un fallo de red del runner.
 */

import { LIVE_STATUS, LIVE_STATUS_CHECKED_ON } from "./live-status.generated";
import type { LiveSignal } from "./live-signals";

export type SignalLiveState = "live" | "offline" | "unknown";

export function signalLiveState(signal: Pick<LiveSignal, "id">): SignalLiveState {
  const entry = LIVE_STATUS[signal.id];
  if (!entry || entry.live === null) return "unknown";
  return entry.live ? "live" : "offline";
}

/** ¿Cuenta como cámara emitiendo? La reverificación manda cuando existe. */
export function isSignalLive(signal: Pick<LiveSignal, "id" | "liveAtBuild">): boolean {
  const state = signalLiveState(signal);
  if (state === "live") return true;
  if (state === "offline") return false;
  return signal.liveAtBuild;
}

/** `null` cuando aún no se ha ejecutado la verificación semanal. */
export function lastLiveCheck(): string | null {
  return LIVE_STATUS_CHECKED_ON || null;
}

export { LIVE_STATUS, LIVE_STATUS_CHECKED_ON };
