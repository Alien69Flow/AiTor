import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  TELEGRAM_CHAT_URL,
  isRunningInTelegram,
  openTelegram,
  telegramStartParam,
  webLinkFromTelegram,
} from "@/lib/telegram";

/**
 * Fila "Puente Telegram" de la tarjeta de acceso del panel System.
 * Muestra la acción que corresponde a la superficie actual: desde la web se
 * continúa en la Mini App (marcada con `startapp=web`), y desde Telegram se
 * vuelve a la web (marcada con `?source=telegram`).
 */
export function TelegramBridge() {
  const inTelegram = isRunningInTelegram();

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/25 pt-3">
      <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
        <Send className="h-3 w-3 text-primary/70" aria-hidden="true" />
        Puente Telegram
      </span>

      {inTelegram ? (
        <>
          <span className="font-mono text-[9px] text-secondary/80">Abierto en @Alien69Bot</span>
          <a
            href={webLinkFromTelegram()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            Seguir en la web
          </a>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => openTelegram("web")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2AABEE]/40 bg-[#2AABEE]/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-[#2AABEE] transition-colors hover:bg-[#2AABEE]/20"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Continuar en Telegram
          </button>
          <a
            href={TELEGRAM_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[9px] text-primary/60 transition-colors hover:text-primary"
          >
            chat del bot <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </>
      )}
    </div>
  );
}

/**
 * Se monta una vez en App: avisa cuando la llegada viene de Telegram
 * (`?source=telegram`) o cuando la Mini App se abrió desde la web
 * (`startapp=web`), y limpia el parámetro de la URL.
 */
export function TelegramArrivalNotice() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("source") === "telegram") {
      toast.success("Conexión con Telegram activa", {
        description: "Has llegado desde @Alien69Bot; continúa en el terminal.",
      });
      const next = new URLSearchParams(searchParams);
      next.delete("source");
      setSearchParams(next, { replace: true });
      return;
    }

    if (isRunningInTelegram() && telegramStartParam() === "web") {
      toast.success("Continuando desde la web", {
        description: "Abriste Ai Tor desde aitor.alienflow.space dentro de Telegram.",
      });
    }
    // Solo al montar: el aviso no debe repetirse en cada cambio de URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
