/**
 * Minimal, typed loader for the official YouTube IFrame Player API.
 *
 * Using the API (instead of a bare <iframe>) is what lets the player report
 * its own failures: an embed can answer with "video unavailable" or with
 * "the owner does not allow embedding", and only the API surfaces that as an
 * event we can react to. Bare iframes fail silently behind a black box.
 */

export interface YouTubePlayerLike {
  destroy: () => void;
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getPlayerState: () => number;
}

export interface YouTubePlayerOptions {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubePlayerLike }) => void;
    onError?: (event: { target: YouTubePlayerLike; data: number }) => void;
    onStateChange?: (event: { target: YouTubePlayerLike; data: number }) => void;
  };
}

interface YouTubeNamespace {
  Player: new (element: HTMLElement | string, options: YouTubePlayerOptions) => YouTubePlayerLike;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let apiPromise: Promise<YouTubeNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    const timeout = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("iframe_api timeout"));
    }, 12_000);

    const finish = () => {
      if (window.YT?.Player) {
        window.clearTimeout(timeout);
        resolve(window.YT);
      }
    };

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      finish();
    };

    if (!existing) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        apiPromise = null;
        reject(new Error("iframe_api blocked"));
      };
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

/** Human-readable reason for a YouTube player error code. */
export function describePlayerError(code: number): string {
  switch (code) {
    case 2:
      return "El identificador del vídeo no es válido.";
    case 5:
      return "El reproductor HTML5 no puede mostrar este contenido.";
    case 100:
      return "El vídeo no existe o es privado.";
    case 101:
    case 150:
      return "El propietario no permite la reproducción incrustada.";
    default:
      return "El canal no está disponible en este momento.";
  }
}
