import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioAsset {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  entryPrice: number;
  image?: string;
}

export interface PortfolioAssetWithPrice extends PortfolioAsset {
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

const STORAGE_KEY = "alienflow-portfolio";

function loadPortfolio(): PortfolioAsset[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function savePortfolio(assets: PortfolioAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

export function usePortfolio() {
  const [assets, setAssets] = useState<PortfolioAsset[]>(loadPortfolio);
  const [prices, setPrices] = useState<Record<string, { price: number; image: string; name: string }>>({});
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-feed", {
        body: { action: "movers" },
      });
      if (error) throw error;
      const coins = data?.coins || [];
      const map: Record<string, { price: number; image: string; name: string }> = {};
      coins.forEach((c: any) => {
        map[c.id] = { price: c.current_price, image: c.image, name: c.name };
        map[c.symbol] = { price: c.current_price, image: c.image, name: c.name };
      });
      setPrices(map);
    } catch (e) {
      console.error("Failed to fetch prices for portfolio", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  useEffect(() => {
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const addAsset = useCallback((asset: Omit<PortfolioAsset, "id">) => {
    setAssets(prev => {
      const next = [...prev, { ...asset, id: crypto.randomUUID() }];
      savePortfolio(next);
      return next;
    });
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => {
      const next = prev.filter(a => a.id !== id);
      savePortfolio(next);
      return next;
    });
  }, []);

  const assetsWithPrices: PortfolioAssetWithPrice[] = assets.map(a => {
    const priceData = prices[a.coinId] || prices[a.symbol.toLowerCase()];
    const currentPrice = priceData?.price || a.entryPrice;
    const value = a.amount * currentPrice;
    const costBasis = a.amount * a.entryPrice;
    const pnl = value - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { ...a, currentPrice, value, pnl, pnlPercent, image: priceData?.image || a.image, name: priceData?.name || a.name };
  });

  const totalValue = assetsWithPrices.reduce((s, a) => s + a.value, 0);
  const totalPnl = assetsWithPrices.reduce((s, a) => s + a.pnl, 0);
  const totalCost = assetsWithPrices.reduce((s, a) => s + a.amount * a.entryPrice, 0);
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return { assets: assetsWithPrices, addAsset, removeAsset, totalValue, totalPnl, totalPnlPercent, loading, refetch: fetchPrices };
}
