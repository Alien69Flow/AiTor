import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Crosshair, Brain, RotateCcw, ExternalLink, Trophy } from "lucide-react";
import { PRODUCTS } from "@/lib/ecosystem";
import {
	IMPULSE_POINTS,
	MEMORY_NODES,
	MEMORY_WIN_LENGTH,
	extendSequence,
	impulseBonus,
	impulseVerdict,
	memoryVerdict,
	nextTarget,
	readBest,
	saveBest,
	type ImpulseVerdict,
} from "@/lib/mini-games";

const ECOSYSTEM = ["ace", "adex", "atrip", "dao"]
	.map((id) => PRODUCTS.find((product) => product.id === id))
	.filter((product): product is (typeof PRODUCTS)[number] => Boolean(product));

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

function Panel({
	title,
	icon,
	hint,
	children,
}: {
	title: string;
	icon: React.ReactNode;
	hint: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-card/60 p-4">
			<header className="mb-3 flex items-start justify-between gap-2">
				<div>
					<h2 className="flex items-center gap-2 font-heading text-xs uppercase tracking-widest text-primary">
						{icon}
						{title}
					</h2>
					<p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{hint}</p>
				</div>
			</header>
			{children}
		</section>
	);
}

/* ---------------------------- Pulso orbital ------------------------------ */

function ImpulseGame() {
	const [position, setPosition] = useState(0);
	const [target, setTarget] = useState(50);
	const [score, setScore] = useState(0);
	const [streak, setStreak] = useState(0);
	const [lives, setLives] = useState(3);
	const [running, setRunning] = useState(false);
	const [verdict, setVerdict] = useState<ImpulseVerdict | null>(null);
	const [best, setBest] = useState(() => readBest("impulse"));
	const direction = useRef(1);

	// El indicador va y viene por la barra. Se para al terminar la partida y al
	// desmontar, para no dejar un temporizador girando en segundo plano.
	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => {
			setPosition((current) => {
				const next = current + direction.current * 2.5;
				if (next >= 100) return 100;
				if (next <= 0) return 0;
				return next;
			});
		}, 16);
		return () => window.clearInterval(id);
	}, [running]);

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
		setRunning(true);
	}, []);

	const strike = useCallback(() => {
		if (!running) return;
		const result = impulseVerdict(position, target);
		setVerdict(result);
		if (result === "fail") {
			const left = lives - 1;
			setLives(left);
			setStreak(0);
			if (left <= 0) {
				setRunning(false);
				setBest(saveBest("impulse", score));
			}
		} else {
			const nextStreak = streak + 1;
			setStreak(nextStreak);
			const total = score + IMPULSE_POINTS[result] + impulseBonus(nextStreak);
			setScore(total);
			setBest(saveBest("impulse", total));
		}
		setTarget((previous) => nextTarget(previous, Math.random));
	}, [running, position, target, lives, streak, score]);

	// Barra espaciadora = pulso, para no depender del ratón.
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

	const windowStart = Math.max(0, target - 5);
	const windowWidth = Math.min(10, 100 - windowStart);

	return (
		<Panel
			title="Pulso orbital"
			icon={<Crosshair className="h-3.5 w-3.5" />}
			hint="Detén el pulso dentro de la ventana. Tres fallos y se acaba."
		>
			<div className="relative mb-3 h-8 overflow-hidden rounded border border-border/60 bg-muted/20">
				<div
					className="absolute inset-y-0 bg-primary/20"
					style={{ left: `${windowStart}%`, width: `${windowWidth}%` }}
				/>
				<div
					className="absolute inset-y-0 flex items-center justify-center"
					style={{ left: `${windowStart}%`, width: `${windowWidth}%` }}
				>
					<div className="h-full w-px bg-primary/70" />
				</div>
				<div
					className="absolute inset-y-0 w-0.5 bg-secondary shadow-[0_0_8px] shadow-secondary"
					style={{ left: `${position}%` }}
				/>
			</div>

			<div className="mb-3 grid grid-cols-3 gap-2 font-mono text-[10px] text-muted-foreground/80">
				<span>
					Puntos <strong className="text-foreground">{score}</strong>
				</span>
				<span>
					Racha <strong className="text-foreground">{streak}</strong>
				</span>
				<span>
					Vidas <strong className="text-foreground">{lives}</strong>
				</span>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{!running ? (
					<button
						onClick={start}
						className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary/20"
					>
						{lives <= 0 || score > 0 ? "Otra vez" : "Empezar"}
					</button>
				) : (
					<button
						onClick={strike}
						className="rounded border border-secondary/50 bg-secondary/10 px-3 py-1.5 font-mono text-[11px] text-secondary transition-colors hover:bg-secondary/20"
					>
						Pulso (espacio)
					</button>
				)}
				{verdict && (
					<span className={`font-mono text-[11px] ${VERDICT_CLASS[verdict]}`}>
						{VERDICT_LABEL[verdict]}
					</span>
				)}
				<span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60">
					<Trophy className="h-3 w-3" /> {best}
				</span>
			</div>
		</Panel>
	);
}

