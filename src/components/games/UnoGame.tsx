import { useState } from "react";
import { Layers, RotateCcw } from "lucide-react";
import { ArcadeCard } from "./ArcadeCard";
import type { PlayingCard } from "@/lib/decks";
import { UNO_COLORS, baseRank, unoDraw, unoLegal, unoPlay, unoPlayable, unoScore, unoStart, type UnoState } from "@/lib/uno";

const COLOR_CLASS: Record<string, string> = {
	rojo: "bg-destructive/70 text-background",
	amarillo: "bg-accent/70 text-background",
	verde: "bg-primary/60 text-background",
	azul: "bg-secondary/70 text-background",
};

function CardFace({ card }: { card: PlayingCard }) {
	const wild = card.suit === "comodin" || card.suit === "roba4";
	return (
		<span
			className={`flex h-14 w-10 flex-col items-center justify-center rounded border font-mono text-[10px] ${
				wild ? "border-accent/60 bg-accent/10 text-accent" : "border-border/60 bg-muted/20 text-foreground/85"
			}`}
		>
			<span className="text-[11px]">{wild ? "★" : baseRank(card)}</span>
			<span className="mt-0.5 text-[8px] uppercase tracking-wider">{card.suit}</span>
		</span>
	);
}

/**
 * UNO: mano contra un bot con la misma baraja.
 *
 * El componente no decide nada: `unoLegal` dice qué se puede tirar, `unoPlay`
 * resuelve la jugada y la respuesta del bot, y `unoScore` da los puntos. Aquí
 * sólo se pinta y se evita doble clic mientras no toque.
 */
export function UnoGame({
	best = 0,
	onRun,
}: {
	best?: number;
	onRun?: (score: number) => void;
}) {
	const [state, setState] = useState<UnoState>(() => unoStart(Math.floor(Date.now() % 90_000)));
	const [marca, setMarca] = useState(best);

	const settle = (next: UnoState) => {
		setState(next);
		if (!next.finished) return;
		const score = unoScore(next);
		setMarca((value) => Math.max(value, score));
		onRun?.(score);
	};

	const legal = new Set(unoLegal(state).map((card) => card.id));
	const restart = () => setState(unoStart(Math.floor(Date.now() % 90_000)));

	return (
		<ArcadeCard
			title="UNO del cinturón"
			hint="Tira del mismo color o del mismo número. Comodín siempre entra; roba si no tienes."
			icon={<Layers className="h-3.5 w-3.5" />}
			best={marca}
		>
			<div className="mb-3 flex items-center gap-2">
				<CardFace card={state.discard} />
				<div className="min-w-0 flex-1">
					<p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">En juego</p>
					<span
						className={`mt-1 inline-block rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
							COLOR_CLASS[state.color] ?? "bg-muted text-foreground"
						}`}
					>
						{state.color}
					</span>
				</div>
				<span className="ml-auto font-mono text-[9px] text-muted-foreground/55">
					Rival {state.rival.length} · mazo {state.draw.length}
				</span>
			</div>

			<div className="mb-3 flex flex-wrap gap-1.5">
				{state.hand.map((card) => (
					<button
						key={card.id}
						onClick={() => settle(unoPlay(state, card.id))}
						disabled={state.finished || state.turn !== 0 || !legal.has(card.id)}
						aria-label={`Tirar ${baseRank(card)} ${card.suit}`}
						className={`rounded transition-transform disabled:opacity-35 ${
							unoPlayable(state, card) ? "hover:-translate-y-0.5" : ""
						}`}
					>
						<CardFace card={card} />
					</button>
				))}
			</div>

			<div className="mb-3 grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span>
					Colocadas <strong className="block text-[11px] text-foreground">{state.played}</strong>
				</span>
				<span>
					Puntos <strong className="block text-[11px] text-foreground">{unoScore(state)}</strong>
				</span>
				<span aria-live="polite">
					Estado{" "}
					<strong className="block text-[11px] text-foreground">
						{state.finished ? (state.winner === 0 ? "Ganas" : "Pierdes") : state.turn === 0 ? "Tu turno" : "El rival"
						}
					</strong>
				</span>
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={() => settle(unoDraw(state))}
					disabled={state.finished || state.turn !== 0 || state.draw.length === 0}
					className="rounded border border-secondary/50 bg-secondary/10 px-3 py-1.5 font-mono text-[10px] text-secondary transition-colors hover:bg-secondary/20 disabled:opacity-40"
				>
					Robar
				</button>
				<button
					onClick={restart}
					className="flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
				>
					<RotateCcw className="h-3 w-3" /> Nueva mano
				</button>
				<span className="font-mono text-[9px] text-muted-foreground/45">
					{UNO_COLORS.length} colores · sin apuestas, sólo puntos
				</span>
			</div>
		</ArcadeCard>
	);
}
