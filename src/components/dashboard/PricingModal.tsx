import { X, Zap, Cpu, Sparkles, Bitcoin, DollarSign, Coins } from "lucide-react";
import { useEffect } from "react";

interface Plan {
  id: "explorer" | "architect" | "alien";
  name: string;
  price: string;
  tagline: string;
  features: string[];
  accent: string;
  Icon: any;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "explorer",
    name: "Explorer",
    price: "Free",
    tagline: "Acceso básico al Oráculo",
    features: [
      "Chat con AI Tor (limitado)",
      "Globe tactical básico",
      "Markets read-only",
      "OSINT feed público",
    ],
    accent: "#69af00",
    Icon: Zap,
  },
  {
    id: "architect",
    name: "Architect",
    price: "$29 / mes",
    tagline: "Desbloquea todas las habilidades",
    features: [
      "Todas las skills de AgentsTab",
      "Capas meteorológicas del Globe",
      "Alertas y Portfolio ilimitado",
      "Acceso GitHub proxy + Firecrawl",
      "Generación de imágenes y sonidos",
    ],
    accent: "#FFD700",
    Icon: Cpu,
    highlight: true,
  },
  {
    id: "alien",
    name: "Alien",
    price: "$99 / mes",
    tagline: "Control total DAO + ADEX",
    features: [
      "Ejecución automática en ADEX",
      "Voto DAO y gobernanza",
      "Generación de vídeo y narrativas",
      "Edición de código por agentes",
      "Soporte priority + relayer keys",
    ],
    accent: "#FF00FF",
    Icon: Sparkles,
  },
];

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function PricingModal({ open, onClose, reason }: PricingModalProps) {
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
        className="relative w-full max-w-5xl rounded-2xl border border-[#69af00]/40 bg-black/85 backdrop-blur-[20px] p-6 md:p-8 shadow-[0_0_60px_rgba(105,175,0,0.25)] max-h-[90vh] overflow-y-auto"
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border bg-black/60 backdrop-blur-[15px] p-5 transition-all hover:scale-[1.02] flex flex-col ${
                plan.highlight ? "border-[#FFD700]/60 shadow-[0_0_30px_rgba(255,215,0,0.18)]" : "border-white/[0.08]"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#FFD700] text-black">
                  Most Popular
                </span>
              )}
              <plan.Icon className="w-6 h-6 mb-3" style={{ color: plan.accent }} />
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">{plan.name}</div>
              <div className="text-2xl font-bold text-white mt-1" style={{ color: plan.accent }}>
                {plan.price}
              </div>
              <p className="text-[11px] text-white/60 mt-1">{plan.tagline}</p>
              <ul className="mt-4 space-y-1.5 text-[11px] text-white/75 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="text-[#69af00] mt-0.5">▸</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={plan.id === "explorer"}
                className={`mt-5 w-full py-2 rounded-md text-[11px] font-bold tracking-widest uppercase transition-all ${
                  plan.id === "explorer"
                    ? "bg-white/[0.04] text-white/40 cursor-default"
                    : "bg-gradient-to-r from-[#69af00]/30 to-[#FFD700]/30 text-white hover:from-[#69af00]/50 hover:to-[#FFD700]/50 border border-[#69af00]/40"
                }`}
                onClick={() => {
                  if (plan.id === "explorer") return;
                  // TODO: connect to checkout (Stripe / Paddle / Crypto gateway)
                  alert(`[Simulación] Upgrade a ${plan.name} — pasarela próximamente`);
                }}
              >
                {plan.id === "explorer" ? "Plan Actual" : "Upgrade Now"}
              </button>
            </div>
          ))}
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