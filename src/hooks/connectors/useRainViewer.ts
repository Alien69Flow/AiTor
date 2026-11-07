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

  const tileUrl = useMemo(() => {
    if (!latestFrame) return null;
    // {z}/{x}/{y}/{size}/{color}/{smooth}_{snow}.png
    //
    // 512 px y suavizado: la tesela de 256 con la red de radares real se veía a
    // bloques al acercarse, sobre todo en el borde de cada célula. Al doblar el
    // tamaño y pedir `smooth` (el 1 final de `1_1`) la mancha de lluvia queda
    // continua, que es como se lee un radar de verdad.
    return `${state.data.host}${latestFrame.path}/512/{z}/{x}/{y}/4/1_1.png`;
  }, [state.data.host, latestFrame]);

  return { ...state, latestFrame, tileUrl };
}
