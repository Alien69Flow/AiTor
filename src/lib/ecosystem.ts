import {
  Anchor,
  Atom,
  BookOpen,
  CandlestickChart,
  Cpu,
  Image as ImageIcon,
  Plane,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the AlienFlowSpace ecosystem that Ai Tor operates.
 * Only real, verifiable endpoints belong here — never placeholder assets. Every
 * entry is rendered by the Control Center, so adding a product once makes it
 * appear everywhere (grid, command targets, links).
 */

export type EcosystemGroup = "core" | "finance" | "commerce" | "governance";

export interface EcosystemProduct {
  id: string;
  name: string;
  url: string;
  host: string;
  tagline: string;
  detail: string;
  group: EcosystemGroup;
  Icon: LucideIcon;
  /** Imported logo asset; falls back to the icon when absent. */
  logo?: "ace" | "adex" | "aitor" | "atrip" | "dao";
  accent: string;
}

export const PRODUCTS: EcosystemProduct[] = [
  {
    id: "aitor",
    name: "Ai Tor",
    url: "https://aitor.alienflow.space",
    host: "aitor.alienflow.space",
    tagline: "Centro de control",
    detail: "Terminal de inteligencia y orquestación de agentes",
    group: "core",
    Icon: Atom,
    logo: "aitor",
    accent: "hsl(var(--primary))",
  },
  {
    id: "ace",
    name: "ACE",
    url: "https://ace.alienflow.space",
    host: "ace.alienflow.space",
    tagline: "Autonomous Cognitive Engine",
    detail: "A CashFlow Energy · motor cognitivo autónomo",
    group: "core",
    Icon: Cpu,
    logo: "ace",
    accent: "#69af00",
  },
  {
    id: "adex",
    name: "AlienDEX · ADEX",
    url: "https://adex.alienflow.space",
    host: "adex.alienflow.space",
    tagline: "Alien DEX & Play HUB",
    detail: "Intercambio, liquidez y economía de juego",
    group: "finance",
    Icon: CandlestickChart,
    logo: "adex",
    accent: "#00E5FF",
  },
  {
    id: "atrip",
    name: "AlienTrip",
    url: "https://atrip.alienflow.space",
    host: "atrip.alienflow.space",
    tagline: "Alien Travel Trip",
    detail: "Reservas y experiencias del ecosistema",
    group: "commerce",
    Icon: Plane,
    // Same mark as the DAO menu at alienflow.space/lovable-uploads/apps/atrip.png.
    logo: "atrip",
    accent: "#FFD700",
  },
  {
    id: "dao",
    name: "AlienFlow DAO",
    url: "https://www.alienflow.space",
    host: "alienflow.space",
    tagline: "Sede de la DAO",
    detail: "Manifiesto, gobernanza y ecosistema completo",
    group: "governance",
    Icon: Anchor,
    // The official mark, the same one the terminal shows top-left.
    logo: "dao",
    accent: "hsl(var(--primary))",
  },
  {
    id: "docs",
    name: "DAO Docs",
    url: "https://alienflowspace.gitbook.io/DAO",
    host: "alienflowspace.gitbook.io",
    tagline: "Documentación",
    detail: "Tokenomics, arquitectura y guías",
    group: "governance",
    Icon: BookOpen,
    accent: "#8ea6b8",
  },
];

export interface DaoOrg {
  id: string;
  name: string;
  role: string;
  /** Polygon mainnet. */
  chainId: 137;
  address: `0x${string}`;
  aragonUrl: string;
}

export const DAOS: DaoOrg[] = [
  {
    id: "alienflow-polygon",
    name: "AlienFlowSpace DAO",
    role: "Tesorería y gobernanza principal",
    chainId: 137,
    address: "0xCA497d631DB260ebFFF4bA71AEAc3201ae972a77",
    aragonUrl:
      "https://app.aragon.org/dao/polygon-mainnet/0xCA497d631DB260ebFFF4bA71AEAc3201ae972a77/dashboard",
  },
  {
    id: "alienflow-second",
    name: "AlienFlow DAO · vault",
    role: "Segunda organización Aragon",
    chainId: 137,
    address: "0x2A1F32A807b3f8a43F9473C1FA7d11881A579b16",
    aragonUrl:
      "https://app.aragon.org/dao/polygon-mainnet/0x2A1F32A807b3f8a43F9473C1FA7d11881A579b16/dashboard",
  },
];

export interface NftProfile {
  id: string;
  name: string;
  url: string;
  detail: string;
  Icon: LucideIcon;
}

export const NFT_PROFILES: NftProfile[] = [
  {
    id: "alien69flow",
    name: "Alien69Flow",
    url: "https://opensea.io/es/Alien69Flow",
    detail: "Perfil oficial de creador",
    Icon: ImageIcon,
  },
  {
    id: "alienflowspace",
    name: "AlienFlowSpace",
    url: "https://opensea.io/es/AlienFlowSpace",
    detail: "Perfil oficial de la DAO",
    Icon: ShieldCheck,
  },
];

export interface SovereignDomain {
  domain: string;
  url: string;
  note: string;
}

/** Unstoppable Domains owned by the DAO, resolved through the public ud.me profile. */
export const DOMAINS: SovereignDomain[] = [
  { domain: "alienflow.888", url: "https://ud.me/alienflow.888", note: "Identidad multichain" },
  { domain: "alienflow.blockchain", url: "https://ud.me/alienflow.blockchain", note: "Perfil Web3" },
  { domain: "alienflow.crypto", url: "https://ud.me/alienflow.crypto", note: "Pagos cripto" },
  { domain: "alienflow.nft", url: "https://ud.me/alienflow.nft", note: "Galería NFT" },
];

export const REPO = {
  owner: "Alien69Flow",
  name: "AiTor",
  url: "https://github.com/Alien69Flow/AiTor",
  issuesUrl: "https://github.com/Alien69Flow/AiTor/issues/new",
} as const;

/** Prefilled agent-task issue, the zero-secret execution path from the console. */
export function buildIssueUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    title: title.slice(0, 140),
    body: body.slice(0, 6000),
    labels: "agent-task",
  });
  return `${REPO.issuesUrl}?${params.toString()}`;
}