/* --------------------------- Memoria de nodos ---------------------------- */

type MemoryStatus = "idle" | "showing" | "input" | "over" | "won";

function MemoryGame() {
	const [sequence, setSequence] = useState<number[]>([]);
	const [inputs, setInputs] = useState<number[]>([]);
	const [active, setActive] = useState<number | null>(null);
	const [status, setStatus] = useState<MemoryStatus>("idle");
	const [best, setBest] = useState(() => readBest("memory"));
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
				timers.current.push(
					window.setTimeout(() => setActive(node), index * 620),
				);
				timers.current.push(
					window.setTimeout(() => setActive(null), index * 620 + 380),
				);
			});
			timers.current.push(
				window.setTimeout(() => setStatus("input"), next.length * 620),
			);
		},
		[clearTimers],
	);

	const start = useCallback(() => {
		const first = extendSequence([], MEMORY_NODES);
		setSequence(first);
		setBest(saveBest("memory", 0));
		show(first);
	}, [show]);

	const press = useCallback(
		(node: number) => {
			if (status !== "input") return;
			const next = [...inputs, node];
			setInputs(next);
			const verdict = memoryVerdict(sequence, next);
			if (verdict === "wrong") {
				clearTimers();
				setStatus("over");
				setBest(saveBest("memory", sequence.length - 1));
				return;
			}
			if (verdict === "complete") {
				if (sequence.length >= MEMORY_WIN_LENGTH) {
					setStatus("won");
					setBest(saveBest("memory", sequence.length));
					return;
				}
				const grown = extendSequence(sequence, MEMORY_NODES);
				setSequence(grown);
				window.setTimeout(() => show(grown), 420);
			}
		},
		[status, inputs, sequence, show, clearTimers],
	);

	const round = Math.max(0, sequence.length - 1);

	return (
		<Panel
			title="Memoria de nodos"
			icon={<Brain className="h-3.5 w-3.5" />}
			hint={`Repite la secuencia. Ronda ${round} de ${MEMORY_WIN_LENGTH}.`}
		>
			<div className="mb-3 grid grid-cols-3 gap-2">
				{Array.from({ length: MEMORY_NODES }, (_, node) => (
					<button
						key={node}
						onClick={() => press(node)}
						disabled={status !== "input"}
						aria-label={`Nodo ${node + 1}`}
						className={`h-12 rounded border font-mono text-[11px] transition-colors ${
							active === node
								? "border-primary bg-primary/40 text-foreground"
								: "border-border/60 bg-muted/20 text-muted-foreground/70 hover:border-secondary/50"
						} disabled:cursor-not-allowed`}
					>
						{node + 1}
					</button>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground/80">
				<span>
					{status === "idle" && "Pulsa empezar"}
					{status === "showing" && "Mirando…"}
					{status === "input" && `Tu turno: ${inputs.length}/${sequence.length}`}
					{status === "over" && "Fallaste"}
					{status === "won" && "Ronda máxima"}
				</span>
				<button
					onClick={start}
					className="ml-auto flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 text-[11px] text-primary transition-colors hover:bg-primary/20"
				>
					<RotateCcw className="h-3 w-3" />
					{status === "idle" ? "Empezar" : "Reiniciar"}
				</button>
				<span className="flex items-center gap-1 text-muted-foreground/60">
					<Trophy className="h-3 w-3" /> {best}
				</span>
			</div>
		</Panel>
	);
}

/* --------------------------------- pestaña ------------------------------- */

export function GamesTab() {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-5">
			<header className="mb-4">
				<h1 className="flex items-center gap-2 font-heading text-sm uppercase tracking-widest text-primary">
					<Gamepad2 className="h-4 w-4" />
					Juegos · ACE
				</h1>
				<p className="mt-1 max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground/70">
					Arcarde del ecosistema. Dos juegos que corren enteros en el navegador —sin
					servidor ni clave— y las marcas se guardan en este dispositivo.
				</p>
			</header>

			<div className="grid min-h-0 gap-3 lg:grid-cols-2">
				<ImpulseGame />
				<MemoryGame />
			</div>

			<footer className="mt-4 rounded-lg border border-border/40 bg-card/40 p-3">
				<h2 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/70">
					El ecosistema donde viven
				</h2>
				<div className="mt-2 flex flex-wrap gap-2">
					{ECOSYSTEM.map((product) => (
						<a
							key={product.id}
							href={product.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1.5 rounded border border-border/60 bg-muted/20 px-2.5 py-1.5 font-mono text-[10px] text-foreground/80 transition-colors hover:border-secondary/50 hover:text-secondary"
						>
							{product.name}
							<ExternalLink className="h-2.5 w-2.5" />
						</a>
					))}
				</div>
			</footer>
		</div>
	);
}
