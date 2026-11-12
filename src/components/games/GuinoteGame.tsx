import { useEffect, useState } from "react";
import { RotateCcw, Swords } from "lucide-react";
import { ArcadeCard } from "./ArcadeCard";
import type { PlayingCard } from "@/lib/decks";
import { LAST_TRICK_POINTS, cardPoints, createTrickGame, legalCards, playCard, winnerOf, type TrickState } from "@/lib/trick";

const RANK_LABEL: Record<string, string> = { "1": "A", "10": "S", "11": "C", "12": "R" };
const SUIT_LABEL: Record<string, string> = { oros: "●", copas: "♥", espadas: "♠", bastos: "♣" };

function CardFace({ card, dim }: { card: PlayingCard; dim?: boolean }) {
	return (
		<span
			className={`flex h-16 w-11 flex-col items-center justify-center rounded border font-mono ${
				dim ? "border-border/40 bg-muted/10 text-muted-foreground/50" : "border-border/60 bg-muted/20 text-foreground/90"
			}`}
		>
			<span className="text-sm">{RANK_LABEL[card.rank] ?? card.rank}</span>
			<span className="mt-0.5 text-xs">{SUIT_LABEL[card.suit] ?? card.suit}</span>
		</span>
	);
}

export function GuinoteGame({
	best = 0,
	onRun,
}: {
	best?: number;
	onRun?: (score: number) => void;
}) {
	const [state, setState] = useState<TrickState>(() => createTrickGame("guinote", (Date.now() % 5000) + 1));
	const [marca, setMarca] = useState(best);
	const [reported, setReported] = useState(false);

	// El rival juega solo: tira la carta que más vale de las que puede jugar.
	useEffect(() => {
		if (state.finished || state.turn !== 1) return;
		const timer = window.setTimeout(() => {
			setState((current) => {
				if (current.finished || current.turn !== 1) return current;
				const options = legalCards(current);
				if (options.length === 0) return current;
				const pick = options.reduce((last, card) => (cardPoints(card) > cardPoints(last) ? card : last), options[0]);
				return playCard(current, pick.id);
			});
		}, 420);
		return () => window.clearTimeout(timer);
	}, [state]);

	useEffect(() => {
		if (!state.finished || reported) return;
		setReported(true);
		const score = state.score[0] * 10 + state.tricks[0] * 20;
		setMarca((value) => Math.max(value, score));
		onRun?.(score);
	}, [state, reported, onRun]);

	const legal = new Set(legalCards(state).map((card) => card.id));
	const result = winnerOf(state);
	const restart = () => {
		setState(createTrickGame("guinote", (Date.now() % 5000) + 1));
		setReported(false);
	};

	return (
		<ArcadeCard
			title="Guiñote"
			hint="Baraja española de 40: cuatro cartas, obligación de asistir y la última baza vale diez."
			icon={<Swords className="h-3.5 w-3.5" />}
			best={marca}
		>
			<div className="mb-3 flex items-center gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 uppercase tracking-wider text-primary">
					Pinta {state.trump} {SUIT_LABEL[state.trump]}
				</span>
				<span className="ml-auto" aria-live="polite">
					{state.finished
						? result === 0
							? "Ganas la partida"
							: result === 1
								? "Pierdes la partida"
								: "Empate"
						: state.turn === 0
							? "Tu turno"
							: "Juega el rival…"}
				</span>
			</div>

			<div className="mb-3 grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span>
					Puntos <strong className="block text-[11px] text-foreground">{state.score[0]}–{state.score[1]}</strong>
				</span>
				<span>
					Bazas <strong className="block text-[11px] text-foreground">{state.tricks[0]}–{state.tricks[1]}</strong>
				</span>
				<span>
					En mesa{" "}
					<strong className="block text-[11px] text-foreground">{state.trick.length}/2</strong>
				</span>
			</div>

			<div className="mb-3 flex min-h-16 items-center gap-1.5 rounded border border-dashed border-border/40 bg-muted/10 p-2">
				{state.trick.length === 0 ? (
					<span className="font-mono text-[9px] text-muted-foreground/40">Mesa vacía: sale {state.turn === 0 ? "tu carta" : "el rival"}</span>
				) : (
					state.trick.map((card) => <CardFace key={card.id} card={card} />)
				)}
			</div>

			<div className="mb-3 flex flex-wrap gap-1.5">
				{state.hands[0].map((card) => (
					<button
						key={card.id}
						onClick={() => setState(playCard(state, card.id))}
						disabled={state.finished || state.turn !== 0 || !legal.has(card.id)}
						aria-label={`Jugar ${RANK_LABEL[card.rank] ?? card.rank} de ${card.suit}`}
						className="rounded transition-transform hover:-translate-y-0.5 disabled:opacity-30"
					>
						<CardFace card={card} />
					</button>
				))}
				{state.hands[0].length === 0 && (
					<span className="font-mono text-[9px] text-muted-foreground/45">Sin cartas en la mano</span>
				)}
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={restart}
					className="flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					<RotateCcw className="h-3 w-3" /> Otra mano
				</button>
				<span className="font-mono text-[9px] text-muted-foreground/45">
					Cantos pendientes · la última baza suma {LAST_TRICK_POINTS}
				</span>
			</div>
		</ArcadeCard>
	);
}
