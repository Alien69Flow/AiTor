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
 *  - con `paid_tier` conocido → ese plan, si es uno de los de la escalera;
 *  - con `paid_until` ya pasada → vuelve al mínimo de la sesión, aunque
 *    `paid_tier` siga diciendo lo contrario: el plan de pago caduca.
 *
 * Un fallo de lectura nunca puede degradar a un usuario con sesión: a lo sumo
 * deja de reconocerle un plan de pago, que es un error visible y reparable, no
 * una pared invisible. Por eso una fecha ilegible **no** caduca el plan: la
 * escribe el servidor y, si llegara corrupta, es preferible seguir dando el
 * acceso que se pagó a inventar un vencimiento.
 */
import { TIER_RANK, type Tier } from "./globe-layers";

/** Plan mínimo de una cuenta registrada. */
export const REGISTERED_TIER: Tier = "node";

/** Días de antelación con los que se avisa de la renovación. */
export const RENEWAL_WARNING_DAYS = 7;

const DAY_MS = 86_400_000;

/** Nivel de pago guardado en la base → escalera del producto. */
export const PAID_TIER_TO_PLAN: Record<string, Tier> = {
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
  /** `user_credits.paid_until`, tal cual viene de la base. */
  paidUntil?: string | Date | null;
  /** Reloj inyectable: las pruebas no dependen de la hora de la máquina. */
  now?: Date | number;
}

function toMs(now: Date | number | undefined): number {
  if (now === undefined) return Date.now();
  return now instanceof Date ? now.getTime() : now;
}

/**
 * `paid_until` en milisegundos, o `null` si no hay fecha utilizable (sin
 * caducidad o valor corrupto, que se tratan igual a propósito).
 */
export function paidUntilMs(paidUntil?: string | Date | null): number | null {
  if (!paidUntil) return null;
  const ms = paidUntil instanceof Date ? paidUntil.getTime() : Date.parse(paidUntil);
  return Number.isFinite(ms) ? ms : null;
}

/** Plan efectivo. Nunca devuelve uno inferior a Node si hay sesión. */
export function resolveTier({ authed, paidTier, paidUntil, now }: TierInput): Tier {
  if (!authed) return "signal";
  const mapped = paidTier ? PAID_TIER_TO_PLAN[paidTier] : undefined;
  if (!mapped || TIER_RANK[mapped] < TIER_RANK[REGISTERED_TIER]) return REGISTERED_TIER;

  const until = paidUntilMs(paidUntil);
  if (until !== null && until <= toMs(now)) return REGISTERED_TIER;
  return mapped;
}

export interface PlanExpiry {
  /** Fecha de vencimiento legible, o `null` si el plan no caduca. */
  expiresAt: Date | null;
  /** Días completos que faltan; negativo una vez vencido, `null` sin fecha. */
  daysLeft: number | null;
  expired: boolean;
  /** Dentro de la ventana de aviso y aún con acceso. */
  expiringSoon: boolean;
}

/**
 * Estado de caducidad de un plan de pago, para el aviso de renovación.
 * Devuelve `expired: false` y `expiringSoon: false` cuando no hay fecha.
 */
export function readPlanExpiry({
  paidUntil,
  now,
  warningDays = RENEWAL_WARNING_DAYS,
}: {
  paidUntil?: string | Date | null;
  now?: Date | number;
  warningDays?: number;
}): PlanExpiry {
  const until = paidUntilMs(paidUntil);
  if (until === null) {
    return { expiresAt: null, daysLeft: null, expired: false, expiringSoon: false };
  }
  const reference = toMs(now);
  const daysLeft = Math.ceil((until - reference) / DAY_MS);
  const expired = until <= reference;
  return {
    expiresAt: new Date(until),
    daysLeft,
    expired,
    expiringSoon: !expired && daysLeft <= warningDays,
  };
}
