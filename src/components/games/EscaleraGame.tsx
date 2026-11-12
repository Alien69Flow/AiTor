import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { readArcadeBest, saveArcadeBest } from "@/lib/arcade-best";
import {
	advancePlatformer,
	createPlatformer,
	platformerScore,
	type PlatformerInput,
	type PlatformerState,
} from "@/lib/platformer";
import { ArcadeCard } from "./ArcadeCard";

const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"];

/**
 * Escalera orbital: el plataformas del arcade.
 *
 * El componente no decide física: el motor avanza en pasos de 1/60 s y aquí se
 * le da uno por fotograma del reloj. Así un tirón del navegador no atraviesa
 * plataformas, que es justo lo que la prueba de `platformer.ts` vigila.
 */
export function EscaleraGame({ seed = 1 }: { seed?: number }) {
	const [run, setRun] = useState<PlatformerState>(() => createPlatformer(seed));
	const [best, setBest] = useState(() => readArcadeBest("escalera-orbital"));
	const [playing, setPlaying] = useState(false);
	const input = useRef<PlatformerInput>({ left: false, right: false, jump: false });

	useEffect(() => {
		if (!playing) return;
		const timer = window.setInterval(() => {
			setRun((current) => advancePlatformer(current, input.current, 1));
		}, 1000 / 60);
		return () => window.clearInterval(timer);
	}, [playing]);

	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if (LEFT_KEYS.includes(event.code)) input.current.left = true;
			if (RIGHT_KEYS.includes(event.code)) input.current.right = true;
			if (JUMP_KEYS.includes(event.code)) {
				event.preventDefault();
				input.current.jump = true;
			}
		};
		const up = (event: KeyboardEvent) => {
			if (LEFT_KEYS.includes(event.code)) input.current.left = false;
			if (RIGHT_KEYS.includes(event.code)) input.current.right = false;
			if (JUMP_KEYS.includes(event.code)) input.current.jump = false;
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, []);

	useEffect(() => {
		if (!run.over) return;
		setPlaying(false);
		setBest(saveArcadeBest("escalera-orbital", platformerScore(run)));
	}, [run]);

	const start = () => {
		setRun(createPlatformer((Date.now() % 10_000) + 1));
		input.current = { left: false, right: false, jump: false };
		setPlaying(true);
	};

	const viewTop = run.runner.y + 14;
	const topOf = (y: number) => `${((viewTop - y) / 20) * 100}%`;

	return (
		<ArcadeCard
			title="Escalera orbital"
			hint="Salta de plataforma en plataforma; caer termina la partida."
			icon={<Crosshair className="h-3.5 w-3.5" />}
			best={best}
		>
			<div className="relative mb-3 h-40 overflow-hidden rounded border border-border/60 bg-muted/15">
				{run.platforms.map((platform) => (
					<div
						key={platform.id}
						className="absolute h-1.5 rounded-sm bg-primary/60"
						style={{ left: `${platform.x}%`, top: topOf(platform.y), width: `${platform.w}%` }}
					/>
				))}
				<div
					className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-full rounded-full bg-secondary shadow-[0_0_8px] shadow-secondary"
					style={{ left: `${run.runner.x}%`, top: topOf(run.runner.y) }}
				/>
				<p className="absolute bottom-1 left-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
					{run.reached.length - 1} plataformas · {Math.floor(run.best)} m
				</p>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={start}
					className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					{run.reached.length > 1 || run.over ? "Otra vez" : "Empezar"}
				</button>
				<button
					onPointerDown={() => (input.current.left = true)}
					onPointerUp={() => (input.current.left = false)}
					onPointerLeave={() => (input.current.left = false)}
					className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80"
				>
					←
				</button>
				<button
					onPointerDown={() => (input.current.right = true)}
					onPointerUp={() => (input.current.right = false)}
					onPointerLeave={() => (input.current.right = false)}
					className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80"
				>
					→
				</button>
				<button
					onPointerDown={() => (input.current.jump = true)}
					onPointerUp={() => (input.current.jump = false)}
					onPointerLeave={() => (input.current.jump = false)}
					className="rounded border border-secondary/50 bg-secondary/10 px-2 py-1.5 font-mono text-[10px] text-secondary"
				>
					Saltar
				</button>
				<span aria-live="polite" className="font-mono text-[9px] text-muted-foreground/55">
					{run.over
						? `Caíste con ${platformerScore(run)} puntos`
						: playing
							? "Flechas para moverse, espacio para saltar"
							: "Pulsa empezar"}
				</span>
			</div>
		</ArcadeCard>
	);
}
