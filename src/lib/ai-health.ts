/**
 * Qué oráculos pueden contestar de verdad.
 *
 * El catálogo (`ai-models.ts`) declaraba `available: true` por diseño, no por
 * evidencia: un modelo sin clave seguía apareciendo vivo y fallaba al elegirlo.
 * La función `chat` publica ahora `?health=1` con el estado de cada proveedor
 * (solo si la clave existe y si parece real, nunca su valor) y aquí se cruza con
 * el catálogo para desactivar —no esconder— lo que no tiene credencial.
 *
 * Cuando el informe no se puede leer, no se desactiva nada: una red caída no
 * debe dejar el selector sin modelos. En ese caso se cae al `available` estático
 * y la UI lo marca como "sin verificar".
 */
import { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import type { AIModel } from "./ai-models";

export type ChatProviderId = "lovable" | "xai" | "anthropic" | "deepseek";
export type ChatKeyState = "ok" | "missing" | "placeholder";
export type ModelSignal = "ready" | "missing-key" | "placeholder-key" | "no-route";

export interface ChatProviderHealth {
  id: ChatProviderId;
  label: string;
  envVar: string;
  where: string;
  keyState: ChatKeyState;
  configured: boolean;
  models: string[];
}

export interface ChatModelHealth {
  id: string;
  provider: ChatProviderId;
  available: boolean;
  reason: Exclude<ModelSignal, "no-route">;
}

export interface ChatHealth {
  service: "chat";
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  providers: ChatProviderHealth[];
  models: ChatModelHealth[];
  defaultModel: string;
  fallbackModel: string;
}

export interface ResolvedOracle {
  model: AIModel;
  availability: ModelSignal;
  /** `true` solo cuando un modelo de este catálogo puede contestar. */
  available: boolean;
  /** Etiqueta del proveedor según el informe (o la del catálogo). */
  providerLabel: string;
  /** Variable de entorno que falta, cuando el problema es una credencial. */
  envVar: string | null;
  /** Dónde se rellena, para que el aviso sea accionable. */
  where: string | null;
}

export const AVAILABILITY_LABEL: Record<ModelSignal, string> = {
  ready: "listo",
  "missing-key": "sin clave",
  "placeholder-key": "clave inválida",
  "no-route": "próximamente",
};

export function availabilityHint(oracle: ResolvedOracle): string {
  switch (oracle.availability) {
    case "ready":
      return `Clave configurada (${oracle.envVar ?? "servidor"})`;
    case "missing-key":
      return `Falta ${oracle.envVar ?? "la clave del proveedor"} · ${oracle.where ?? "secrets del proyecto"}`;
    case "placeholder-key":
      return `${oracle.envVar ?? "La clave"} existe pero no parece válida · ${oracle.where ?? "secrets del proyecto"}`;
    default:
      return "Sin ruta en la función chat: todavía no se puede seleccionar";
  }
}

/**
 * Cruza el catálogo con el informe de salud. Los modelos que el servidor no
 * menciona no están enrutados (ChainGPT, Chainlink): se quedan como
 * "próximamente" en vez de desaparecer.
 */
export function resolveOracles(models: readonly AIModel[], health: ChatHealth | null): ResolvedOracle[] {
  return models.map((model) => {
    const base = {
      model,
      providerLabel: model.provider,
      envVar: null as string | null,
      where: null as string | null,
    };

    if (!health) {
      return {
        ...base,
        availability: (model.available ? "ready" : "no-route") as ModelSignal,
        available: model.available,
      };
    }

    const entry = health.models.find((candidate) => candidate.id === model.id);
    if (!entry) {
      return { ...base, availability: "no-route", available: false };
    }

    const provider = health.providers.find((candidate) => candidate.id === entry.provider);
    return {
      model,
      availability: entry.reason,
      available: entry.available,
      providerLabel: provider?.label ?? model.provider,
      envVar: provider?.envVar ?? null,
      where: provider?.where ?? null,
    };
  });
}

const HEALTH_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60_000;

let cache: { at: number; health: ChatHealth } | null = null;
let inflight: Promise<ChatHealth | null> | null = null;

function isChatHealth(value: unknown): value is ChatHealth {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<ChatHealth>;
  return (
    (body.status === "ok" || body.status === "degraded" || body.status === "down") &&
    Array.isArray(body.providers) &&
    Array.isArray(body.models)
  );
}

/**
 * Último informe conocido y todavía fresco, sin red. El envío del chat lo usa
 * para sustituir un modelo muerto sin añadir latencia a la primera respuesta.
 */
export function peekChatHealth(): ChatHealth | null {
  if (!cache) return null;
  return Date.now() - cache.at < CACHE_TTL_MS ? cache.health : null;
}

export async function loadChatHealth(force = false): Promise<ChatHealth | null> {
  if (!force && peekChatHealth()) return cache!.health;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat?health=1`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!isChatHealth(body)) return null;
      cache = { at: Date.now(), health: body };
      return body;
    } catch {
      // Backend pausado o sin red: se informa "sin verificar", no se desactiva.
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Test seam y botón de reintento del selector. */
export function resetChatHealthCache(): void {
  cache = null;
  inflight = null;
}

export interface ChatHealthState {
  health: ChatHealth | null;
  /** `true` cuando ya llegó una respuesta (aunque fuese `null`). */
  checked: boolean;
  loading: boolean;
  refresh: () => void;
}

export function useChatHealth(): ChatHealthState {
  const [state, setState] = useState<{ health: ChatHealth | null; checked: boolean; loading: boolean }>(() => ({
    health: peekChatHealth(),
    checked: peekChatHealth() !== null,
    loading: false,
  }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    void loadChatHealth(nonce > 0).then((health) => {
      if (active) setState({ health, checked: true, loading: false });
    });
    return () => {
      active = false;
    };
  }, [nonce]);

  const refresh = () => {
    resetChatHealthCache();
    setNonce((value) => value + 1);
  };

  return { ...state, refresh };
}
