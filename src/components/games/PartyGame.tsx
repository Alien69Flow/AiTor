import { useEffect, useRef, useState } from "react";
import { Dice5, RotateCcw } from "lucide-react";
import { ArcadeCard } from "./ArcadeCard";
import { PARTY, partyRoll, partyScore, partyStart, type PartyState } from "@/lib/party";

/**
 * Tablero party: se juega por turnos, así que el rival no necesita reloj.
 *
 * El dado y el movimiento viven en `party.ts`; aquí sólo hay un temporizador
 * para que su tirada se vea y no ocurra en el mismo fotograma que la tuya.
 */
export function PartyGame({
	best = 0,
	onRun,
}: {
	best?: number;
	onRun?: (score: number) => void;
}) {
	const [state, setState] = useState<PartyState>(() => partyStart((Date.now() % 4000) + 1));
	const [marca, setMarca] = useState(best);
	const reported = useRef(false);

	useEffect(() => {
		if (state.over || state.turn !== 1) return;
		const timer = window.setTimeout(() => setState((current) => partyRoll(current)), 620);
		return () => window.clearTimeout(timer);
	}, [state]);

	useEffect(() => {
		if (!state.over || reported.current) return;
		reported.current = true;
		const score = partyScore(state);
		setMarca((value) => Math.max(value, score));
		onRun?.(score);
	}, [state, onRun]);

	const restart = () => {
		setState(partyStart((Date.now() % 4000) + 1));
		reported.current = false;
	};

	const tiles = Array.from({ length: PARTY.tiles }, (_, index) => index);

	return (
		<ArcadeCard
			title="Fiesta en el hangar"
			hint="Seis rondas, dado de seis caras y estrellas de diez monedas. La casilla 3 paga."
			icon={<Dice5 className="h-3.5 w-3.5" />}
			best={marca}
		>
			<div className="mb-3 grid grid-cols-6 gap-1">
				{tiles.map((tile) => {
					const youHere = state.you.tile === tile;
					const rivalHere = state.rival.tile === tile;
					const coin = tile === PARTY.coinTile;
					const star = tile === PARTY.starTile;
					return (
						<div
							key={tile}
							className={`flex h-10 flex-col items-center justify-center rounded border font-mono text-[8px] ${
								star
									? "border-accent/60 bg-accent/10 text-accent"
									: coin
										? "border-secondary/50 bg-secondary/10 text-secondary"
										: "border-border/40 text-muted-foreground/50"
							}`}
							aria-label={`Casilla ${tile}${star ? " estrella" : coin ? " monedas" : ""}`}
						>
							<span>{star ? "★" : coin ? "¤" : tile}</span>
							<span className="flex gap-0.5">
								{youHere && <i className="h-1.5 w-1.5 rounded-full bg-primary" />}
								{rivalHere && <i className="h-1.5 w-1.5 rounded-full bg-destructive" />}
							</span>
						</div>
					);
				})}
			</div>

			<div className="mb-3 grid grid-cols-4 gap-2 font-mono text-[9px] text-muted-foreground/60">
				<span>
					Monedas <strong className="block text-[11px] text-foreground">{state.you.coins}</strong>
				</span>
				<span>
					Estrellas <strong className="block text-[11px] text-foreground">{state.you.stars}</strong>
				</span>
				<span>
					Rival <strong className="block text-[11px] text-foreground">{state.rival.stars}★ · {state.rival.coins}¤</strong>
				</span>
				<span aria-live="polite">
					Ronda <strong className="block text-[11px] text-foreground">{Math.min(state.round, PARTY.rounds)}/{PARTY.rounds}</strong>
				</span>
			</div>

			<div className="mb-3 min-h-10 rounded border border-border/40 bg-muted/10 p-2 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
				{state.log.map((entry, index) => (
					<p key={`${entry}-${index}`} className={index === 0 ? "text-foreground/75" : ""}>
						{entry}
					</p>
				))}
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={() => setState((current) => partyRoll(current))}
					disabled={state.over || state.turn !== 0}
					className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
				>
					Tirar dado
				</button>
				<button
					onClick={restart}
					className="flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary"
				>
					<RotateCcw className="h-3 w-3" /> Otra partida
				</button>
				<p className="font-mono text-[9px] text-muted-foreground/45" aria-live="polite">
					{state.over
						? state.winner === 0
							? `Ganas con ${partyScore(state)} puntos`
							: state.winner === 1
								? "Gana el rival"
								: "Empate a estrellas y monedas"
						: state.turn === 0
							? "Tu tirada"
							: "Tira el rival…"}
				</p>
			</div>
		</ArcadeCard>
	);
}
