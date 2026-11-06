import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink, Loader2, MapPin, Radio, RefreshCw, Tv, Volume2, VolumeX, Youtube, ShieldCheck, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { describePlayerError, loadYouTubeIframeApi, type YouTubePlayerLike } from "@/lib/youtube-iframe";
import { signalThumb, type LiveSignal } from "@/lib/live-signals";

type StageStatus = "loading" | "ready" | "error";

interface LiveStageProps {
  signal: LiveSignal;
  /** Reason already recorded for this signal, if a previous attempt failed. */
  blockedReason?: string | null;
  onUnavailable: (signal: LiveSignal, reason: string) => void;
  /** El reproductor arrancó: la cámara emite, aunque el informe semanal diga que no. */
  onLive?: (signal: LiveSignal) => void;
}

/**
 * One player, one stream at a time. The player is created through the official
 * IFrame API so failures are caught and explained instead of leaving a black
 * box: an embed that answers "unavailable" or "embedding not allowed" raises
 * onError, which switches this component to its fallback with real links.
 */
export function LiveStage({ signal, blockedReason, onUnavailable, onLive }: LiveStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerLike | null>(null);
  // `onReady` sólo dice que el reproductor se montó: un directo que aún no ha
  // arrancado también lo dispara. La cámara se declara emitiendo cuando el
  // estado pasa a PLAYING, para no retirar la marca de «sin emisión» de un canal
  // que sigue apagado.
  const liveReportedRef = useRef(false);
  const confirmLive = useCallback(() => {
    if (liveReportedRef.current) return;
    liveReportedRef.current = true;
    onLive?.(signal);
  }, [onLive, signal]);
  const [status, setStatus] = useState<StageStatus>(blockedReason ? "error" : "loading");
  const [reason, setReason] = useState<string | null>(blockedReason ?? null);
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const handleError = useCallback(
    (message: string) => {
      setStatus("error");
      setReason(message);
      onUnavailable(signal, message);
    },
    [onUnavailable, signal]
  );

  useEffect(() => {
    // El motivo guardado es solo el punto de partida: «Reintentar» lo ignora y
    // vuelve a montar el reproductor, que es la única forma de descubrir que la
    // cámara ha vuelto a emitir.
    if (blockedReason && attempt === 0) {
      setStatus("error");
      setReason(blockedReason);
      return;
    }

    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    liveReportedRef.current = false;
    setStatus("loading");
    setReason(null);

    const host = document.createElement("div");
    host.className = "h-full w-full";

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        mount.replaceChildren(host);
        const player = new YT.Player(host, {
          videoId: signal.videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              event.target.mute();
              event.target.playVideo();
              setStatus("ready");
              // Segundo intento por si el evento de estado llegó antes que
              // `onReady`: si el reproductor ya está reproduciendo, emite.
              window.setTimeout(() => {
                if (!cancelled && event.target.getPlayerState?.() === 1) confirmLive();
              }, 2500);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === 1) confirmLive();
            },
            onError: (event) => {
              if (cancelled) return;
              handleError(describePlayerError(event.data));
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (cancelled) return;
        handleError("No se pudo cargar el reproductor de YouTube (sin conexión o bloqueado).");
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // The API throws if the player never finished mounting.
      }
      playerRef.current = null;
      mount.replaceChildren();
    };
  }, [signal, blockedReason, handleError, attempt, confirmLive]);

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (muted) player.unMute();
      else player.mute();
      setMuted(!muted);
    } catch {
      // Player not ready yet; the next click will work.
    }
  };

  const watchUrl = `https://www.youtube.com/watch?v=${signal.videoId}`;
  const channelLiveUrl = signal.channelId ? `https://www.youtube.com/channel/${signal.channelId}/live` : null;
  const showFallback = status === "error";

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "min(100%, calc((100vh - 330px) * 16 / 9))" }}>
      <div className="border border-border/60 bg-card/50">
        {/* Own chrome lives above the frame: the YouTube player draws its title,
            progress bar and buttons in the same corners, so overlaying there only
            produces collisions. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-2 py-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                status === "ready" && signal.liveAtBuild
                  ? "border-destructive/50 bg-destructive/20 text-destructive-foreground"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status === "ready" && signal.liveAtBuild ? "animate-pulse bg-red-400" : "bg-amber-400"}`} />
              {status === "error" ? "Sin señal" : status === "ready" ? (signal.liveAtBuild ? "En directo" : "En espera") : "Conectando"}
            </span>
            <span
              className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                signal.official ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-border/60 text-muted-foreground"
              }`}
            >
              {signal.official ? <ShieldCheck className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
              {signal.official ? "Oficial" : "Colaborador"}
            </span>
            <span className="min-w-0 truncate font-heading text-[11px] uppercase tracking-wider text-foreground">{signal.label}</span>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
              <span>{signal.source}</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                {signal.location}
              </span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {status === "ready" && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={toggleMute}
                aria-label={muted ? "Activar sonido" : "Silenciar"}
                title={muted ? "Activar sonido" : "Silenciar"}
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
            )}
            {channelLiveUrl && (
              <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                <a href={channelLiveUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir el canal en directo" title="Canal en directo">
                  <Radio className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-7 w-7" asChild>
              <a href={watchUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir en YouTube" title="Abrir en YouTube">
                <Youtube className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <div ref={mountRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />

          {status !== "ready" && (
            <div className="absolute inset-0">
              <img
                src={signalThumb(signal)}
                alt=""
                aria-hidden="true"
                className={`h-full w-full object-cover ${showFallback ? "opacity-25 blur-sm" : "opacity-45"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            </div>
          )}

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Conectando con {signal.source}…
            </p>
          </div>
        )}

        {showFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
            <Tv className="h-6 w-6 text-amber-400/80" aria-hidden="true" />
            <div className="max-w-md">
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber-300">Emisión no disponible</p>
              <p className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">{reason}</p>
              {signal.liveAtBuild ? null : (
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/60">
                  Este canal emite por eventos: {signal.note ?? "vuelve más tarde o abre el canal en directo."}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px]" onClick={() => setAttempt((value) => value + 1)}>
                <RefreshCw className="h-3 w-3" /> Reintentar
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px]" asChild>
                <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                  <Youtube className="h-3 w-3" /> Ver en YouTube
                </a>
              </Button>
              {channelLiveUrl && (
                <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px]" asChild>
                  <a href={channelLiveUrl} target="_blank" rel="noopener noreferrer">
                    <Radio className="h-3 w-3" /> Canal en directo
                  </a>
                </Button>
              )}
              {signal.pageUrl !== watchUrl && (
                <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px]" asChild>
                  <a href={signal.pageUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Fuente oficial
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        </div>
      </div>

      {signal.note && !showFallback && (
        <p className="mt-1.5 font-mono text-[9px] leading-4 text-muted-foreground/70">{signal.note}</p>
      )}
    </div>
  );
}
