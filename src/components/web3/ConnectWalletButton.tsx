import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";

export function ConnectWalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  const label = isConnected && address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "Wallet";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => open()}
      className={`h-7 px-2 md:px-3 text-[10px] font-heading tracking-wider uppercase transition-all ${
        isConnected
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/50"
      }`}
    >
      <Wallet className="h-3.5 w-3.5 md:mr-1" />
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}
