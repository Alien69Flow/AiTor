/**
 * Tarjeta de mareas sobre el globo.
 *
 * Tres cosas que no puede hacer: inventar una cifra, callar un fallo y no decir
 * de dónde sale el dato. Por eso cada estado tiene su texto propio:
 *
 *  - la fuente no responde → lo dice y no enseña ninguna cifra;
 *  - el punto no está cubierto por el modelo → «sin cobertura»;
 *  - hay dato → altura, tendencia, corriente y próxima pleamar/bajamar, con
 *    fuente, cobertura y hora de actualización en el pie.
 *
 * `TidesPanel` es tonto a propósito (todo por props) para poder probar los tres
 * estados sin red; `TidesCard` es el que conecta con Open-Meteo Marine.
 */
import { ArrowDown, ArrowUp, Minus, Waves } from "lucide-react";
import { StatusBadge } from "./GlassPanels";
import { useTideLevels } from "@/hooks/connectors/useTideLevels";
import {
  compassOf,
  formatHeight,
  formatSpeed,
  TIDE_COVERAGE,
  TIDE_NATURE,
  TIDE_SOURCE,
  type TideReading,
} from "@/lib/tides";

export interface TidesPanelProps {
  readings: TideReading[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  /** Estaciones con dato; 0 con `readings` lleno significa «sin cobertura». */
  covered: number;
}

const VISIBLE = 6;

function hhmm(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function TidesPanel({ readings, loading, error, lastUpdate, covered }: TidesPanelProps) {
  const withData = readings.filter((reading) => reading.covered);
  const visible = (withData.length > 0 ? withData : readings).slice(0, VISIBLE);

  const badge = error
    ? { variant: "danger" as const, text: "SIN FUENTE" }
    : readings.length === 0 && loading
      ? { variant: "info" as const, text: "CARGANDO" }
      : covered === 0
        ? { variant: "warning" as const, text: "SIN COBERTURA" }
        : { variant: "success" as const, text: "LIVE" };

  return (
    <div
      data-testid="tides-card"
      className="absolute bottom-3 right-3 z-20 hidden w-[272px] rounded-2xl border border-slate-700/40 bg-slate-950/85 p-3 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] md:block"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Waves className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300">
            Mareas
          </span>
        </div>
        <StatusBadge variant={badge.variant}>{badge.text}</StatusBadge>
      </div>

      {error ? (
        <p className="mt-2 text-[10px] leading-relaxed text-amber-300/90">
          La fuente ({TIDE_SOURCE}) no responde. No hay cifras que enseñar y no se
          estiman: cuando vuelva, la capa se rellena sola.
        </p>
      ) : readings.length === 0 ? (
        <p className="mt-2 text-[10px] text-slate-400">
          {loading ? "Consultando Open-Meteo Marine…" : "Todavía sin datos de la fuente."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {visible.map((reading) => {
            const TrendIcon =
              reading.trend === "subiendo" ? ArrowUp : reading.trend === "bajando" ? ArrowDown : Minus;
            const compass = compassOf(reading.currentDirectionDeg);
            return (
              <li key={reading.station.id} className="space-y-0.5">
                <div className="flex items-baseline gap-2 text-[10px]">
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {reading.station.name}
                  </span>
                  {reading.covered ? (
                    <>
                      <TrendIcon
                        className={`h-3 w-3 shrink-0 ${
                          reading.trend === "subiendo"
                            ? "text-cyan-400"
                            : reading.trend === "bajando"
                              ? "text-blue-400"
                              : "text-slate-500"
                        }`}
                        aria-label={reading.trend ?? "sin tendencia"}
                      />
                      <span className="shrink-0 font-mono text-slate-200">
                        {formatHeight(reading.heightM)}
                      </span>
                    </>
                  ) : (
                    <span className="shrink-0 text-[9px] text-slate-500">sin cobertura</span>
                  )}
                </div>
                {reading.covered && (
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[9px] text-slate-500">
                    <span className="truncate">
                      corriente {formatSpeed(reading.currentKmh)} · {compass ?? "sin rumbo"}
                    </span>
                    <span className="shrink-0">
                      {reading.next
                        ? `${reading.next.kind === "pleamar" ? "▲ pleamar" : "▼ bajamar"} ${hhmm(reading.next.atIso)}`
                        : "sin próximo extremo"}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 space-y-0.5 border-t border-slate-700/30 pt-1.5 text-[9px] leading-snug text-slate-500">
        <div>Fuente: {TIDE_SOURCE} · sin clave</div>
        <div>Cobertura: {TIDE_COVERAGE}</div>
        <div>{TIDE_NATURE}</div>
        <div className="font-mono">
          {lastUpdate ? `Actualizado: ${lastUpdate.toISOString().slice(11, 16)} UTC` : "Sin actualización"}
          {readings.length > 0 ? ` · ${covered}/${readings.length} con dato` : ""}
        </div>
      </div>
    </div>
  );
}

export function TidesCard() {
  const tides = useTideLevels(true);
  return (
    <TidesPanel
      readings={tides.data.readings}
      loading={tides.loading}
      error={tides.error}
      lastUpdate={tides.lastUpdate}
      covered={tides.data.covered}
    />
  );
}
