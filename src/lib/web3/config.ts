import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base, polygon, mainnet, type AppKitNetwork } from "@reown/appkit/networks";

/** Public Reown (WalletConnect) project id — safe to ship in the bundle. */
export const REOWN_PROJECT_ID = "ced40e4d52234c471808977208586c7e";

export const networks = [base, polygon, mainnet] as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter = new WagmiAdapter({
  projectId: REOWN_PROJECT_ID,
  networks,
  ssr: false,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

let initialized = false;

export function initAppKit() {
  if (initialized) return;
  initialized = true;
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId: REOWN_PROJECT_ID,
    defaultNetwork: base,
    metadata: {
      name: "AI Tor · AlienFlowSpace DAO",
      description: "Neural intelligence core — Sovereign Nexus access",
      url: typeof window !== "undefined" ? window.location.origin : "https://aitor.alienflow.space",
      icons: ["https://aitor.alienflow.space/favicon.ico"],
    },
    features: { analytics: false, email: false, socials: [] },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#69af00",
      "--w3m-border-radius-master": "2px",
    },
  });
}
