import { useState, useEffect, useCallback } from "react";

export interface CryptoPrice {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
}

const COIN_IDS = [
  "bitcoin", "ethereum", "binancecoin", "solana", "ripple", "cardano",
  "avalanche-2", "chainlink", "polkadot", "dogecoin", "the-open-network",
  "cosmos", "polygon-ecosystem-token", "arbitrum", "optimism", "near",
  "injective-protocol", "render-token", "pax-gold", "tether-gold",
].join(",");
const SYMBOLS: Record<string, string> = {
  bitcoin: "BTC", ethereum: "ETH", binancecoin: "BNB", solana: "SOL",
  ripple: "XRP", cardano: "ADA", "avalanche-2": "AVAX", chainlink: "LINK",
  polkadot: "DOT", dogecoin: "DOGE", "the-open-network": "TON", cosmos: "ATOM",
  "polygon-ecosystem-token": "POL", arbitrum: "ARB", optimism: "OP", near: "NEAR",
  "injective-protocol": "INJ", "render-token": "RENDER",
  "pax-gold": "XAUt·PAXG", "tether-gold": "XAUT",
};

const COINGECKO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true`;

const FALLBACK: CryptoPrice[] = [
  { id: "bitcoin", symbol: "BTC", price: 67420, change24h: 2.1 },
  { id: "ethereum", symbol: "ETH", price: 3850, change24h: 1.5 },
  { id: "binancecoin", symbol: "BNB", price: 610, change24h: -0.3 },
  { id: "solana", symbol: "SOL", price: 178, change24h: 4.2 },
  { id: "the-open-network", symbol: "TON", price: 6.8, change24h: -1.1 },
  { id: "cosmos", symbol: "ATOM", price: 9.2, change24h: 0.8 },
  { id: "polygon-ecosystem-token", symbol: "POL", price: 0.52, change24h: -2.4 },
  { id: "ripple", symbol: "XRP", price: 0.62, change24h: 1.2 },
  { id: "cardano", symbol: "ADA", price: 0.45, change24h: -0.7 },
  { id: "avalanche-2", symbol: "AVAX", price: 28.4, change24h: 2.8 },
  { id: "chainlink", symbol: "LINK", price: 18.1, change24h: 1.9 },
  { id: "polkadot", symbol: "DOT", price: 6.4, change24h: -1.3 },
  { id: "dogecoin", symbol: "DOGE", price: 0.13, change24h: 3.1 },
  { id: "arbitrum", symbol: "ARB", price: 0.78, change24h: -0.9 },
  { id: "optimism", symbol: "OP", price: 1.72, change24h: 0.4 },
  { id: "near", symbol: "NEAR", price: 4.9, change24h: 2.2 },
  { id: "injective-protocol", symbol: "INJ", price: 22.6, change24h: -1.8 },
  { id: "render-token", symbol: "RENDER", price: 6.1, change24h: 4.4 },
  { id: "pax-gold", symbol: "XAUt·PAXG", price: 2380, change24h: 0.3 },
];

export function useCryptoPrices(intervalMs = 60_000) {
  const [prices, setPrices] = useState<CryptoPrice[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error("CoinGecko fetch failed");
      const json = await res.json();
      const parsed: CryptoPrice[] = Object.entries(json).map(([id, data]: [string, any]) => ({
        id,
        symbol: SYMBOLS[id] || id.toUpperCase(),
        price: data.usd || 0,
        change24h: data.usd_24h_change || 0,
      }));
      if (parsed.length > 0) setPrices(parsed);
    } catch (e) {
      console.warn("CoinGecko fetch failed, using fallback:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { prices, loading };
}
