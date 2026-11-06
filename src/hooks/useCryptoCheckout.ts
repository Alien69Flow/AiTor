import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_CYCLES,
  ERC20_TRANSFER_ABI,
  PAY_CHAINS,
  resolvePaymentRecipient,
  type BillingCycle,
  type PayChain,
  type PayToken,
} from "@/lib/web3/payments";

export type CheckoutStage = "idle" | "resolving" | "signing" | "verifying" | "done" | "error";

export function useCryptoCheckout() {
  const { open } = useAppKit();
  const { isConnected, chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [stage, setStage] = useState<CheckoutStage>("idle");
  const [message, setMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const pay = useCallback(
    async (cycle: BillingCycle, chain: PayChain, token: PayToken) => {
      setTxHash(null);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setStage("error");
        setMessage("Conecta tu wallet o inicia sesión para asociar el pago a tu cuenta.");
        return;
      }
      if (!isConnected) {
        open();
        return;
      }

      const target = PAY_CHAINS[chain];
      const tokenInfo = target.tokens[token];
      const amount = BILLING_CYCLES[cycle].price;

      try {
        setStage("resolving");
        setMessage(`Resolviendo dirección de cobro en ${target.label}…`);
        const recipient = await resolvePaymentRecipient(chain);

        if (chainId !== target.id) {
          setMessage(`Cambia a la red ${target.label} en tu wallet…`);
          await switchChainAsync({ chainId: target.id });
        }

        setStage("signing");
        setMessage(`Confirma el envío de ${amount} ${token} en tu wallet…`);
        const hash = await writeContractAsync({
          abi: ERC20_TRANSFER_ABI,
          address: tokenInfo.address,
          functionName: "transfer",
          args: [recipient.address, parseUnits(String(amount), tokenInfo.decimals)],
          chainId: target.id,
          account: address as `0x${string}`,
          chain: undefined,
        });
        setTxHash(hash);

        setStage("verifying");
        setMessage("Verificando la transacción en la red…");
        const { data, error } = await supabase.functions.invoke("verify-crypto-payment", {
          body: { txHash: hash, chain, token, cycle, plan: "synapse", wallet: address },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "No se pudo verificar el pago");

        setStage("done");
        setMessage("Plan SYNAPSE activado. ¡Bienvenido al Nexo Soberano!");
      } catch (error) {
        setStage("error");
        const raw = error instanceof Error ? error.message : String(error);
        setMessage(raw.includes("User rejected") ? "Pago cancelado en la wallet." : raw);
      }
    },
    [isConnected, chainId, address, open, switchChainAsync, writeContractAsync],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setMessage("");
    setTxHash(null);
  }, []);

  return { pay, stage, message, txHash, reset, isConnected, address };
}
