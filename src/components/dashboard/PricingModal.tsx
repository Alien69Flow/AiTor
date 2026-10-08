import { X, Wallet, Loader as Loader2, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useCryptoCheckout } from "@/hooks/useCryptoCheckout";
import { useDaoAccess } from "@/hooks/useDaoAccess";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/tiers";
import { TIER_RANK, type Tier } from "@/lib/globe-layers";
import {
  BILLING_CYCLES,
  PAYMENT_DOMAIN,
  PAY_CHAINS,
  type BillingCycle,
  type PayChain,
  type PayToken,
} from "@/lib/web3/payments";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
  currentTier?: Tier;
}

const TOKENS: PayToken[] = ["USDC", "USDT"];

export function PricingModal({ open, onClose, reason, currentTier = "signal" }: PricingModalProps) {
  const [chain, setChain] = useState<PayChain>("base");
  const [token, setToken] = useState<PayToken>("USDC");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { pay, stage, message, txHash, reset, isConnected, address } = useCryptoCheckout();
  const { verify, busy: verifying, result, error: holdingsError } = useDaoAccess();
  const { signIn: walletSignIn, busy: walletBusy } = useWalletAuth();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  if (!open) return null;

  const busy = stage === "resolving" || stage === "signing" || stage === "verifying";
  const statusText = holdingsError ?? (result ? result.message : message);
  const statusError = stage === "error" || !!holdingsError;
  const statusOk = stage === "done" || (!!result && !!result.tier);

  const handleAction = async (plan: Tier) => {
    if (plan === "signal") return;
    if (plan === "node") {
      if (user) return;
      await walletSignIn();
      return;
    }
    if (plan === "synapse") {
      if (!user) {
        const signedIn = await walletSignIn();
        if (!signedIn) return;
      }
      await pay(cycle, chain, token);
      return;
    }
    if (!user) {
      const signedIn = await walletSignIn();
      if (!signedIn) return;
    }
    await verify();
  };

  const actionLabel = (plan: Tier) => {
    if (plan === currentTier) return "Plan actual";
    if (plan === "signal") return "Siempre activo";
    if (plan === "node") return user ? "Activo" : "Entrar";
    if (plan === "synapse") return `Pagar ${BILLING_CYCLES[cycle].price} ${token}`;
    return "Verificar holdings";
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 p-2 backdrop-blur-md sm:p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[calc(100dvh-16px)] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-primary/35 bg-card/95 shadow-[0_0_70px_hsl(var(--primary)/0.18)] sm:max-h-[calc(100dvh-32px)]"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Nasalization', monospace" }}
      >
        <div className="shrink-0 border-b border-border/70 bg-background/75 px-3 py-3 pr-12 backdrop-blur-xl sm:px-5">
          <div className="text-[9px] uppercase text-primary">Sovereign Nexus · Access Tiers</div>
          <h2 className="mt-0.5 text-lg font-bold text-foreground sm:text-2xl">Los 5 niveles del Oráculo</h2>
          {reason && <p className="mt-1 text-[10px] text-muted-foreground">{reason}</p>}
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-2 top-2 h-9 w-9 rounded-sm text-muted-foreground" aria-label="Cerrar"><X className="h-5 w-5" /></Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">

        {/* Payment rail */}
        <div className="mb-4 grid gap-3 border border-border/60 bg-background/50 p-3 text-[10px] md:grid-cols-[1fr_auto_auto]">
          <Segment label="Periodo" options={(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((k) => ({
            key: k, label: `${BILLING_CYCLES[k].label} · ${BILLING_CYCLES[k].price}`,
          }))} value={cycle} onChange={(v) => setCycle(v as BillingCycle)} />
          <Segment label="Red" options={(Object.keys(PAY_CHAINS) as PayChain[]).map((k) => ({ key: k, label: PAY_CHAINS[k].label }))}
            value={chain} onChange={(v) => setChain(v as PayChain)} />
          <Segment label="Moneda" options={TOKENS.map((t) => ({ key: t, label: t }))} value={token} onChange={(v) => setToken(v as PayToken)} />
          <span className="flex items-center gap-1 px-1 text-muted-foreground md:col-span-3">
            <Wallet className="w-3 h-3" />
            {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "wallet sin conectar"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANS.map((plan) => {
            const active = plan.id === currentTier || TIER_RANK[currentTier] > TIER_RANK[plan.id];
            return (
              <div
                key={plan.id}
                className={`relative flex min-h-[292px] flex-col rounded-sm border bg-background/35 p-4 transition-all hover:-translate-y-0.5 ${
                  plan.highlight ? "border-accent/55 shadow-[0_0_28px_hsl(var(--accent)/0.14)]" : "border-border/70"
                }`}
              >
                {plan.id === currentTier && (
                  <span className="absolute -top-2.5 right-3 bg-primary px-2 py-0.5 text-[8px] font-bold uppercase text-primary-foreground">Activo</span>
                )}
                {plan.highlight && plan.id !== currentTier && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent px-2 py-0.5 text-[8px] font-bold uppercase text-accent-foreground">Popular</span>
                )}
                <plan.Icon className="w-5 h-5 mb-2" style={{ color: plan.accent }} />
                <div className="text-[10px] uppercase text-muted-foreground">{plan.name}</div>
                <div className="text-base md:text-lg font-bold mt-1 leading-tight" style={{ color: plan.accent }}>
                  {plan.id === "synapse" ? `${BILLING_CYCLES[cycle].price} ${token} / ${BILLING_CYCLES[cycle].label.toLowerCase()}` : plan.price}
                </div>
                {plan.priceNote && <div className="mt-0.5 text-[9px] text-muted-foreground/70">{plan.priceNote}</div>}
                <p className="mt-2 text-[10px] text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-3 flex-1 space-y-1 text-[10px] text-foreground/75">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span style={{ color: plan.accent }} className="mt-[1px]">▸</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || verifying || walletBusy || active}
                  onClick={() => handleAction(plan.id)}
                  className={`mt-4 w-full rounded-sm text-[9px] font-bold uppercase transition-all ${
                    active || busy || verifying
                      ? "cursor-default border-border bg-muted/20 text-muted-foreground"
                      : "border-primary/35 bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {(busy && plan.id === "synapse") || (verifying && (plan.id === "oracle" || plan.id === "quantum")) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : plan.access === "nft" || plan.access === "nft+tokens" ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : null}
                  {active ? (plan.id === currentTier ? "Plan actual" : "Incluido") : actionLabel(plan.id)}
                </Button>
              </div>
            );
          })}
        </div>

        {(statusText || busy) && (
          <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${
            statusError ? "border-red-500/40 bg-red-500/10 text-red-200"
              : statusOk ? "border-primary/40 bg-primary/10 text-primary"
               : "border-border bg-muted/20 text-foreground/70"}`}>
            {statusError ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> : statusOk ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" /> : <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin" />}
            <div className="min-w-0">
              <p className="break-words">{statusText}</p>
              {txHash && (
                <a href={PAY_CHAINS[chain].explorer + txHash} target="_blank" rel="noopener noreferrer" className="break-all text-[10px] text-muted-foreground underline hover:text-foreground">
                  Ver transacción
                </a>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-border/60 pt-4 text-[10px] text-muted-foreground">
          <span className="uppercase text-muted-foreground/60">Cobro a</span>
          <span className="text-primary">{PAYMENT_DOMAIN}</span>
          <span>USDC · USDT en Base y Polygon</span>
          <span>BTC, A₿TC y tarjeta próximamente</span>
        </div>
        </div>
      </div>
    </div>
  );
}

function Segment({ label, options, value, onChange }: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-full uppercase text-muted-foreground/60">{label}</span>
      {options.map((o) => (
        <Button
          variant="outline"
          size="sm"
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`h-7 rounded-sm px-2.5 text-[9px] uppercase transition-all ${
            value === o.key ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
