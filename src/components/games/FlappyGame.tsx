import { useEffect, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { readArcadeBest, saveArcadeBest } from "@/lib/arcade-best";
import { FLAPPY, createFlappy, stepFlappy, type FlappyState } from "@/lib/flappy";
import { ArcadeCard } from "./ArcadeCard";

/**
 * OVNI Flappy: el pájaro de siempre con un platillo.
 *
 * El motor ya trocea el tiempo en pasos de 1/120 s, así que aquí basta con
 * llamarlo cada fotograma: el aleteo se consume una sola vez y no se repite
 * mientras la tecla sigue pulsada.
 */
export function FlappyGame({ seed = 7 }: { seed?: number }) {
	const [run, setRun] = useState<FlappyState>(() => createFlappy(seed));
	const [best, setBest] = useState(() => readArcadeBest("ovni-flappy"));
	const [playing, setPlaying] = useState(false);
	const flap = useRef(false);

	useEffect(() => {
		if (!playing) return;
		const timer = window.setInterval(() => {
			setRun((current) => {
				const next = stepFlappy(current, 1 / 60, flap.current);
				flap.current = false;
				return next;
			});
		}, 1000 / 60);
		return () => window.clearInterval(timer);
	}, [playing]);

	useEffect(() => {
		if (run.alive) return;
		setPlaying(false);
		setBest(saveArcadeBest("ovni-flappy", run.score * 10));
	}, [run]);

	const start = () => {
		setRun(createFlappy((Date.now() % 10_000) + 1));
		flap.current = false;
		setPlaying(true);
	};

	const aletear = () => {
		if (playing) flap.current = true;
	};

	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if (event.code !== "Space" && event.code !== "ArrowUp") return;
			event.preventDefault();
			if (playing) flap.current = true;
		};
		window.addEventListener("keydown", down);
		return () => window.removeEventListener("keydown", down);
	}, [playing]);

	return (
		<ArcadeCard
			title="OVNI Flappy"
			hint="Aletea para pasar entre los restos de la estación; cada hueco vale 10 puntos."
			icon={<Rocket className="h-3.5 w-3.5" />}
			best={best}
		>
			<button
				type="button"
				onPointerDown={aletear}
				onClick={aletear}
				className="relative mb-3 h-40 overflow-hidden rounded border border-border/60 bg-muted/15"
				aria-label="Aletear"
			>
				{run.pipes.map((pipe, index) => {
					const topEnd = pipe.gapY - FLAPPY.gap / 2;
					const bottomStart = pipe.gapY + FLAPPY.gap / 2;
					return (
						<div
							key={`${index}-${Math.round(pipe.gapY)}`}
							className="absolute inset-y-0"
							style={{ left: `${(pipe.x / FLAPPY.width) * 100}%`, width: "14%" }}
						>
							<div
								className="absolute left-0 right-0 top-0 bg-accent/45"
								style={{ height: `${(topEnd / FLAPPY.height) * 100}%` }}
							/>
							<div
								className="absolute bottom-0 left-0 right-0 bg-accent/45"
								style={{ height: `${((FLAPPY.height - bottomStart) / FLAPPY.height) * 100}%` }}
							/>
						</div>
					);
				})}
				<div
					className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_8px] shadow-secondary"
					style={{ left: "50%", top: `${(run.y / FLAPPY.height) * 100}%` }}
				/>
			</button>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={start}
					className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					{run.elapsed > 0 || !run.alive ? "Otra vez" : "Empezar"}
				</button>
				<span className="font-mono text-[10px] text-muted-foreground/60">
					{run.score} huecos
				</span>
				<span aria-live="polite" className="font-mono text-[9px] text-muted-foreground/55">
					{!run.alive
						? `Choque con ${run.score * 10} puntos`
						: playing
							? "Espacio o tocar para aletear"
							: "Pulsa empezar"}
				</span>
			</div>
		</ArcadeCard>
	);
}
