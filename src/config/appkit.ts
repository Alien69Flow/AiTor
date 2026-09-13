import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arbitrum, base, bsc, mainnet, polygon, type AppKitNetwork } from "@reown/appkit/networks";

// The fallback is the public Reown project already configured by AlienFlowSpace.
// Deployments may override it without changing source code.
export const reownProjectId =
  (import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined) ??
  "ced40e4d52234c471808977208586c7e";

export const supportedNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  polygon,
  mainnet,
  arbitrum,
  base,
  bsc,
];

export const wagmiAdapter = new WagmiAdapter({
  networks: supportedNetworks as any,
  projectId: reownProjectId,
  ssr: false,
});

const origin = typeof window === "undefined" ? "https://aitor.alienflow.space" : window.location.origin;

createAppKit({
  adapters: [wagmiAdapter],
  networks: supportedNetworks,
  defaultNetwork: polygon,
  projectId: reownProjectId,
  metadata: {
    name: "AI Tor",
    description: "AlienFlow AI intelligence portal",
    url: origin,
    icons: [`${origin}/favicon.ico`],
  },
  features: {
    analytics: true,
    email: false,
    socials: false,
  },
});
