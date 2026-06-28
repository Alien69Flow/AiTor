import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { BitcoinAdapter } from "@reown/appkit-adapter-bitcoin";
import {
  polygon,
  mainnet,
  bsc,
  arbitrum,
  base,
  solana,
  bitcoin,
  type AppKitNetwork,
} from "@reown/appkit/networks";

export const projectId = "ced40e4d52234c471808977208586c7e";

export const metadata = {
  name: "AI Tor - AlienFlowSpace DAO",
  description: "AI Tor — Terminal de Inteligencia Soberana de AlienFlow DAO",
  url: "https://aitor.alienflow.space",
  icons: ["https://aitor.alienflow.space/favicon.ico"],
};

// Polygon is principal — listed first so AppKit defaults to it.
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  polygon,
  mainnet,
  arbitrum,
  base,
  bsc,
  solana,
  bitcoin,
];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

export const solanaAdapter = new SolanaAdapter();
export const bitcoinAdapter = new BitcoinAdapter({ projectId });

export const wagmiConfig = wagmiAdapter.wagmiConfig;