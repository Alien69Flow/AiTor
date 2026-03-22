import { useState, useEffect, useCallback } from "react";

export interface CryptoPrice {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
}

const COIN_IDS = "bitcoin,ethereum,binancecoin,solana,the-open-network,cosmos,polygon-ecosystem-token";
const SYMBOLS: Record<string, string> = {
  bitcoin: "BTC", ethereum: "ETH", binancecoin: "BNB", solana: "SOL",
  "the-open-network": "TON", cosmos: "ATOM", "polygon-ecosystem-token": "POL",
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
