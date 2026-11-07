import { describe, it, expect } from "vitest";
import { parseLiveQuotes, quoteIsStale } from "./live-quotes";

describe("real market quotes", () => {
  it("does not fabricate BTC when the provider returns no quote", () => {
    expect(parseLiveQuotes({}, { bitcoin: "BTC" })).toEqual([]);
  });
  it("preserves the provider BTC price and timestamp", () => {
    expect(parseLiveQuotes({ bitcoin: { usd: 75871, usd_24h_change: 0.88, last_updated_at: 1000 } }, { bitcoin: "BTC" })).toEqual([{ id: "bitcoin", symbol: "BTC", price: 75871, change24h: 0.88, updatedAt: 1000000 }]);
  });
  it("rejects null and zero prices", () => {
    expect(parseLiveQuotes({ bitcoin: { usd: null }, ethereum: { usd: 0 } }, { bitcoin: "BTC", ethereum: "ETH" })).toEqual([]);
  });
  it("marks quotes without a source time as stale", () => {
    expect(quoteIsStale({ id: "bitcoin", symbol: "BTC", price: 75871, change24h: 0 }, 1000000)).toBe(true);
  });
});