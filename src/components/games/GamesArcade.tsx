import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain, Crosshair, Layers, RotateCcw, Trophy, Zap } from "lucide-react";
import {
	cardLabel,
	handOutcome,
	handPoints,
	handValue,
	isBlackjack,
	playDealer,
	shuffledDeck,
	type Card,
	type HandOutcome,
} from "@/lib/card-games";
import {
	IMPULSE_POINTS,
	IMPULSE_TOLERANCE,
	MEMORY_NODES,
	MEMORY_WIN_LENGTH,
	REACTOR_ROUNDS,
	REACTOR_SECONDS,
	extendSequence,
	impulseBonus,
	impulseVerdict,
	memoryVerdict,
	nextTarget,
	reactorRound,
	reactorScore,
	reactorVerdict,
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

/**
 * Reactor de pares: el tercer juego.
 *
 * Dos números de los cuatro que se ofrecen suman el objetivo. Cada ronda tiene
 * exactamente una pareja válida (`reactorRound` lo garantiza y está probado),
 * así que esto sólo lleva el reloj, la selección y la puntuación.
 */
export function ReactorGame({
  seconds = REACTOR_SECONDS,
  rounds = REACTOR_ROUNDS,
  seed = Date.now() % 100_000,
  best,
  badge,
  onRun,
}: {
  seconds?: number;
  rounds?: number;
  seed?: number;
  best: number;
  badge?: string;
  onRun: (game: GameId, score: number) => void;
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(seconds);
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const reported = useRef(false);

  const round = useMemo(() => reactorRound(seed, roundIndex), [seed, roundIndex]);

  const finish = useCallback(
    (total: number) => {
      setPhase("done");
      if (!reported.current) {
        reported.current = true;
        onRun("reactor", total);
      }
    },
    [onRun],
  );

  // Reloj de la ronda: al llegar a cero cuenta como fallo y pasa a la siguiente.
  useEffect(() => {
    if (phase !== "playing") return;
    if (left <= 0) {
      setFlash("wrong");
      setCombo(0);
      setPicked([]);
      if (roundIndex + 1 >= rounds) {
        finish(score);
      } else {
        setRoundIndex((index) => index + 1);
        setLeft(seconds);
      }
      return;
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, left, roundIndex, rounds, score, seconds, finish]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 450);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const start = () => {
    setRoundIndex(0);
    setPicked([]);
    setScore(0);
    setCombo(0);
    setLeft(seconds);
    setFlash(null);
    reported.current = false;
    setPhase("playing");
  };

  const pick = (option: number) => {
    if (phase !== "playing" || picked.includes(option)) return;
    const next = [...picked, option];
    if (next.length < 2) {
      setPicked(next);
      return;
    }
    const verdict = reactorVerdict(next, round.target);
    if (verdict === "correct") {
      setScore((value) => value + reactorScore(left, combo));
      setCombo((value) => value + 1);
      setFlash("correct");
    } else {
      setCombo(0);
      setFlash("wrong");
    }
    setPicked([]);
    if (roundIndex + 1 >= rounds) {
      finish(verdict === "correct" ? score + reactorScore(left, combo) : score);
    } else {
      setRoundIndex((index) => index + 1);
      setLeft(seconds);
    }
  };

  return (
    <GameCard
      title="Reactor de pares"
      hint="Dos números que suman el objetivo. Reloj por ronda y combo por acierto."
      icon={<Zap className="h-3.5 w-3.5" />}
      badge={badge}
      best={best}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 ${
            flash === "correct"
              ? "border-primary bg-primary/15"
              : flash === "wrong"
                ? "border-destructive bg-destructive/10"
                : "border-accent/50 bg-accent/5"
          }`}
        >
          <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/60">
            Suma
          </span>
          <span className="font-heading text-xl text-accent">{round.target}</span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground/60">
          <span>
            Ronda{" "}
            <strong className="block text-[11px] text-foreground">
              {Math.min(roundIndex + 1, rounds)}/{rounds}
            </strong>
          </span>
          <span>
            Tiempo{" "}
            <strong className="block text-[11px] text-foreground">{Math.max(0, left)} s</strong>
          </span>
          <span>
            Puntos <strong className="block text-[11px] text-foreground">{score}</strong>
          </span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {round.options.map((option) => (
          <button
            key={option}
            onClick={() => pick(option)}
            disabled={phase !== "playing" || picked.includes(option)}
            className={`rounded border px-2 py-3 font-heading text-lg transition-colors ${
              picked.includes(option)
                ? "border-secondary/60 bg-secondary/15 text-secondary"
                : "border-border/50 bg-muted/10 text-foreground/85 hover:border-primary/40 hover:text-primary"
            } disabled:opacity-60`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {phase !== "playing" ? (
          <button
            onClick={start}
            className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
          >
            {phase === "done" ? "Otra vez" : "Empezar"}
          </button>
        ) : (
          <span className="font-mono text-[9px] text-muted-foreground/50">
            Elige dos números · combo {combo}
          </span>
        )}
        {phase === "done" && (
          <span className="font-mono text-[9px] text-muted-foreground/55">
            Partida enviada a la liga con {score} puntos
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-muted-foreground/45">
          <Trophy className="h-2.5 w-2.5" /> marca {Math.max(best, score)}
        </span>
      </div>
    </GameCard>
  );
}

/* ------------------------------- Veintiuna ------------------------------- */

const HAND_LABEL: Record<HandOutcome, string> = {
	blackjack: "Blackjack",
	win: "Mano ganada",
	push: "Empate",
	lose: "Mano perdida",
	bust: "Te pasaste",
};

const HAND_CLASS: Record<HandOutcome, string> = {
	blackjack: "text-primary",
	win: "text-secondary",
	push: "text-foreground/70",
	lose: "text-destructive",
	bust: "text-destructive",
};

/** Manos por partida: tres decisiones, no una. */
export const VEINTIUNA_HANDS = 3;

function PlayingCard({ card, hidden }: { card?: Card; hidden?: boolean }) {
	if (hidden || !card) {
		return (
			<div className="flex h-14 w-10 items-center justify-center rounded border border-border/60 bg-muted/25 font-mono text-[12px] text-muted-foreground/35">
				?
			</div>
		);
	}
	const red = card.suit === "♥" || card.suit === "♦";
	return (
		<div
			className={`flex h-14 w-10 flex-col items-center justify-center rounded border bg-card/60 font-mono ${
				red ? "border-destructive/40 text-destructive" : "border-border/60 text-foreground/85"
			}`}
		>
			<span className="text-[12px] leading-none">{cardLabel(card).slice(0, -1)}</span>
			<span className="mt-0.5 text-[10px] leading-none">{card.suit}</span>
		</div>
	);
}

/**
 * Veintiuna: cartas contra el crupier, sin apuestas.
 *
 * La baraja sale de una semilla (`shuffledDeck`) y el crupier se juega con
 * `playDealer`: el componente no decide ninguna regla, sólo reparte y pinta.
 * Una partida son tres manos; al acabar se envía el total a la liga.
 */
export function VeintiunaGame({
	hands = VEINTIUNA_HANDS,
	seed,
	best,
	badge,
	onRun,
}: {
	hands?: number;
	seed?: number;
	best: number;
	badge?: string;
	onRun: (game: GameId, score: number) => void;
}) {
	const [deck, setDeck] = useState<Card[]>([]);
	const [player, setPlayer] = useState<Card[]>([]);
	const [dealer, setDealer] = useState<Card[]>([]);
	const [hand, setHand] = useState(0);
	const [score, setScore] = useState(0);
	const [outcome, setOutcome] = useState<HandOutcome | null>(null);
	const [phase, setPhase] = useState<"idle" | "playing" | "settled" | "done">("idle");
	const [hidden, setHidden] = useState(true);
	const reported = useRef(false);

	const settleHand = useCallback(
		(playerCards: Card[], dealerCards: Card[], rest: Card[], totalSoFar: number, handIndex: number) => {
			const remaining = [...rest];
			const finalDealer = playDealer(dealerCards, () => {
				const next = remaining.shift();
				// Tres manos no gastan 52 cartas: si pasara, hay un fallo, no un empate.
				if (!next) throw new Error("baraja agotada");
				return next;
			});
			const result = handOutcome(playerCards, finalDealer);
			const total = totalSoFar + handPoints(result);
			setDealer(finalDealer);
			setDeck(remaining);
			setOutcome(result);
			setHidden(false);
			setScore(total);
			if (handIndex >= hands) {
				setPhase("done");
				if (!reported.current) {
					reported.current = true;
					onRun("veintiuna", total);
				}
			} else {
				setPhase("settled");
			}
		},
		[hands, onRun],
	);

	const deal = useCallback(
		(from: Card[], handIndex: number, totalSoFar: number) => {
			const playerCards = [from[0], from[2]];
			const dealerCards = [from[1], from[3]];
			const rest = from.slice(4);
			setPlayer(playerCards);
			setDealer(dealerCards);
			setDeck(rest);
			setHand(handIndex);
			setOutcome(null);
			setHidden(true);
			setPhase("playing");
			// Un 21 de reparto se cobra sin decidir nada: no hay jugada que hacer.
			if (isBlackjack(playerCards)) settleHand(playerCards, dealerCards, rest, totalSoFar, handIndex);
		},
		[settleHand],
	);

	const start = () => {
		reported.current = false;
		setScore(0);
		setOutcome(null);
		deal(shuffledDeck(seed ?? Date.now() % 1_000_000), 1, 0);
	};

	const hit = () => {
		if (phase !== "playing") return;
		const next = deck[0];
		if (!next) return;
		const rest = deck.slice(1);
		const cards = [...player, next];
		setPlayer(cards);
		setDeck(rest);
		if (handValue(cards) > 21) settleHand(cards, dealer, rest, score, hand);
	};

	const stand = () => {
		if (phase !== "playing") return;
		settleHand(player, dealer, deck, score, hand);
	};

	const nextHand = () => deal(deck, hand + 1, score);

	const dealerShown = hidden && dealer.length > 0 ? handValue([dealer[0]]) : handValue(dealer);

	return (
		<GameCard
			title="Veintiuna"
			hint="Tres manos contra el crupier. Pide o plántate: sin apuestas, sólo puntos de liga."
			icon={<Layers className="h-3.5 w-3.5" />}
			badge={badge}
			best={best}
		>
			<div className="mb-2 flex items-center gap-2">
				<span className="w-14 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
					Crupier
				</span>
				<div className="flex gap-1">
					{dealer.map((card, index) => (
						<PlayingCard key={`dealer-${index}`} card={card} hidden={hidden && index === 1} />
					))}
				</div>
				<span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
					{dealer.length > 0 ? dealerShown : "—"}
				</span>
			</div>

			<div className="mb-3 flex items-center gap-2">
				<span className="w-14 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
					Tú
				</span>
				<div className="flex gap-1">
					{player.map((card, index) => (
						<PlayingCard key={`player-${index}`} card={card} />
					))}
				</div>
				<span className="ml-auto font-mono text-[10px] text-foreground/80">
					{player.length > 0 ? handValue(player) : "—"}
				</span>
			</div>

			<div className="mb-3 grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span>
					Mano{" "}
					<strong className="block text-[11px] text-foreground">
						{Math.min(Math.max(hand, 1), hands)}/{hands}
					</strong>
				</span>
				<span>
					Puntos <strong className="block text-[11px] text-foreground">{score}</strong>
				</span>
				<span aria-live="polite">
					Resultado{" "}
					<strong className={`block text-[11px] ${outcome ? HAND_CLASS[outcome] : "text-foreground"}`}>
						{outcome ? HAND_LABEL[outcome] : "—"}
					</strong>
				</span>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				{phase === "idle" && (
					<button
						onClick={start}
						className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
					>
						Repartir
					</button>
				)}
				{phase === "playing" && (
					<>
						<button
							onClick={hit}
							className="rounded border border-secondary/50 bg-secondary/10 px-3 py-1.5 font-mono text-[10px] text-secondary transition-colors hover:bg-secondary/20"
						>
							Pedir
						</button>
						<button
							onClick={stand}
							className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
						>
							Plantarse
						</button>
					</>
				)}
				{phase === "settled" && (
					<button
						onClick={nextHand}
						className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
					>
						Siguiente mano
					</button>
				)}
				{phase === "done" && (
					<>
						<button
							onClick={start}
							className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
						>
							Otra vez
						</button>
						<span className="font-mono text-[9px] text-muted-foreground/55">
							Partida enviada a la liga con {score} puntos
						</span>
					</>
				)}
				<span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-muted-foreground/45">
					<Trophy className="h-2.5 w-2.5" /> marca {Math.max(best, score)}
				</span>
			</div>
		</GameCard>
	);
}
