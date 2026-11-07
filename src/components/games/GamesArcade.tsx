import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Crosshair, RotateCcw, Trophy, Zap } from "lucide-react";
import {
	IMPULSE_POINTS,
	IMPULSE_TOLERANCE,
	MEMORY_NODES,
	MEMORY_WIN_LENGTH,
	extendSequence,
	impulseBonus,
	impulseVerdict,
	memoryVerdict,
	nextTarget,
	type GameId,
	type ImpulseVerdict,
} from "@/lib/mini-games";

const VERDICT_LABEL: Record<ImpulseVerdict, string> = {
	perfect: "Perfecto",
	good: "Bien",
	fail: "Fallaste",
};

const VERDICT_CLASS: Record<ImpulseVerdict, string> = {
	perfect: "text-primary",
	good: "text-secondary",
	fail: "text-destructive",
};

/** Envoltorio común: misma jerarquía en los dos juegos. */
function GameCard({
	title,
	hint,
	icon,
	badge,
	best,
	children,
}: {
	title: string;
	hint: string;
	icon: React.ReactNode;
	badge?: string;
	best: number;
	children: React.ReactNode;
}) {
	return (
		<section className="flex min-h-0 flex-col rounded-xl border border-border/50 bg-card/50">
			<header className="flex items-start gap-2 border-b border-border/40 px-3 py-2.5">
				<span className="mt-0.5 text-primary">{icon}</span>
				<div className="min-w-0 flex-1">
					<h2 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-widest text-foreground/90">
						{title}
						{badge && (
							<span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-accent">
								{badge}
							</span>
						)}
					</h2>
					<p className="mt-0.5 font-mono text-[9px] leading-relaxed text-muted-foreground/55">{hint}</p>
				</div>
				<span className="flex shrink-0 items-center gap-1 font-mono text-[9px] text-muted-foreground/50">
					<Trophy className="h-3 w-3" />
					{best}
				</span>
			</header>
			<div className="flex flex-1 flex-col p-3">{children}</div>
		</section>
	);
}

/* ---------------------------- Pulso orbital ------------------------------ */

export function ImpulseGame({
	tolerance = IMPULSE_TOLERANCE,
	speed = 1,
	best,
	badge,
	onRun,
}: {
	tolerance?: number;
	speed?: number;
	best: number;
	badge?: string;
	onRun: (game: GameId, score: number) => void;
}) {
	const [position, setPosition] = useState(0);
	const [target, setTarget] = useState(50);
	const [score, setScore] = useState(0);
	const [streak, setStreak] = useState(0);
	const [lives, setLives] = useState(3);
	const [running, setRunning] = useState(false);
	const [verdict, setVerdict] = useState<ImpulseVerdict | null>(null);
	const direction = useRef(1);
	/** La partida ya se reportó: evita sumar dos veces al perder en el mismo turno. */
	const reported = useRef(false);

	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => {
			setPosition((current) => {
				const next = current + direction.current * 2.5 * speed;
				if (next >= 100) return 100;
				if (next <= 0) return 0;
				return next;
			});
		}, 16);
		return () => window.clearInterval(id);
	}, [running, speed]);

	useEffect(() => {
		if (position >= 100) direction.current = -1;
		else if (position <= 0) direction.current = 1;
	}, [position]);

	const start = useCallback(() => {
		setScore(0);
		setStreak(0);
		setLives(3);
		setVerdict(null);
		setPosition(0);
		direction.current = 1;
		setTarget(nextTarget(50, Math.random));
		reported.current = false;
		setRunning(true);
	}, []);

	const strike = useCallback(() => {
		if (!running) return;
		const result = impulseVerdict(position, target, tolerance);
		setVerdict(result);
		if (result === "fail") {
			const left = lives - 1;
			setLives(left);
			setStreak(0);
			if (left <= 0) {
				setRunning(false);
				if (!reported.current) {
					reported.current = true;
					onRun("impulse", score);
				}
			}
		} else {
			const nextStreak = streak + 1;
			setStreak(nextStreak);
			setScore(score + IMPULSE_POINTS[result] + impulseBonus(nextStreak));
		}
		setTarget((previous) => nextTarget(previous, Math.random));
	}, [running, position, target, tolerance, lives, streak, score, onRun]);

	useEffect(() => {
		if (!running) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.code === "Space") {
				event.preventDefault();
				strike();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [running, strike]);

	const windowStart = Math.max(0, Math.min(100 - tolerance, target - tolerance / 2));
	const perfectWidth = tolerance / 3;

	return (
		<GameCard
			title="Pulso orbital"
			hint="Detén el indicador dentro de la ventana. Tres fallos y se acaba."
			icon={<Crosshair className="h-3.5 w-3.5" />}
			badge={badge}
			best={best}
		>
			<div className="relative mb-3 h-10 overflow-hidden rounded border border-border/60 bg-muted/20">
				{/* Ventana de acierto, y dentro la franja perfecta. */}
				<div
					className="absolute inset-y-0 bg-primary/15"
					style={{ left: `${windowStart}%`, width: `${tolerance}%` }}
				/>
				<div
					className="absolute inset-y-0 -translate-x-1/2 bg-primary/30"
					style={{ left: `${target}%`, width: `${perfectWidth}%` }}
				/>
				<div className="absolute inset-x-0 top-1/2 h-px bg-border/60" />
				<div
					className="absolute inset-y-0 w-0.5 bg-secondary shadow-[0_0_8px] shadow-secondary"
					style={{ left: `${position}%` }}
				/>
			</div>

			<div className="mb-3 grid grid-cols-4 gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span>
					Puntos <strong className="block text-[11px] text-foreground">{score}</strong>
				</span>
				<span>
					Racha <strong className="block text-[11px] text-foreground">{streak}</strong>
				</span>
				<span>
					Vidas <strong className="block text-[11px] text-foreground">{lives}</strong>
				</span>
				<span>
					Ventana <strong className="block text-[11px] text-foreground">{tolerance}</strong>
				</span>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				{!running ? (
					<button
						onClick={start}
						className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
					>
						{lives <= 0 || score > 0 ? "Otra vez" : "Empezar"}
					</button>
				) : (
					<button
						onClick={strike}
						className="rounded border border-secondary/50 bg-secondary/10 px-3 py-1.5 font-mono text-[10px] text-secondary transition-colors hover:bg-secondary/20"
					>
						Pulso (espacio)
					</button>
				)}
				<span aria-live="polite" className={`font-mono text-[10px] ${verdict ? VERDICT_CLASS[verdict] : ""}`}>
					{verdict ? VERDICT_LABEL[verdict] : ""}
				</span>
				{speed > 1 && (
					<span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-accent">
						<Zap className="h-2.5 w-2.5" /> ×{speed}
					</span>
				)}
			</div>
		</GameCard>
	);
}

