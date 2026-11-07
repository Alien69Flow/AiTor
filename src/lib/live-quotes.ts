export interface LiveQuote {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
  updatedAt?: number;
}

export function parseLiveQuotes(payload: unknown, symbols: Record<string, string>): LiveQuote[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(symbols).flatMap(([id, symbol]) => {
    const value = (payload as Record<string, unknown>)[id];
    if (!value || typeof value !== "object") return [];
    const quote = value as Record<string, unknown>;
    if (typeof quote.usd !== "number" || !Number.isFinite(quote.usd) || quote.usd <= 0) return [];
    return [{ id, symbol, price: quote.usd,
      change24h: typeof quote.usd_24h_change === "number" && Number.isFinite(quote.usd_24h_change) ? quote.usd_24h_change : 0,
      updatedAt: typeof quote.last_updated_at === "number" ? quote.last_updated_at * 1000 : undefined }];
  });
}

export function quoteIsStale(quote: LiveQuote, now = Date.now()) {
  return !quote.updatedAt || now - quote.updatedAt > 180_000;
}