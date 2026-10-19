import { useCallback, useEffect, useState } from "react";
import { DAOS } from "@/lib/ecosystem";

/**
 * Reads the two Aragon DAOs straight from Polygon through public JSON-RPC.
 * No API key, no backend: the browser proves the treasury exists and shows its
 * native balance. If every endpoint is unreachable the rows say so instead of
 * pretending the DAO is offline.
 */

const RPC_ENDPOINTS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon-rpc.com",
  "https://rpc.ankr.com/polygon",
];

const TIMEOUT_MS = 8000;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: unknown = null;
  for (const url of RPC_ENDPOINTS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`RPC ${response.status}`);
      const payload = (await response.json()) as { result?: T; error?: { message?: string } };
      if (payload.error) throw new Error(payload.error.message ?? "RPC error");
      if (payload.result === undefined) throw new Error("RPC sin resultado");
      return payload.result;
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RPC no disponible");
}

/** 18-decimal native balance -> "1,234.5678". */
export function formatNative(hexWei: string, decimals = 4): string {
  try {
    const wei = BigInt(hexWei);
    const base = 10n ** 18n;
    const whole = wei / base;
    const fraction = (wei % base).toString().padStart(18, "0").slice(0, decimals).replace(/0+$/, "");
    const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction ? `${wholeText}.${fraction}` : wholeText;
  } catch {
    return "—";
  }
}

export interface DaoTreasuryRow {
  id: string;
  balancePol: string | null;
  isContract: boolean | null;
  error: string | null;
}

export function useDaoTreasury(pollMs = 120_000) {
  const [rows, setRows] = useState<DaoTreasuryRow[]>(
    DAOS.map((dao) => ({ id: dao.id, balancePol: null, isContract: null, error: null })),
  );
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next: DaoTreasuryRow[] = [];

    for (const dao of DAOS) {
      try {
        const [balanceHex, code] = await Promise.all([
          rpc<string>("eth_getBalance", [dao.address, "latest"]),
          rpc<string>("eth_getCode", [dao.address, "latest"]),
        ]);
        next.push({
          id: dao.id,
          balancePol: formatNative(balanceHex),
          isContract: code !== "0x",
          error: null,
        });
      } catch (error) {
        next.push({
          id: dao.id,
          balancePol: null,
          isContract: null,
          error: error instanceof Error ? error.message : "RPC no disponible",
        });
      }
    }

    try {
      const blockHex = await rpc<string>("eth_blockNumber", []);
      setBlockNumber(Number.parseInt(blockHex, 16));
    } catch {
      setBlockNumber(null);
    }

    setRows(next);
    setUpdatedAt(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { rows, blockNumber, loading, updatedAt, refresh };
}
