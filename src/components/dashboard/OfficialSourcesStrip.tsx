import { useState } from "react";
import { ExternalLink, ShieldCheck, History } from "lucide-react";
import {
  HISTORIC_CASES,
  LIVE_SIGNALS,
  OFFICIAL_SOURCES,
  SOURCE_KIND_LABEL,
  type SourceKind,
} from "@/lib/live-signals";

const KIND_ORDER: SourceKind[] = ["official", "data", "research", "archive"];

function Chip({ label, url, desc }: { label: string; url: string; desc: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={desc}
      className="flex shrink-0 items-center gap-1 border border-cyan-400/20 bg-cyan-500/5 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-300/75 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
    >
      {label}
      <ExternalLink className="h-2 w-2" aria-hidden="true" />
    </a>
  );
}

interface OfficialSourcesStripProps {
  className?: string;
}

/**
 * Sources first, inside the live monitor: the official agencies, the archives
 * and the live data feeds that back every signal. This block belongs to the
 * Alien workspace only — the chat keeps its space for the conversation.
 */
export function OfficialSourcesStrip({ className = "" }: OfficialSourcesStripProps) {
  const [kind, setKind] = useState<SourceKind | "all">("all");
  const cameras = LIVE_SIGNALS.length;
  const officialCount = LIVE_SIGNALS.filter((signal) => signal.official).length;
  const filtered = kind === "all" ? OFFICIAL_SOURCES : OFFICIAL_SOURCES.filter((source) => source.kind === kind);

  return (
    <section aria-label="Fuentes oficiales" className={`flex flex-col gap-2 border border-cyan-400/20 bg-cyan-500/[0.04] p-2.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-cyan-300/80" aria-hidden="true" />
        <h3 className="font-heading text-[10px] uppercase tracking-widest text-cyan-200/85">Fuentes oficiales</h3>
        <span className="font-mono text-[9px] text-muted-foreground/55">
          {OFFICIAL_SOURCES.length} fuentes · {officialCount} cámaras oficiales · {cameras} cámaras en total
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setKind("all")}
            aria-pressed={kind === "all"}
            className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
              kind === "all"
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                : "border-border/40 text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {KIND_ORDER.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setKind(entry)}
              aria-pressed={kind === entry}
              className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                kind === entry
                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                  : "border-border/40 text-muted-foreground/70 hover:text-foreground"
              }`}
            >
              {SOURCE_KIND_LABEL[entry]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((source) => (
          <Chip key={source.label} label={source.label} url={source.url} desc={source.desc} />
        ))}
      </div>
    </section>
  );
}

/** Historical record: documented cases with the archive that holds each file. */
export function HistoricCasesStrip({ className = "" }: { className?: string }) {
  return (
    <section aria-label="Registro histórico" className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-secondary/70" aria-hidden="true" />
        <h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/70">Registro histórico</h3>
        <span className="font-mono text-[9px] text-muted-foreground/45">{HISTORIC_CASES.length} casos documentados</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {HISTORIC_CASES.map((entry) => (
          <a
            key={entry.id}
            href={entry.archiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-[228px] shrink-0 flex-col gap-1 border border-border/40 bg-card/40 p-2.5 transition-colors hover:border-secondary/40 hover:bg-card/60"
            title={entry.note}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-secondary/80">{entry.year}</span>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-secondary/70" aria-hidden="true" />
            </div>
            <span className="truncate font-heading text-[11px] uppercase tracking-wide text-foreground/85">{entry.title}</span>
            <span className="truncate font-mono text-[9px] text-muted-foreground/55">{entry.place}</span>
            <span className="line-clamp-2 font-mono text-[9px] leading-4 text-muted-foreground/45">{entry.note}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
