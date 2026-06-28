import { ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import {
  wagmiAdapter,
  wagmiConfig,
  solanaAdapter,
  bitcoinAdapter,
  networks,
  projectId,
  metadata,
} from "@/config/appkit";

let initialized = false;

function initAppKit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  createAppKit({
    adapters: [wagmiAdapter, solanaAdapter, bitcoinAdapter],
    networks,
    projectId,
    metadata,
    defaultNetwork: networks[0],
    features: {
      analytics: true,
      email: false,
      socials: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#69af00",
      "--w3m-color-mix": "#69af00",
      "--w3m-color-mix-strength": 20,
      "--w3m-border-radius-master": "4px",
    },
  });
}

initAppKit();

export function Web3Provider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAppKit();
  }, []);
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}