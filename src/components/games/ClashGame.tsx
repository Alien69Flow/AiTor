import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { readArcadeBest, saveArcadeBest } from "@/lib/arcade-best";
import {
	CLASH_LANES,
	clashScore,
	clashStart,
	clashTick,
	type ClashCommand,
	type ClashState,
} from "@/lib/arcade-racers";
import { ArcadeCard } from "./ArcadeCard";

/**
 * Escuadrón en carriles: el combate del pabellón.
 *
 * Las oleadas salen de la semilla y el motor decide a quién da el disparo. El
 * componente sólo pasa la orden y avanza el reloj: cada 700 ms se dispara sola,
 * así que moverse y escudarse es lo que decide la partida.
 */
export function ClashGame({ seed = 5 }: { seed?: number }) {
	const [run, setRun] = useState<ClashState>(() => clashStart());
	const [best, setBest] = useState(() => readArcadeBest("escuadron-alien"));
	const [playing, setPlaying] = useState(false);

	useEffect(() => {
		if (!playing) return;
		const timer = window.setInterval(() => {
			setRun((current) => clashTick(current, "fire", seed));
		}, 700);
		return () => window.clearInterval(timer);
	}, [playing, seed]);

	useEffect(() => {
		if (!run.over) return;
		setPlaying(false);
		setBest(saveArcadeBest("escuadron-alien", clashScore(run)));
	}, [run]);

	const command = (value: ClashCommand) => {
		if (!playing) return;
		setRun((current) => clashTick(current, value, seed));
	};

	const start = () => {
		setRun(clashStart());
		setPlaying(true);
	};

	return (
		<ArcadeCard
			title="Escuadrón en carriles"
			hint="Dispara al más cercano de tu carril; el escudo aguanta un golpe."
			icon={<Swords className="h-3.5 w-3.5" />}
			best={best}
		>
			<div className="relative mb-3 h-36 overflow-hidden rounded border border-border/60 bg-muted/15">
				{Array.from({ length: CLASH_LANES }, (_, lane) => (
					<div
						key={`clash-lane-${lane}`}
						className={`absolute inset-y-0 border-x border-border/25 ${lane === run.lane ? "bg-primary/10" : ""}`}
						style={{ left: `${(lane / CLASH_LANES) * 100}%`, width: `${100 / CLASH_LANES}%` }}
					/>
				))}
				{run.enemies.map((enemy, index) => (
					<div
						key={`enemy-${index}-${enemy.lane}`}
						className="absolute h-3 w-4 -translate-x-1/2 rounded-sm bg-destructive/60"
						style={{ left: `${((enemy.lane + 0.5) / CLASH_LANES) * 100}%`, top: `${(1 - enemy.at) * 85}%` }}
					/>
				))}
				<div
					className="absolute bottom-1 h-2 w-6 -translate-x-1/2 rounded-sm bg-secondary shadow-[0_0_8px] shadow-secondary"
					style={{ left: `${((run.lane + 0.5) / CLASH_LANES) * 100}%` }}
				/>
				<p className="absolute left-2 top-1 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
					ola {run.wave} · {run.kills} bajas · casco {run.hp}
				</p>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={start}
					className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					{run.over || run.kills > 0 ? "Otra vez" : "Empezar"}
				</button>
				<button onClick={() => command("left")} className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80">
					←
				</button>
				<button onClick={() => command("right")} className="rounded border border-border/60 px-2 py-1.5 font-mono text-[10px] text-foreground/80">
					→
				</button>
				<button onClick={() => command("fire")} className="rounded border border-secondary/50 bg-secondary/10 px-2 py-1.5 font-mono text-[10px] text-secondary">
					Fuego
				</button>
				<button onClick={() => command("shield")} className="rounded border border-accent/50 bg-accent/10 px-2 py-1.5 font-mono text-[10px] text-accent">
					Escudo
				</button>
			</div>
		</ArcadeCard>
	);
}
