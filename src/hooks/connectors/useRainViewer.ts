import { useMemo } from "react";
import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface RainViewerFrame {
  time: number;
  path: string;
}

export interface RainViewerData {
  host: string;
  frames: RainViewerFrame[];
}

interface RainViewerApi {
  host: string;
  radar?: { past?: RainViewerFrame[]; nowcast?: RainViewerFrame[] };
}

const RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json";

const EMPTY: RainViewerData = { host: "https://tilecache.rainviewer.com", frames: [] };

/**
 * RainViewer global precipitation radar.
 * Returns the latest available frame plus a Cesium/Leaflet-ready tile template.
 */
export function useRainViewer(enabled: boolean, intervalMs = 300_000) {
  const state = usePolledConnector<RainViewerData>(
    async (signal) => {
      const json = await safeFetchJson<RainViewerApi>(RAINVIEWER_URL, { signal, timeoutMs: 8000 });
      const frames = [...(json.radar?.past ?? []), ...(json.radar?.nowcast ?? [])];
      if (!frames.length) throw new Error("no radar frames");
      return { host: json.host || EMPTY.host, frames };
    },
    EMPTY,
    intervalMs,
    enabled,
  );

  const latestFrame = state.data.frames[state.data.frames.length - 1] ?? null;

  /**
   * Plantilla de tesela de un fotograma.
   *
   * {z}/{x}/{y}/{size}/{color}/{smooth}_{snow}.png
   *
   * 512 px y suavizado: la tesela de 256 con la red de radares real se veía a
   * bloques al acercarse, sobre todo en el borde de cada célula. Al doblar el
   * tamaño y pedir `smooth` (el 1 final de `1_1`) la mancha de lluvia queda
   * continua, que es como se lee un radar de verdad.
   */
  const tileUrl = useMemo(
    () => (latestFrame ? radarTileUrl(state.data.host, latestFrame) : null),
    [state.data.host, latestFrame],
  );

  /**
   * Los fotogramas de las dos últimas horas, listos para animar.
   *
   * RainViewer publica un compuesto cada 10 minutos, así que dos horas son 12
   * fotogramas más el actual. Se recorta por tiempo y no por número: si la API
   * cambia la cadencia, el recorte sigue siendo «dos horas» y no «doce
   * imágenes». `nowcast` ya no se pide —RainViewer lo retiró en enero de 2026—,
   * así que la animación es sólo pasado, que es lo que un radar puede afirmar.
   */
  const frames = useMemo(() => {
    const all = state.data.frames;
    const last = all[all.length - 1];
    if (!last) return [];
    const from = last.time - RADAR_WINDOW_SECONDS;
    return all
      .filter((frame) => frame.time >= from)
      .slice(-RADAR_MAX_FRAMES)
      .map((frame) => ({ time: frame.time, url: radarTileUrl(state.data.host, frame) }));
  }, [state.data.frames, state.data.host]);

  return { ...state, latestFrame, tileUrl, frames };
}

/**
 * Plantilla de tesela de un fotograma concreto.
 *
 * {z}/{x}/{y}/{size}/{color}/{smooth}_{snow}.png · 512 px y suavizado para que
 * la mancha de lluvia sea continua en vez de a bloques.
 */
function radarTileUrl(host: string, frame: RainViewerFrame): string {
  return `${host}${frame.path}/512/{z}/{x}/{y}/4/1_1.png`;
}

/** Ventana de la animación: dos horas de compuesto de radar. */
export const RADAR_WINDOW_SECONDS = 2 * 60 * 60;
/** Tope de fotogramas dibujables: 12 × 10 min = las dos horas pedidas. */
export const RADAR_MAX_FRAMES = 12;
