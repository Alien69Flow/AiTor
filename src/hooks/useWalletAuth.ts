import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { supabase } from "@/integrations/supabase/client";

/** Sign-in with Ethereum: wallet signature -> real backend session. */
export function useWalletAuth() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setError(null);
    if (!isConnected || !address) {
      open();
      return false;
    }
    setBusy(true);
    try {
      const nonce = crypto.randomUUID();
      const issuedAt = new Date().toISOString();
      const message =
        `${window.location.host} quiere verificar tu wallet para AI Tor.\n\n` +
        `Wallet: ${address}\nNonce: ${nonce}\nFecha: ${issuedAt}`;
      const signature = await signMessageAsync({ message, account: address as `0x${string}` });

      const { data, error: fnError } = await supabase.functions.invoke("wallet-auth", {
        body: { address, message, signature },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.email || !data?.token_hash) throw new Error(data?.error || "No se pudo iniciar sesión");

      const { error: otpError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: data.token_hash,
      });
      if (otpError) throw new Error(otpError.message);
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(raw.includes("User rejected") ? "Firma cancelada en la wallet." : raw);
      return false;
    } finally {
      setBusy(false);
    }
  }, [address, isConnected, open, signMessageAsync]);

  return { signIn, busy, error, isConnected, address };
}