/* --------------------------- Memoria de nodos ---------------------------- */

type MemoryStatus = "idle" | "showing" | "input" | "over" | "won";

export function MemoryGame({
	nodeCount = MEMORY_NODES,
	best,
	badge,
	onRun,
}: {
	nodeCount?: number;
	best: number;
	badge?: string;
	onRun: (game: GameId, score: number) => void;
}) {
	const [sequence, setSequence] = useState<number[]>([]);
	const [inputs, setInputs] = useState<number[]>([]);
	const [active, setActive] = useState<number | null>(null);
	const [status, setStatus] = useState<MemoryStatus>("idle");
	const timers = useRef<number[]>([]);

	const clearTimers = useCallback(() => {
		timers.current.forEach((id) => window.clearTimeout(id));
		timers.current = [];
	}, []);

	useEffect(() => clearTimers, [clearTimers]);

	const show = useCallback(
		(next: number[]) => {
			clearTimers();
			setStatus("showing");
			setActive(null);
			setInputs([]);
			next.forEach((node, index) => {
				timers.current.push(window.setTimeout(() => setActive(node), index * 620));
				timers.current.push(window.setTimeout(() => setActive(null), index * 620 + 380));
			});
			timers.current.push(window.setTimeout(() => setStatus("input"), next.length * 620));
		},
		[clearTimers],
	);

	const start = useCallback(() => {
		const first = extendSequence([], nodeCount);
		setSequence(first);
		show(first);
	}, [show, nodeCount]);

	const press = useCallback(
		(node: number) => {
			if (status !== "input") return;
			const next = [...inputs, node];
			setInputs(next);
			const verdict = memoryVerdict(sequence, next);
			if (verdict === "wrong") {
				clearTimers();
				setStatus("over");
				onRun("memory", sequence.length - 1);
				return;
			}
			if (verdict === "complete") {
				if (sequence.length >= MEMORY_WIN_LENGTH) {
					setStatus("won");
					onRun("memory", sequence.length);
					return;
				}
				const grown = extendSequence(sequence, nodeCount);
				setSequence(grown);
				window.setTimeout(() => show(grown), 420);
			}
		},
		[status, inputs, sequence, show, clearTimers, nodeCount, onRun],
	);

	const round = Math.max(0, sequence.length - 1);

	return (
		<GameCard
			title="Memoria de nodos"
			hint={`Repite la secuencia de ${nodeCount} nodos hasta ${MEMORY_WIN_LENGTH} rondas.`}
			icon={<Brain className="h-3.5 w-3.5" />}
			badge={badge}
			best={best}
		>
			<div className="mb-3 grid grid-cols-3 gap-2">
				{Array.from({ length: nodeCount }, (_, node) => (
					<button
						key={node}
						onClick={() => press(node)}
						disabled={status !== "input"}
						aria-label={`Nodo ${node + 1}`}
						className={`h-11 rounded border font-mono text-[11px] transition-colors ${
							active === node
								? "border-primary bg-primary/40 text-foreground"
								: "border-border/60 bg-muted/20 text-muted-foreground/70 hover:border-secondary/50"
						} disabled:cursor-not-allowed`}
					>
						{node + 1}
					</button>
				))}
			</div>

			<div className="mb-3 flex gap-1" aria-hidden="true">
				{Array.from({ length: MEMORY_WIN_LENGTH }, (_, i) => (
					<span
						key={i}
						className={`h-1 flex-1 rounded-full ${
							i < round ? "bg-primary/70" : i === round ? "bg-secondary/60" : "bg-border/50"
						}`}
					/>
				))}
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted-foreground/70">
				<span aria-live="polite">
					{status === "idle" && "Pulsa empezar"}
					{status === "showing" && "Mirando…"}
					{status === "input" && `Tu turno: ${inputs.length}/${sequence.length}`}
					{status === "over" && "Fallaste: la ronda anterior cuenta"}
					{status === "won" && "Ronda máxima alcanzada"}
				</span>
				<button
					onClick={start}
					className="ml-auto flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					<RotateCcw className="h-3 w-3" />
					{status === "idle" ? "Empezar" : "Reiniciar"}
				</button>
			</div>
		</GameCard>
	);
}
