import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig, initAppKit } from "@/lib/web3/config";

initAppKit();

export function Web3Provider({ children }: { children: ReactNode }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
