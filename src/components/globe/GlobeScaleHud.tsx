import { Minus, MousePointerClick, MoveHorizontal, Plus } from "lucide-react";
import {
  ZOOM_MAX_ALTITUDE_M,
  ZOOM_MIN_ALTITUDE_M,
  describeView,
  formatAltitude,
  formatArc,
  formatDistance,
  horizonArcMetres,
  nextZoomAltitude,
  scaleBar,
  viewSpan,
  zoomProgress,
  zoomRangeLabel,
} from "@/lib/globe-scale";

/** Lo que la cámara reporta en cada movimiento (metros por píxel en el centro). */
export interface ViewScale {
  altitudeM: number;
  metresPerPixel: number;
  viewportWidthPx: number;
  /** Campo de visión vertical de la cámara, para acotar la vista al horizonte. */
  fovYRad?: number;
  aspectRatio?: number;
  /** `true` cuando no se pudo proyectar sobre el globo y se usó el campo de visión. */
  estimated: boolean;
}

interface GlobeScaleHudProps {
  scale: ViewScale;
  className?: string;
  /** Un paso de acercamiento. Sin handler no se pintan los botones. */
  onZoomIn?: () => void;
  /** Un paso de alejamiento. */
  onZoomOut?: () => void;
}

const BAR_MAX_PX = 132;

/**
 * Barra de escala real del globo, con la altura de cámara y la pista de zoom.
 *
 * Sin esto no hay forma de saber cuánto se ha ampliado: el globo se ve igual de
 * «grande» a 2 000 km que a 200 km, y el usuario no sabe si puede seguir
 * acercándose. La barra se recalcula con la distancia sobre el elipsoide bajo el
 * centro de la pantalla, así que siempre representa kilómetros reales.
 */
export function GlobeScaleHud({ scale, className = "", onZoomIn, onZoomOut }: GlobeScaleHudProps) {
  const bar = scaleBar(scale.metresPerPixel, BAR_MAX_PX);
  // La superficie visible no crece sin fin con la altura: llega hasta el
  // horizonte. `viewSpan` usa la medición real de píxeles y la recorta con la
  // geometría del planeta, así que el número no miente al alejar la cámara.
  const span = viewSpan({
    altitudeM: scale.altitudeM,
    metresPerPixel: scale.metresPerPixel,
    viewportWidthPx: scale.viewportWidthPx,
    fovYRad: scale.fovYRad,
    aspect: scale.aspectRatio,
  });
  const progress = Math.round(zoomProgress(scale.altitudeM) * 100);
  // En los topes no hay paso posible: mejor un botón apagado que uno que no
  // hace nada y deja al usuario dudando de si el globo está roto.
  const canZoomIn = nextZoomAltitude(scale.altitudeM, "in") !== null;
  const canZoomOut = nextZoomAltitude(scale.altitudeM, "out") !== null;
  const showControls = Boolean(onZoomIn || onZoomOut);
  const zoomButton =
    "pointer-events-auto flex h-5 w-5 items-center justify-center border border-cyan-400/30 bg-background/80 text-cyan-200 transition-colors hover:border-cyan-300/70 hover:bg-cyan-400/15 disabled:cursor-default disabled:border-cyan-400/15 disabled:text-cyan-200/25";

  return (
    <div
      className={`pointer-events-none select-none font-mono ${className}`}
      role="group"
      aria-label="Escala del globo y control de zoom"
    >
      <div className="max-w-[248px] border border-cyan-400/25 bg-background/75 px-2 py-1.5 shadow-[0_0_18px_rgba(34,211,238,0.10)] backdrop-blur-md">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="flex h-1.5 items-end" aria-hidden="true">
              {bar ? (
                <>
                  <span className="h-1.5 w-px bg-cyan-300/80" />
                  <span
                    className="h-px flex-1 bg-cyan-300/80"
                    style={{ width: `${bar.pixels}px` }}
                  />
                  <span className="h-1.5 w-px bg-cyan-300/80" />
                </>
              ) : (
                <span className="h-px w-[132px] bg-cyan-300/40" />
              )}
            </span>
            <span className="text-[10px] leading-none text-cyan-100" data-testid="globe-scale-label">
              {bar ? bar.label : "—"}
            </span>
          </div>
          <span className="ml-auto flex items-center gap-1 text-[8px] uppercase tracking-wider text-cyan-300/70">
            <MoveHorizontal className="h-2.5 w-2.5" aria-hidden="true" />
            {describeView(scale.altitudeM, { fovYRad: scale.fovYRad, aspect: scale.aspectRatio })}
          </span>

          {showControls && (
            <span className="ml-1 flex flex-col gap-0.5" title={`Rango de zoom: ${zoomRangeLabel()}`}>
              <button
                type="button"
                onClick={onZoomIn}
                disabled={!canZoomIn}
                aria-label="Acercar"
                title={`Acercar · hasta ${formatAltitude(ZOOM_MIN_ALTITUDE_M)}`}
                className={zoomButton}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onZoomOut}
                disabled={!canZoomOut}
                aria-label="Alejar"
                title={`Alejar · hasta ${formatAltitude(ZOOM_MAX_ALTITUDE_M)}`}
                className={zoomButton}
              >
                <Minus className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          )}
        </div>

        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] leading-3 text-muted-foreground">
          <div className="flex justify-between gap-1">
            <dt className="text-muted-foreground/60">Altura</dt>
            <dd className="text-foreground/80">{formatAltitude(scale.altitudeM)}</dd>
          </div>
          <div
            className="flex justify-between gap-1"
            title={
              span.clippedByHorizon
                ? `Toda la superficie que deja ver el horizonte a esta altura: ${formatDistance(horizonArcMetres(scale.altitudeM))}. Alejarse más no enseña más Tierra.`
                : `Arco de superficie que abarca la pantalla: ${formatArc(span.degrees)}.`
            }
          >
            <dt className="text-muted-foreground/60">Vista</dt>
            <dd className="text-foreground/80" data-testid="globe-span-value">
              {formatDistance(span.metres)}
              <span className="ml-1 text-muted-foreground/50">{formatArc(span.degrees)}</span>
            </dd>
          </div>
        </dl>

        <div className="mt-1 flex items-center gap-1 text-[8px] leading-3 text-cyan-200/60">
          <MousePointerClick className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          <span>
            Rueda o pellizco para acercar · {zoomRangeLabel()}
          </span>
        </div>

        {/* Barra de progreso del rango de zoom: deja ver que queda margen. */}
        <div
          className="mt-1 h-0.5 w-full bg-cyan-400/15"
          role="progressbar"
          aria-label="Acercamiento disponible"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full bg-cyan-300/70" style={{ width: `${progress}%` }} />
        </div>

        {scale.estimated && (
          <p className="mt-1 text-[7px] leading-3 text-amber-300/70">
            Escala estimada (el centro de la vista no apunta al globo).
          </p>
        )}
      </div>
    </div>
  );
}
