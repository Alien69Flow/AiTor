import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Shell-level connectivity indicator. Most modules poll public APIs, so an
 * offline operator needs to know the terminal is showing stale data instead of
 * an empty market/globe. Recovers automatically and flashes a short "back
 * online" confirmation.
 */
export function OfflineNotice() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [justRecovered, setJustRecovered] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const handleOnline = () => {
      setOnline(true);
      setJustRecovered(true);
      clear();
      timer.current = window.setTimeout(() => setJustRecovered(false), 4000);
    };
    const handleOffline = () => {
      clear();
      setJustRecovered(false);
      setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clear();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && !justRecovered) return null;

  const offline = !online;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 md:bottom-4"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider backdrop-blur-md ${
          offline
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : "border-primary/40 bg-primary/15 text-primary"
        }`}
      >
        {offline ? (
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {offline ? "Sin conexión · mostrando la última lectura" : "Conexión restablecida"}
      </div>
    </div>
  );
}
