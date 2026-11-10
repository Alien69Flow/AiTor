import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { readArcadeBest, saveArcadeBest } from "@/lib/arcade-best";
import {
	ROAD_LANES,
	chickenCrossed,
	chickenScore,
	chickenStart,
	chickenStep,
	trafficAt,
	type ChickenMove,
	type ChickenState,
} from "@/lib/arcade-racers";
import { ArcadeCard } from "./ArcadeCard";

/**
 * Cruce alienígena: la travesía de carriles, con tráfico determinista.
 *
 * El tráfico no se sortea aquí: `trafficAt(seed, tick)` devuelve los mismos
 * coches para el mismo instante, así que morir o cruzar depende de la jugada y
 * no del reloj de cada equipo.
 */
export function CruceGame({ seed = 11 }: { seed?: number }) {
	const [run, setRun] = useState<ChickenState>(() => chickenStart());
	const [tick, setTick] = useState(0);
	const [best, setBest] = useState(() => readArcadeBest("cruce-alien"));

	useEffect(() => {
		const timer = window.setInterval(() => setTick((value) => value + 1), 700);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (run.alive && !chickenCrossed(run)) return;
		setBest(saveArcadeBest("cruce-alien", chickenScore(run)));
	}, [run]);

	const move = useCallback(
		(direction: ChickenMove) => {
			setRun((current) => chickenStep(current, direction, trafficAt(seed, tick)));
		},
		[seed, tick],
	);

	const start = () => {
		setRun(chickenStart());
		setTick(0);
	};

	const cars = trafficAt(seed, tick);
	const fila = (row: number) => `${((ROAD_LANES - row) / (ROAD_LANES + 1)) * 100}%`;

	return (
		<ArcadeCard
			title="Cruce alienígena"
			hint="Cruza los nueve carriles sin tocar un coche; llegar suma 500."
			icon={<Shield className="h-3.5 w-3.5" />}
			best={best}
		>
			<div className="relative mb-3 h-40 overflow-hidden rounded border border-border/60 bg-muted/15">
				{Array.from({ length: ROAD_LANES }, (_, index) => (
					<div
						key={`lane-${index}`}
						className="absolute inset-x-0 h-[9%] border-y border-border/20 bg-border/10"
						style={{ top: fila(index + 1) }}
					/>
				))}
				{cars.map((car, index) => (
					<div
						key={`car-${index}`}
						className="absolute h-[7%] w-4 -translate-x-1/2 rounded-sm bg-accent/60"
						style={{ left: `${car.x * 100}%`, top: fila(car.lane) }}
					/>
				))}
				<div
					className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary"
					style={{ left: `${run.x * 100}%`, top: fila(run.row) }}
				/>
				<p className="absolute bottom-1 left-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
					fila {Math.min(run.row, ROAD_LANES)}/{ROAD_LANES} · {run.hops} saltos
				</p>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={start}
					className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					{run.hops > 0 || !run.alive ? "Otra vez" : "Empezar"}
				</button>
				<button onClick={() => move("left")} className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80">
					←
				</button>
				<button onClick={() => move("up")} className="rounded border border-secondary/50 bg-secondary/10 px-2 py-1.5 font-mono text-[10px] text-secondary">
					↑
				</button>
				<button onClick={() => move("down")} className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80">
					↓
				</button>
				<button onClick={() => move("right")} className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80">
					→
				</button>
				<span aria-live="polite" className="font-mono text-[9px] text-muted-foreground/55">
					{!run.alive
						? `Atropellado con ${chickenScore(run)} puntos`
						: chickenCrossed(run)
							? `Cruzaste con ${chickenScore(run)} puntos`
							: "Salta antes de que llegue el coche"}
				</span>
			</div>
		</ArcadeCard>
	);
}
