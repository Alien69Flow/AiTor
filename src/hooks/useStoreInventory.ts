import { useCallback, useState } from "react";

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number; // in base unit (cents or smallest denomination)
  currency: "USD" | "ETH" | "USDC";
  imageUrl?: string;
  /** 0-100 score of relevance/availability */
  availability: number;
  /** Optional: on-chain contract address for ERC-20/1155 */
  contractAddress?: string;
  metadata?: Record<string, unknown>;
}

export type StoreSearchResult = {
  success: boolean;
  products: Product[];
  error?: string;
  executedAt: Date;
  totalFound: number;
};

/**
 * Simple connector hook for product catalog queries.
 *
 * In a real deployment you would wire this to:
 * - A Supabase edge function querying Shopify/SQLite
 * - A GraphQL endpoint (Saleor, CommerceHQ, etc.)
 * - An on-chain marketplace (OpenSea / Blur data via TheGraph)
 *
 * For now it returns graceful empty results with guidance.
 */
export function useStoreInventory() {
  const [loading, setLoading] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<StoreSearchResult | null>(null);

  const search = useCallback(
    async (query: string, options?: { maxResults?: number; currency?: "USD" | "ETH" | "USDC" }): Promise<StoreSearchResult> => {
      setLoading(true);
      setLastResult({ success: false, products: [], error: "", executedAt: new Date(), totalFound: 0 });

      try {
        // Demo/placeholder: treat the query as a token/currency hint and return
        // a static set of example products so the UI has something to render.
        // In production replace the body of this try block with a real fetch.
        await new Promise((r) => setTimeout(r, 600)); // simulate network

        const normalizedQuery = String(query).toLowerCase();
        const currency: "USD" | "ETH" | "USDC" = options?.currency ?? "USD";

        // A few example products that make sense for "AI Tor / DAO" themed demo
        const examples: Product[] = [
          {
            id: "p1",
            name: "AI Tor Oracle License",
            description: "Access to ΔlieπFlΦw neural core for 1 month",
            price: 4900, // $49.00
            currency,
            availability: 95,
          },
          {
            id: "p2",
            name: "AlienFlow DAO Membership NFT",
            description: "Governance token + voting rights",
            price: 1200, // $12.00
            currency,
            availability: 88,
          },
          {
            id: "p3",
            name: "GDELT Daily Brief",
            description: "Curated OSINT summary, delivered email",
            price: 0,
            currency,
            availability: 70,
          },
        ];

        // Very cheap filter: if query mentions a term, keep matching products
        const filtered = query
          ? examples.filter((p) =>
              p.name.toLowerCase().includes(normalizedQuery) || (p.description && p.description.toLowerCase().includes(normalizedQuery)),
            )
          : examples;

        const result: StoreSearchResult = {
          success: true,
          products: filtered.slice(0, (options?.maxResults ?? 10)),
          error: undefined,
          executedAt: new Date(),
          totalFound: filtered.length,
        };
        setLastResult(result);
        return result;
      } catch (err) {
        console.error("Store inventory search error:", err);
        const result: StoreSearchResult = {
          success: false,
          products: [],
          error: err instanceof Error ? err.message : "Unknown error",
          executedAt: new Date(),
          totalFound: 0,
        };
        setLastResult(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getProduct = useCallback(
    async (productId: string): Promise<Product | null> => {
      setLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 300));
        // In real code: fetch `/api/store/product/${productId}`
        // For now return null to indicate not implemented yet
        setLoading(false);
        return null;
      } catch (err) {
        setLoading(false);
        console.error("Get product error:", err);
        return null;
      }
    },
    [],
  );

  return {
    loading,
    lastResult,
    search,
    getProduct,
  };
}