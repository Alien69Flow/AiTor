import { useEffect, useState } from "react";
import { PricingModal } from "./PricingModal";
import { PAYWALL_EVENT } from "@/hooks/useCredits";

export function GlobalPaywall() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ reason?: string }>).detail;
      setReason(detail?.reason);
      setOpen(true);
    };
    window.addEventListener(PAYWALL_EVENT, handler);
    return () => window.removeEventListener(PAYWALL_EVENT, handler);
  }, []);

  return <PricingModal open={open} onClose={() => setOpen(false)} reason={reason} />;
}