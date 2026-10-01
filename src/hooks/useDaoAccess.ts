import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { supabase } from "@/integrations/supabase/client";

export interface HoldingsResult {
  tier: "oracle" | "quantum" | null;
  nft: boolean;
  tokens: Record<string, string>;
  message: string;
}

/** Verifies DAO NFT / token holdings on-chain and unlocks Oracle or Quantum. */
export function useDaoAccess() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HoldingsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setError(null);
    setResult(null);
    if (!isConnected || !address) {
      open();
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError("Inicia sesión (social o wallet) para vincular el acceso a tu cuenta.");
      return;
    }
    setBusy(true);
    try {
      const nonce = crypto.randomUUID();
      const message = `Verificar holdings AlienFlowSpace DAO\nWallet: ${address}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });
      const { data, error: fnError } = await supabase.functions.invoke("verify-dao-holdings", {
        body: { address, message, signature },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setResult(data as HoldingsResult);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(raw.includes("User rejected") ? "Firma cancelada en la wallet." : raw);
    } finally {
      setBusy(false);
    }
  }, [address, isConnected, open, signMessageAsync]);

  return { verify, busy, result, error, isConnected, address };
}
