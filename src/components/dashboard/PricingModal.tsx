import { X, Zap, Cpu, Sparkles, Bitcoin, DollarSign, Coins, UserPlus, Infinity as InfinityIcon } from "lucide-react";
import { useEffect } from "react";
import { useCredits, TIER_LIMITS, type CreditTier } from "@/hooks/useCredits";

interface Plan {
  id: CreditTier;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  accent: string;
  Icon: any;
  highlight?: boolean;
  paid: boolean;
}

const PLANS: Plan[] = [
  {
    id: "anonymous",
    name: "Visitor",
    price: "Free",
    tagline: "Sin registro",
    features: [
      `${TIER_LIMITS.anonymous} créditos / día`,
      "Chat AI Tor limitado",
      "Globe + OSINT públicos",
      "Markets read-only",
    ],
    accent: "#64748b",
    Icon: Zap,
    paid: false,
  },
  {
    id: "registered",
    name: "Operator",
    price: "Free + Login",
    tagline: "Registrate gratis",
    features: [
      `${TIER_LIMITS.registered} créditos / día`,
      "OpenWeather + OpenSky en vivo",
      "Historial de chat persistente",
      "Alertas y Portfolio",
    ],
    accent: "#69af00",
    Icon: UserPlus,
    paid: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "$9 / mes",
    tagline: "Consultas frecuentes",
    features: [
      `${TIER_LIMITS.basic} créditos / día`,
      "Todas las skills de Agents",
      "Capas meteo + satelitales",
      "Firecrawl OSINT",
    ],
    accent: "#22d3ee",
    Icon: Cpu,
    paid: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29 / mes",
    tagline: "Uso intensivo Manus",
    features: [
      `${TIER_LIMITS.pro} créditos / día`,
      "GitHub proxy + edición de código",
      "Generación imagen/audio/video",
      "DAO governance read+vote",
    ],
    accent: "#FFD700",
    Icon: Sparkles,
    paid: true,
    highlight: true,
  },
  {
    id: "quantum",
    name: "Quantum",
    price: "$99 / mes",
    tagline: "Acceso total Singularidad",
    features: [
      "Créditos ilimitados",
      "Ejecución autónoma en ADEX",
      "Prioridad relayer + priority queue",
      "Soporte directo del Oráculo",
    ],
    accent: "#FF00FF",
    Icon: InfinityIcon,
    paid: true,
  },
];

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function PricingModal({ open, onClose, reason }: PricingModalProps) {
  const { tier, setPaidTier } = useCredits();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl rounded-2xl border border-[#69af00]/40 bg-black/85 backdrop-blur-[20px] p-6 md:p-8 shadow-[0_0_60px_rgba(105,175,0,0.25)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Nasalization', monospace" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="text-[10px] tracking-[0.4em] text-[#69af00] uppercase">Sovereign Nexus · Membership</div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">Activa tu Acceso al Oráculo</h2>
          {reason && <p className="text-[11px] text-white/50 mt-2">{reason}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = tier === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border bg-black/60 backdrop-blur-[15px] p-4 transition-all hover:scale-[1.02] flex flex-col ${
                  plan.highlight ? "border-[#FFD700]/60 shadow-[0_0_30px_rgba(255,215,0,0.18)]" : "border-white/[0.08]"
                } ${isCurrent ? "ring-2 ring-[#69af00]/50" : ""}`}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#FFD700] text-black">
                    Most Popular
                  </span>
                )}
                <plan.Icon className="w-5 h-5 mb-2" style={{ color: plan.accent }} />
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">{plan.name}</div>
                <div className="text-xl font-bold mt-1" style={{ color: plan.accent }}>
                  {plan.price}
                </div>
                <p className="text-[10px] text-white/60 mt-1">{plan.tagline}</p>
                <ul className="mt-3 space-y-1 text-[10px] text-white/75 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1">
                      <span className="text-[#69af00] mt-0.5">▸</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent}
                  className={`mt-4 w-full py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all ${
                    isCurrent
                      ? "bg-white/[0.04] text-white/40 cursor-default"
                      : plan.paid
                      ? "bg-gradient-to-r from-[#69af00]/30 to-[#FFD700]/30 text-white hover:from-[#69af00]/50 hover:to-[#FFD700]/50 border border-[#69af00]/40"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.1]"
                  }`}
                  onClick={() => {
                    if (isCurrent) return;
                    if (plan.id === "anonymous") return;
                    if (plan.id === "registered") {
                      window.location.href = "/auth";
                      return;
                    }
                    setPaidTier(plan.id as "basic" | "pro" | "quantum");
                    alert(`[Demo] Plan ${plan.name} activado localmente. Pasarela Stripe próximamente.`);
                    onClose();
                  }}
                >
                  {isCurrent ? "Plan Actual" : plan.id === "registered" ? "Sign In" : plan.paid ? "Upgrade" : "Use Free"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-center gap-4 flex-wrap text-[10px] text-white/50">
          <span className="uppercase tracking-widest text-white/30">Pago aceptado</span>
          <span className="flex items-center gap-1"><Bitcoin className="w-3 h-3 text-[#F7931A]" /> BTC</span>
          <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-[#627EEA]" /> ETH / Cryptos</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-[#26A17B]" /> USDC / USDT</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-white/60" /> Fiat (Stripe)</span>
        </div>
      </div>
    </div>
  );
}
