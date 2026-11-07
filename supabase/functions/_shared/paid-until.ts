/**
 * Hasta cuándo vale un plan pagado.
 *
 * Vive en `_shared` porque lo usa `verify-crypto-payment` al confirmar el cobro
 * on-chain, y es TypeScript sin APIs de Deno a propósito: así la prueba corre en
 * Vitest con el resto del proyecto en vez de quedarse sin cubrir por estar en
 * una Edge Function.
 *
 * La regla: si el plan actual aún no ha vencido, el periodo nuevo se suma a lo
 * que quedaba (renovar antes de tiempo no regala ni pierde días); si ya venció o
 * no había fecha, se cuenta desde ahora. El plan vencido no se hereda: pagar
 * una mensualidad después de tres meses de inactividad da un mes, no cuatro.
 */
export const PERIOD_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

const DAY_MS = 86_400_000;

/** Fecha ISO en la que caducará el plan tras añadir `days` días. */
export function extendPaidUntil(
  current: string | Date | null | undefined,
  days: number,
  now: Date | number = Date.now(),
): string {
  const reference = now instanceof Date ? now.getTime() : now;
  let currentMs: number | null = null;
  if (current instanceof Date) currentMs = current.getTime();
  else if (typeof current === "string" && current.trim()) {
    const parsed = Date.parse(current);
    if (Number.isFinite(parsed)) currentMs = parsed;
  }

  const base = currentMs !== null && currentMs > reference ? currentMs : reference;
  return new Date(base + days * DAY_MS).toISOString();
}
