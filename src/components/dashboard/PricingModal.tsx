import { X, Zap, Cpu, Sparkles, Bitcoin, Coins, UserPlus, Infinity as InfinityIcon, Wallet, ShieldCheck, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useCredits, TIER_LIMITS, type CreditTier } from "@/hooks/useCredits";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Eip1193Provider } from "ethers";

// Unlock Protocol PublicLock addresses (Polygon mainnet). Replace with real DAO locks.
const UNLOCK_BASIC_LOCK = "0x0000000000000000000000000000000000000001"; // TODO: deploy Basic lock
const UNLOCK_PRO_NFT   = "0x0000000000000000000000000000000000000002"; // TODO: deploy Pro membership NFT

// Minimal PublicLock ABI slice used here.
const PUBLIC_LOCK_ABI = [
  "function purchase(uint256[] _values, address[] _recipients, address[] _referrers, address[] _keyManagers, bytes[] _data) payable returns (uint256[])",
  "function keyPrice() view returns (uint256)",
  "function balanceOf(address _owner) view returns (uint256)",
];

interface Plan {
  id: CreditTier;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  accent: string;
  Icon: any;
  highlight?: boolean;
  gate: "free" | "wallet" | "crypto" | "nft" | "premium";
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
    gate: "free",
  },
  {
    id: "registered",
    name: "Operator",
    price: "Wallet Login",
    tagline: "Conecta tu wallet",
    features: [
      `${TIER_LIMITS.registered} créditos / día`,
      "OpenWeather + OpenSky en vivo",
      "Historial de chat persistente",
      "Alertas y Portfolio",
    ],
    accent: "#69af00",
    Icon: Wallet,
    gate: "wallet",
  },
  {
    id: "basic",
    name: "Basic",
    price: "9 USDC / mes",
    tagline: "Pago on-chain (Unlock)",
    features: [
      `${TIER_LIMITS.basic} créditos / día`,
      "Todas las skills de Agents",
      "Capas meteo + satelitales",
      "Firecrawl OSINT",
    ],
    accent: "#22d3ee",
    Icon: Cpu,
    gate: "crypto",
  },
  {
    id: "pro",
    name: "Pro",
    price: "NFT Membership",
    tagline: "Holder-only access",
    features: [
      `${TIER_LIMITS.pro} créditos / día`,
      "GitHub proxy + edición de código",
      "Generación imagen/audio/video",
      "DAO governance read+vote",
    ],
    accent: "#FFD700",
    Icon: Sparkles,
    highlight: true,
    gate: "nft",
  },
  {
    id: "quantum",
    name: "Quantum",
    price: "Stake / 99 USDC",
    tagline: "Singularidad total",
    features: [
      "Créditos ilimitados",
      "Ejecución autónoma en ADEX",
      "Prioridad relayer + priority queue",
      "Soporte directo del Oráculo",
    ],
    accent: "#FF00FF",
    Icon: InfinityIcon,
    gate: "premium",
  },
];

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function PricingModal({ open, onClose, reason }: PricingModalProps) {
  const { tier, setPaidTier } = useCredits();
  const { open: openAppKit } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");
  const [busy, setBusy] = useState<CreditTier | null>(null);
  const [hasProNft, setHasProNft] = useState(false);

  // Chequeo balanceOf del NFT Pro cada vez que cambia la wallet conectada.
  useEffect(() => {
    let cancelled = false;
    async function checkNft() {
      if (!isConnected || !address || !walletProvider) { setHasProNft(false); return; }
      try {
        const { BrowserProvider, Contract } = await import("ethers");
        const provider = new BrowserProvider(walletProvider);
        const lock = new Contract(UNLOCK_PRO_NFT, PUBLIC_LOCK_ABI, provider);
        const bal: bigint = await lock.balanceOf(address);
        if (!cancelled) setHasProNft(bal > 0n);
      } catch (e) {
        if (!cancelled) setHasProNft(false);
      }
    }
    checkNft();
    return () => { cancelled = true; };
  }, [address, isConnected, walletProvider]);

  const purchaseBasicLock = useCallback(async () => {
    if (!walletProvider || !address) return;
    setBusy("basic");
    try {
      const { BrowserProvider, Contract } = await import("ethers");
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const lock = new Contract(UNLOCK_BASIC_LOCK, PUBLIC_LOCK_ABI, signer);
      const price: bigint = await lock.keyPrice();
      const tx = await lock.purchase(
        [price],
        [address],
        [address],
        [address],
        ["0x"],
        { value: price },
      );
      await tx.wait();
      setPaidTier("basic");
      alert("Membresía Basic activada on-chain.");
      onClose();
    } catch (e: any) {
      alert(`Compra cancelada: ${e?.shortMessage ?? e?.message ?? "error"}`);
    } finally {
      setBusy(null);
    }
  }, [walletProvider, address, setPaidTier, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleAction = (plan: Plan) => {
    if (plan.id === "anonymous" || tier === plan.id) return;
    // Toda acción de upgrade requiere wallet conectada primero.
    if (!isConnected) { openAppKit(); return; }
    if (plan.gate === "wallet") { setPaidTier?.("basic"); /* no-op: registered gated by wallet */ onClose(); return; }
    if (plan.gate === "crypto") { purchaseBasicLock(); return; }
    if (plan.gate === "nft") {
      if (hasProNft) return;
      window.open(`https://app.unlock-protocol.com/checkout?locks[${UNLOCK_PRO_NFT}][network]=137`, "_blank");
      return;
    }
    if (plan.gate === "premium") {
      window.open(`https://app.unlock-protocol.com/checkout?locks[${UNLOCK_PRO_NFT}][network]=137`, "_blank");
      return;
    }
  };

  const buttonLabel = (plan: Plan, isCurrent: boolean): string => {
    if (isCurrent) return "Plan Actual";
    if (plan.gate === "free") return "Use Free";
    if (!isConnected) return "Conectar Wallet";
    if (plan.gate === "wallet") return "Wallet Conectada ✓";
    if (plan.gate === "crypto") return busy === "basic" ? "Firmando…" : "Pagar en USDC";
    if (plan.gate === "nft") return hasProNft ? "NFT Detectado · Pro Activo" : "Comprar Membership NFT";
    if (plan.gate === "premium") return "Stake / Upgrade Quantum";
    return "Upgrade";
  };

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
          <div className="mt-3 inline-flex items-center gap-2 text-[10px] text-white/50">
            <ShieldCheck className="w-3 h-3 text-[#69af00]" />
            {isConnected ? (
              <span>Wallet: <span className="text-white/80">{address?.slice(0, 6)}…{address?.slice(-4)}</span></span>
            ) : (
              <span>Wallet no conectada · todos los upgrades abrirán Reown</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = tier === plan.id;
            const proActive = plan.gate === "nft" && hasProNft;
            const disabled = isCurrent || proActive || busy === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border bg-black/60 backdrop-blur-[15px] p-4 transition-all hover:scale-[1.02] flex flex-col ${
                  plan.highlight ? "border-[#FFD700]/60 shadow-[0_0_30px_rgba(255,215,0,0.18)]" : "border-white/[0.08]"
                } ${isCurrent || proActive ? "ring-2 ring-[#69af00]/50" : ""}`}
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
                  disabled={disabled}
                  className={`mt-4 w-full py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 ${
                    disabled
                      ? "bg-white/[0.04] text-white/40 cursor-default"
                      : plan.gate === "crypto" || plan.gate === "nft" || plan.gate === "premium"
                      ? "bg-gradient-to-r from-[#69af00]/30 to-[#FFD700]/30 text-white hover:from-[#69af00]/50 hover:to-[#FFD700]/50 border border-[#69af00]/40"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.1]"
                  }`}
                  onClick={() => handleAction(plan)}
                >
                  {busy === plan.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  {buttonLabel(plan, isCurrent)}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-center gap-4 flex-wrap text-[10px] text-white/50">
          <span className="uppercase tracking-widest text-white/30">On-chain · Sin intermediarios</span>
          <span className="flex items-center gap-1"><Bitcoin className="w-3 h-3 text-[#F7931A]" /> BTC</span>
          <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-[#627EEA]" /> ETH · MATIC · SOL</span>
          <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-[#26A17B]" /> USDC · USDT</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#69af00]" /> Unlock Protocol</span>
        </div>
      </div>
    </div>
  );
}
