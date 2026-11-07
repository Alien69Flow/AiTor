import { CalendarClock, CircleAlert } from "lucide-react";
import { useTier } from "@/hooks/useTier";
import { PAID_TIER_TO_PLAN } from "@/lib/tier-access";
import { PLAN_BY_ID } from "@/lib/tiers";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

/**
 * Aviso de renovación del plan de pago.
 *
 * Sólo aparece cuando hay una fecha de vencimiento cerca o ya pasada: una
 * cuenta gratuita no tiene nada que renovar y una suscripción sin `paid_until`
 * (filas anteriores, acceso vitalicio) tampoco. Con el plan vencido el tier ya
 * es Node —lo resuelve `resolveTier`—, así que aquí se nombra el plan que
 * caducó leyendo el valor crudo de la base, no el tier efectivo.
 */
export function PlanRenewalNotice({ onRenew }: { onRenew: () => void }) {
  const { authed, tier, paidTier, expiry } = useTier();

  if (!authed || !expiry.expiresAt) return null;
  if (!expiry.expired && !expiry.expiringSoon) return null;

  const paidPlan = paidTier ? PLAN_BY_ID[PAID_TIER_TO_PLAN[paidTier]] : undefined;
  const planName = (paidPlan ?? PLAN_BY_ID[tier]).name;
  const date = expiry.expiresAt.toLocaleDateString("es-ES", DATE_FORMAT);

  if (expiry.expired) {
    return (
      <div
        role="status"
        className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2"
      >
        <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1 font-mono text-[10px] leading-relaxed text-foreground/80">
          Tu plan <strong className="text-foreground">{planName}</strong> venció el {date}. La
          cuenta funciona con el nivel Node hasta que lo renueves.
        </p>
        <button
          type="button"
          onClick={onRenew}
          className="rounded border border-destructive/50 bg-destructive/10 px-2 py-1 font-mono text-[10px] text-destructive transition-colors hover:bg-destructive/20"
        >
          Reactivar
        </button>
      </div>
    );
  }

  const days = expiry.daysLeft ?? 0;
  return (
    <div
      role="status"
      className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2"
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 font-mono text-[10px] leading-relaxed text-foreground/80">
        Tu plan <strong className="text-foreground">{planName}</strong> caduca{" "}
        {days === 0 ? "hoy" : `en ${days} ${days === 1 ? "día" : "días"}`} ({date}). Sin renovación,
        la cuenta vuelve a Node.
      </p>
      <button
        type="button"
        onClick={onRenew}
        className="rounded border border-accent/50 bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20"
      >
        Renovar
      </button>
    </div>
  );
}
