import { useEffect, useRef, useState } from "react";
import { RotateCcw, Target } from "lucide-react";
import { ArcadeCard } from "./ArcadeCard";
import { SOCCER, createSoccer, soccerScore, soccerStep, type SoccerInput, type SoccerState } from "@/lib/head-soccer";

const TICK_MS = 33;

/**
 * Head soccer: el motor mueve a los tres cuerpos y aquí sólo se pinta.
 *
 * El `dt` que se le pasa es el del reloj del intervalo, acotado dentro del
 * motor: si la pestaña se queda atrás, el paso se recorta y nadie atraviesa la
 * pelota de un fotograma a otro.
 */
export function HeadSoccerGame({
	best = 0,
	onRun,
}: {
	best?: number;
	onRun?: (score: number) => void;
}) {
	const [state, setState] = useState<SoccerState>(() => createSoccer((Date.now() % 3000) + 1));
	const [running, setRunning] = useState(false);
	const [marca, setMarca] = useState(best);
	const input = useRef<SoccerInput>({ left: false, right: false, jump: false });
	const reported = useRef(false);

	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => {
			setState((current) => soccerStep(current, input.current, TICK_MS / 1000));
		}, TICK_MS);
		return () => window.clearInterval(id);
	}, [running]);

	useEffect(() => {
		if (!state.over || reported.current) return;
		reported.current = true;
		setRunning(false);
		const score = soccerScore(state);
		setMarca((value) => Math.max(value, score));
		onRun?.(score);
	}, [state, onRun]);

	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if (event.code === "ArrowLeft" || event.code === "KeyA") input.current.left = true;
			if (event.code === "ArrowRight" || event.code === "KeyD") input.current.right = true;
			if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
				event.preventDefault();
				input.current.jump = true;
			}
		};
		const up = (event: KeyboardEvent) => {
			if (event.code === "ArrowLeft" || event.code === "KeyA") input.current.left = false;
			if (event.code === "ArrowRight" || event.code === "KeyD") input.current.right = false;
			if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") input.current.jump = false;
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, []);

	const start = () => {
		setState(createSoccer((Date.now() % 3000) + 1));
		input.current = { left: false, right: false, jump: false };
		reported.current = false;
		setRunning(true);
	};

	const press = (key: keyof SoccerInput, value: boolean) => {
		input.current[key] = value;
	};

	const at = (value: number, total: number) => `${(value / total) * 100}%`;

	return (
		<ArcadeCard
			title="Head soccer"
			hint="Tres goles o cuarenta y cinco segundos. El rival corre y salta como tú, sin trampas."
			icon={<Target className="h-3.5 w-3.5" />}
			best={marca}
		>
			<div className="mb-3 flex items-center gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
					{state.score[0]}–{state.score[1]}
				</span>
				<span>{Math.ceil(state.clock)} s</span>
				<span className="ml-auto" aria-live="polite">
					{state.over
						? state.winner === 0
							? "Ganas"
							: state.winner === 1
								? "Pierdes"
								: "Empate"
						: running
							? "En juego"
							: "Listo"}
				</span>
			</div>

			<div
				className="relative mb-3 h-40 overflow-hidden rounded border border-border/60 bg-muted/15"
				aria-label="Campo de head soccer"
				role="img"
			>
				<span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/50" />
				<span className="absolute bottom-0 left-0 h-1/4 w-1 border-l-2 border-primary/70" />
				<span className="absolute bottom-0 right-0 h-1/4 w-1 border-r-2 border-accent/70" />

				<span
					className="absolute h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary"
					style={{ left: at(state.you.x, SOCCER.width), bottom: at(state.you.y, SOCCER.height) }}
				/>
				<span
					className="absolute h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-destructive"
					style={{ left: at(state.rival.x, SOCCER.width), bottom: at(state.rival.y, SOCCER.height) }}
				/>
				<span
					className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border border-accent bg-accent/80"
					style={{ left: at(state.ball.x, SOCCER.width), bottom: at(state.ball.y, SOCCER.height) }}
				/>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onPointerDown={() => press("left", true)}
					onPointerUp={() => press("left", false)}
					onPointerLeave={() => press("left", false)}
					disabled={!running}
					className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
				>
					←
				</button>
				<button
					onPointerDown={() => press("jump", true)}
					onPointerUp={() => press("jump", false)}
					onPointerLeave={() => press("jump", false)}
					disabled={!running}
					className="rounded border border-secondary/60 px-3 py-1.5 font-mono text-[10px] text-secondary disabled:opacity-40"
				>
					saltar
				</button>
				<button
					onPointerDown={() => press("right", true)}
					onPointerUp={() => press("right", false)}
					onPointerLeave={() => press("right", false)}
					disabled={!running}
					className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
				>
					→
				</button>
				<button
					onClick={start}
					className="ml-auto flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary"
				>
					<RotateCcw className="h-3 w-3" /> {running ? "Reiniciar" : "Salir al campo"}
				</button>
			</div>
		</ArcadeCard>
	);
}
