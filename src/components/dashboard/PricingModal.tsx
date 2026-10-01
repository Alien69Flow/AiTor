import { X, Wallet, Loader as Loader2, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useCryptoCheckout } from "@/hooks/useCryptoCheckout";
import { useDaoAccess } from "@/hooks/useDaoAccess";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
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
      if (isConnected) { await walletSignIn(); return; }
      navigate("/auth");
      onClose();
      return;
    }
    if (plan === "synapse") {
      if (!user) { await walletSignIn(); if (!user) return; }
      pay(cycle, chain, token);
      return;
    }
    if (!user) { await walletSignIn(); }
    verify();
  };

  const actionLabel = (plan: Tier) => {
    if (plan === currentTier) return "Plan actual";
    if (plan === "signal") return "Siempre activo";
    if (plan === "node") return user ? "Activo" : "Entrar";
    if (plan === "synapse") return `Pagar ${BILLING_CYCLES[cycle].price} ${token}`;
    return "Verificar holdings";
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative w-full max-w-6xl rounded-2xl border border-[#69af00]/35 bg-black/90 backdrop-blur-[20px] p-4 md:p-7 shadow-[0_0_70px_rgba(105,175,0,0.22)] max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Nasalization', monospace" }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="text-[10px] tracking-[0.45em] text-[#69af00] uppercase">Sovereign Nexus · Access Tiers</div>
          <h2 className="text-xl md:text-3xl font-bold text-white mt-1">Los 5 niveles del Oráculo</h2>
          {reason && <p className="text-[11px] text-white/50 mt-2">{reason}</p>}
        </div>

        {/* Payment rail */}
        <div className="mb-5 grid gap-2 md:flex md:flex-wrap md:items-center md:justify-center text-[10px]">
          <Segment label="Periodo" options={(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((k) => ({
            key: k, label: `${BILLING_CYCLES[k].label} · ${BILLING_CYCLES[k].price}`,
          }))} value={cycle} onChange={(v) => setCycle(v as BillingCycle)} />
          <Segment label="Red" options={(Object.keys(PAY_CHAINS) as PayChain[]).map((k) => ({ key: k, label: PAY_CHAINS[k].label }))}
            value={chain} onChange={(v) => setChain(v as PayChain)} />
          <Segment label="Moneda" options={TOKENS.map((t) => ({ key: t, label: t }))} value={token} onChange={(v) => setToken(v as PayToken)} />
          <span className="flex items-center gap-1 text-white/40 px-1">
            <Wallet className="w-3 h-3" />
            {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "wallet sin conectar"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {PLANS.map((plan) => {
            const active = plan.id === currentTier || TIER_RANK[currentTier] > TIER_RANK[plan.id];
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border bg-white/[0.02] backdrop-blur-[15px] p-4 flex flex-col transition-all hover:-translate-y-0.5 ${
                  plan.highlight ? "border-[#FFD700]/55 shadow-[0_0_28px_rgba(255,215,0,0.16)]" : "border-white/[0.08]"
                }`}
              >
                {plan.id === currentTier && (
                  <span className="absolute -top-2.5 right-3 text-[8px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#69af00] text-black">Activo</span>
                )}
                {plan.highlight && plan.id !== currentTier && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#FFD700] text-black">Popular</span>
                )}
                <plan.Icon className="w-5 h-5 mb-2" style={{ color: plan.accent }} />
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">{plan.name}</div>
                <div className="text-base md:text-lg font-bold mt-1 leading-tight" style={{ color: plan.accent }}>
                  {plan.id === "synapse" ? `${BILLING_CYCLES[cycle].price} ${token} / ${BILLING_CYCLES[cycle].label.toLowerCase()}` : plan.price}
                </div>
                {plan.priceNote && <div className="text-[9px] text-white/35 mt-0.5">{plan.priceNote}</div>}
                <p className="text-[10px] text-white/55 mt-2">{plan.tagline}</p>
                <ul className="mt-3 space-y-1 text-[10px] text-white/75 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span style={{ color: plan.accent }} className="mt-[1px]">▸</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled={busy || verifying || walletBusy || active}
                  onClick={() => handleAction(plan.id)}
                  className={`mt-4 w-full py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 ${
                    active || busy || verifying
                      ? "bg-white/[0.04] text-white/40 cursor-default"
                      : "bg-gradient-to-r from-[#69af00]/25 to-[#FFD700]/25 text-white hover:from-[#69af00]/45 hover:to-[#FFD700]/45 border border-[#69af00]/35"
                  }`}
                >
                  {(busy && plan.id === "synapse") || (verifying && (plan.id === "oracle" || plan.id === "quantum")) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : plan.access === "nft" || plan.access === "nft+tokens" ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : null}
                  {active ? (plan.id === currentTier ? "Plan actual" : "Incluido") : actionLabel(plan.id)}
                </button>
              </div>
            );
          })}
        </div>

        {(statusText || busy) && (
          <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${
            statusError ? "border-red-500/40 bg-red-500/10 text-red-200"
              : statusOk ? "border-[#69af00]/40 bg-[#69af00]/10 text-[#b7e36b]"
              : "border-white/10 bg-white/[0.04] text-white/70"}`}>
            {statusError ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> : statusOk ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" /> : <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin" />}
            <div className="min-w-0">
              <p className="break-words">{statusText}</p>
              {txHash && (
                <a href={PAY_CHAINS[chain].explorer + txHash} target="_blank" rel="noopener noreferrer" className="text-[10px] underline text-white/50 hover:text-white break-all">
                  Ver transacción
                </a>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-white/[0.06] pt-4 flex items-center justify-center gap-4 flex-wrap text-[10px] text-white/45">
          <span className="uppercase tracking-widest text-white/30">Cobro a</span>
          <span className="text-[#69af00]">{PAYMENT_DOMAIN}</span>
          <span>USDC · USDT en Base y Polygon</span>
          <span>BTC, A₿TC y tarjeta próximamente</span>
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
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="uppercase tracking-widest text-white/30">{label}</span>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-2.5 py-1 rounded-md border uppercase tracking-widest transition-all ${
            value === o.key ? "border-[#69af00]/60 bg-[#69af00]/15 text-[#69af00]" : "border-white/10 text-white/50 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
