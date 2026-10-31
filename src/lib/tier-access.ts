/**
 * Qué plan tiene de verdad quien está mirando el globo.
 *
 * El panel de capas decidía esto dentro del hook, y con un fallo silencioso: si
 * la consulta de `user_credits` rechazaba (RLS recién migrado, tabla ausente,
 * red caída), la promesa moría sin `catch`, el estado se quedaba en `loading`
 * para siempre y las capas de Node aparecían bloqueadas para una cuenta
 * registrada. El usuario lo leía como «no me deja activar sin nivel».
 *
 * La regla, separada del hook para poder probarla:
 *
 *  - sin sesión → `signal` (lo público);
 *  - con sesión → como mínimo `node`, pase lo que pase con la consulta;
 *  - con `paid_tier` conocido → ese plan, si es uno de los de la escalera.
 *
 * Un fallo de lectura nunca puede degradar a un usuario con sesión: a lo sumo
 * deja de reconocerle un plan de pago, que es un error visible y reparable, no
 * una pared invisible.
 */
import { TIER_RANK, type Tier } from "./globe-layers";

/** Plan mínimo de una cuenta registrada. */
export const REGISTERED_TIER: Tier = "node";

const DB_TO_TIER: Record<string, Tier> = {
  registered: "node",
  basic: "synapse",
  pro: "oracle",
  quantum: "quantum",
};

export interface TierInput {
  /** Hay sesión válida en el proyecto de identidad. */
  authed: boolean;
  /** `user_credits.paid_tier`, tal cual viene de la base. */
  paidTier?: string | null;
}

/** Plan efectivo. Nunca devuelve uno inferior a Node si hay sesión. */
export function resolveTier({ authed, paidTier }: TierInput): Tier {
  if (!authed) return "signal";
  const mapped = paidTier ? DB_TO_TIER[paidTier] : undefined;
  if (mapped && TIER_RANK[mapped] >= TIER_RANK[REGISTERED_TIER]) return mapped;
  return REGISTERED_TIER;
}
