import { Radio, Network, BrainCircuit, Gem, Infinity as InfinityIcon, type LucideIcon } from "lucide-react";
import type { Tier } from "@/lib/globe-layers";

export type AccessKind = "free" | "login" | "subscription" | "nft" | "nft+tokens";

export interface PlanDef {
  id: Tier;
  name: string;
  tagline: string;
  price: string;
  priceNote?: string;
  access: AccessKind;
  accent: string;
  Icon: LucideIcon;
  features: string[];
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "signal",
    name: "Signal",
    tagline: "Acceso abierto, sin cuenta",
    price: "Gratis",
    priceNote: "sin login",
    access: "free",
    accent: "#8ea6b8",
    Icon: Radio,
    features: [
      "Globe táctico con capas públicas",
      "Feed OSINT y alertas en vivo",
      "Ticker de mercados en tiempo real",
      "Chat con AI Tor (demo limitada)",
    ],
  },
  {
    id: "node",
    name: "Node",
    tagline: "Entra con social o wallet",
    price: "Gratis",
    priceNote: "requiere login",
    access: "login",
    accent: "#69af00",
    Icon: Network,
    features: [
      "Historial de chat y memoria",
      "Portfolio y alertas guardadas",
      "Créditos diarios de agente",
      "Login con Google, Apple o wallet Web3",
    ],
  },
  {
    id: "synapse",
    name: "Synapse",
    tagline: "Todas las skills del enjambre",
    price: "desde 9 USDC / mes",
    priceNote: "USDC · USDT en Base o Polygon",
    access: "subscription",
    accent: "#FFD700",
    Icon: BrainCircuit,
    features: [
      "Skills completas de los agentes",
      "Capas meteorológicas y orbitales",
      "GitHub proxy + Firecrawl OSINT",
      "Generación de imágenes y audio",
      "Alertas y portfolio ilimitados",
    ],
    highlight: true,
  },
  {
    id: "oracle",
    name: "Oracle",
    tagline: "Holder de NFT de la DAO",
    price: "NFT DAO",
    priceNote: "acceso completo mientras lo mantengas",
    access: "nft",
    accent: "#00E5FF",
    Icon: Gem,
    features: [
      "Todo lo de Synapse incluido",
      "Voto y gobernanza DAO",
      "Ejecución automática en ADEX",
      "Generación de vídeo y narrativas",
    ],
  },
  {
    id: "quantum",
    name: "Quantum",
    tagline: "NFT DAO + stake soberano",
    price: "NFT + 1234 AFS · 369 A69F · 1 A₿TC",
    priceNote: "cualquiera de los tres umbrales",
    access: "nft+tokens",
    accent: "#FF00FF",
    Icon: InfinityIcon,
    features: [
      "Todo ilimitado, sin cupos",
      "Edición de código por agentes",
      "Relayer keys y soporte prioritario",
      "Acceso anticipado a nuevos módulos",
    ],
  },
];

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<Tier, PlanDef>;
