/** Types for `live-probe.mjs`, consumed by `verify-live-signals.ts`. */

export type ProbeOutcome = "live" | "offline" | "unknown";

export interface ProbeResult {
  id: string;
  embeddable: boolean | null;
  thumbnail: boolean | null;
  live: boolean | null;
  http: { oembed: number | null; thumb: number | null; watch: number | null };
  note: string | null;
}

export interface ProbeDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export declare const LIVE: "live";
export declare const OFFLINE: "offline";
export declare const UNKNOWN: "unknown";

export declare function oembedUrl(videoId: string): string;
export declare function watchUrl(videoId: string): string;
export declare function thumbUrl(videoId: string): string;
export declare function probeSignal(
  signal: { id: string; videoId: string },
  deps?: ProbeDeps,
): Promise<ProbeResult>;
export declare function classifyProbe(probe: ProbeResult): ProbeOutcome;
export declare function looksLikeNetworkFailure(results: ProbeResult[], threshold?: number): boolean;
export declare function renderStatusModule(
  checkedOn: string,
  checkedAtIso: string,
  results: ProbeResult[],
): string;
