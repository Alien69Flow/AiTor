import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { readArcadeBest, saveArcadeBest } from "@/lib/arcade-best";
import {
	KART_LAPS,
	KART_LAP_LENGTH,
	kartCurve,
	kartFinished,
	kartScore,
	kartStart,
	kartStep,
	type KartState,
} from "@/lib/arcade-racers";
import { ArcadeCard } from "./ArcadeCard";

/**
 * Kart orbital: dos vueltas con deriva sobre el asfalto.
 *
 * La curva la decide `kartCurve` por tramo y la deriva la calcula el motor; el
 * componente sólo traduce teclas a volante y pinta el resultado.
 */
export function KartGame({ seed = 3 }: { seed?: number }) {
	const [run, setRun] = useState<KartState>(() => kartStart());
	const [best, setBest] = useState(() => readArcadeBest("kart-orbital"));
	const [playing, setPlaying] = useState(false);
	const [steer, setSteer] = useState<-1 | 0 | 1>(0);
	const [brake, setBrake] = useState(false);

	useEffect(() => {
		if (!playing) return;
		const timer = window.setInterval(() => {
			setRun((current) => {
				const curve = kartCurve(seed, Math.floor(current.distance / 240));
				return kartStep(current, { steer, brake }, curve, 1 / 60);
			});
		}, 1000 / 60);
		return () => window.clearInterval(timer);
	}, [playing, steer, brake, seed]);

	useEffect(() => {
		if (!kartFinished(run)) return;
		setPlaying(false);
		setBest(saveArcadeBest("kart-orbital", kartScore(run)));
	}, [run]);

	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if (event.code === "ArrowLeft" || event.code === "KeyA") setSteer(-1);
			if (event.code === "ArrowRight" || event.code === "KeyD") setSteer(1);
			if (event.code === "ArrowDown" || event.code === "KeyS") setBrake(true);
		};
		const up = () => {
			setSteer(0);
			setBrake(false);
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, []);

	const start = () => {
		setRun(kartStart());
		setSteer(0);
		setBrake(false);
		setPlaying(true);
	};

	const total = KART_LAPS * KART_LAP_LENGTH;
	const avance = Math.max(0, Math.min(100, (run.distance / total) * 100));
	const posicion = Math.max(0, Math.min(100, 50 + run.drift * 40));

	return (
		<ArcadeCard
			title="Kart orbital"
			hint="Corrige la deriva contra las curvas; salirse pierde velocidad."
			icon={<Zap className="h-3.5 w-3.5" />}
			best={best}
		>
			<div className="relative mb-3 h-20 overflow-hidden rounded border border-border/60 bg-muted/20">
				<div className="absolute inset-x-4 top-1/2 h-8 -translate-y-1/2 rounded bg-border/25" />
				<div
					className="absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-primary shadow-[0_0_8px] shadow-primary"
					style={{ left: `${posicion}%` }}
				/>
				<p className="absolute bottom-1 left-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
					vuelta {Math.min(run.lap, KART_LAPS)}/{KART_LAPS} · {Math.round(run.speed)} m/s · {Math.round(avance)}%
				</p>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={start}
					className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					{kartFinished(run) ? "Otra vez" : "Empezar"}
				</button>
				<button
					onPointerDown={() => setSteer(-1)}
					onPointerUp={() => setSteer(0)}
					onPointerLeave={() => setSteer(0)}
					className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80"
				>
					←
				</button>
				<button
					onPointerDown={() => setSteer(1)}
					onPointerUp={() => setSteer(0)}
					onPointerLeave={() => setSteer(0)}
					className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80"
				>
					→
				</button>
				<span aria-live="polite" className="font-mono text-[9px] text-muted-foreground/55">
					{kartFinished(run)
						? `Meta con ${kartScore(run)} puntos`
						: Math.abs(run.drift) > 0.9
							? "Fuera de pista"
							: playing
								? "Flechas para el volante"
								: "Pulsa empezar"}
				</span>
			</div>
		</ArcadeCard>
	);
}
