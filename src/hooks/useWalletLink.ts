import { useCallback, useEffect, useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type LinkState = "idle" | "loading" | "verified" | "error";

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "No fue posible verificar la wallet";
}

export function useWalletLink() {
  const { user } = useAuth();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");
  const [state, setState] = useState<LinkState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !address) {
      setState("idle");
      return false;
    }
    const database = supabase as any;
    const { data, error: lookupError } = await database
      .from("wallet_identities")
      .select("verified_at")
      .eq("user_id", user.id)
      .eq("address", address.toLowerCase())
      .not("verified_at", "is", null)
      .maybeSingle();
    if (lookupError) {
      setError("No fue posible consultar el estado de la wallet");
      return false;
    }
    const verified = Boolean(data?.verified_at);
    setState(verified ? "verified" : "idle");
    return verified;
  }, [address, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkWallet = useCallback(async () => {
    if (!user) throw new Error("Inicia sesión antes de verificar tu wallet");
    if (!isConnected || !address || !walletProvider) {
      throw new Error("Conecta una wallet EVM antes de verificarla");
    }

    setState("loading");
    setError(null);
    try {
      const chainHex = await walletProvider.request({ method: "eth_chainId" });
      const chainNumber = typeof chainHex === "string" ? Number.parseInt(chainHex, 16) : Number.NaN;
      if (!Number.isSafeInteger(chainNumber) || chainNumber <= 0) {
        throw new Error("No fue posible identificar la red de la wallet");
      }
      const chainId = `eip155:${chainNumber}`;
      const walletAddress = address.toLowerCase();
      const { data: challenge, error: challengeError } = await supabase.functions.invoke<{
        id: string;
        message: string;
      }>("wallet-link", {
        body: { action: "challenge", address: walletAddress, chain_id: chainId },
      });
      if (challengeError || !challenge?.id || !challenge.message) {
        throw new Error(challengeError?.message || "No fue posible crear la verificación");
      }

      const signature = await walletProvider.request({
        method: "personal_sign",
        params: [challenge.message, walletAddress],
      });
      if (typeof signature !== "string") throw new Error("La wallet no devolvió una firma válida");

      const { error: verificationError } = await supabase.functions.invoke("wallet-link", {
        body: {
          action: "verify",
          address: walletAddress,
          chain_id: chainId,
          challenge_id: challenge.id,
          signature,
        },
      });
      if (verificationError) throw new Error(verificationError.message);

      setState("verified");
      return true;
    } catch (caught) {
      const message = readableError(caught);
      setError(message);
      setState("error");
      throw new Error(message);
    }
  }, [address, isConnected, user, walletProvider]);

  return {
    linkWallet,
    refresh,
    isVerified: state === "verified",
    isLinking: state === "loading",
    error,
  };
}
