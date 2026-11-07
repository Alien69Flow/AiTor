import { useState, useEffect, useCallback } from "react";
import { parseLiveQuotes } from "@/lib/live-quotes";

export interface CryptoPrice {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
  updatedAt?: number;
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

const COINGECKO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;

export function useCryptoPrices(intervalMs = 60_000) {
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error("CoinGecko fetch failed");
      const json = await res.json();
      const parsed = parseLiveQuotes(json, SYMBOLS);
      if (parsed.length > 0) setPrices(parsed);
    } catch (e) {
      console.warn("CoinGecko fetch failed, retaining last verified quotes:", e);
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
