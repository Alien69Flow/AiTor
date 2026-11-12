import { useState } from "react";
import { Coins, RotateCcw } from "lucide-react";
import { ArcadeCard } from "./ArcadeCard";
import { ROULETTE_ODDS, ROULETTE_POCKETS, afterSpin, betWins, spinNet, spinOf, type RouletteBet } from "@/lib/roulette";

const BETS: { id: RouletteBet; label: string; hint: string }[] = [
	{ id: "rojo", label: "Rojo", hint: "1 a 1" },
	{ id: "negro", label: "Negro", hint: "1 a 1" },
	{ id: "par", label: "Par", hint: "1 a 1" },
	{ id: "impar", label: "Impar", hint: "1 a 1" },
	{ id: "docena1", label: "1–12", hint: "2 a 1" },
	{ id: "docena2", label: "13–24", hint: "2 a 1" },
	{ id: "docena3", label: "25–36", hint: "2 a 1" },
];

const STAKES = [5, 10, 25];
const START_CHIPS = 100;
const MAX_SPINS = 12;

/**
 * Ruleta de fichas simbólicas: 37 casillas, sin doble cero y sin dinero.
 *
 * Cada tirada sale de `spinOf` con la semilla de la partida, así que el
 * resultado no se puede «recalcular» a favor desde la consola cambiando un
 * estado de React: cuando la ficha está puesta, la bola ya está decidida.
 */
export function RouletteGame({
	best = 0,
	onRun,
}: {
	best?: number;
	onRun?: (score: number) => void;
}) {
	const [seed, setSeed] = useState(() => Math.floor(Date.now() % 500_000));
	const [spins, setSpins] = useState(0);
	const [chips, setChips] = useState(START_CHIPS);
	const [peak, setPeak] = useState(START_CHIPS);
	const [bet, setBet] = useState<RouletteBet>("rojo");
	const [stake, setStake] = useState(STAKES[1]);
	const [history, setHistory] = useState<{ pocket: number; net: number; bet: RouletteBet }[]>([]);
	const [marca, setMarca] = useState(best);

	const over = chips <= 0 || spins >= MAX_SPINS;

	const spin = () => {
		if (over || stake > chips) return;
		const pocket = spinOf(seed + spins);
		const net = spinNet(bet, pocket, stake);
		const nextChips = afterSpin(chips, bet, pocket, stake);
		const nextPeak = Math.max(peak, nextChips);
		setChips(nextChips);
		setPeak(nextPeak);
		setHistory((current) => [{ pocket, net, bet }, ...current].slice(0, 6));
		const nextSpins = spins + 1;
		setSpins(nextSpins);
		if (nextChips <= 0 || nextSpins >= MAX_SPINS) {
			setMarca((value) => Math.max(value, nextPeak));
			onRun?.(nextPeak);
		}
	};

	const restart = () => {
		setSeed(Math.floor(Date.now() % 500_000));
		setSpins(0);
		setChips(START_CHIPS);
		setPeak(START_CHIPS);
		setHistory([]);
	};

	return (
		<ArcadeCard
			title="Ruleta del hangar"
			hint="Doce tiradas con fichas de prueba. La bola sale de la semilla; el cero se lo queda la casa."
			icon={<Coins className="h-3.5 w-3.5" />}
			best={marca}
		>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 font-heading text-xl text-primary">
					{history[0]?.pocket ?? "—"}
				</span>
				<div className="grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground/60">
					<span>
						Fichas <strong className="block text-[11px] text-foreground">{chips}</strong>
					</span>
					<span>
						Tiradas <strong className="block text-[11px] text-foreground">{spins}/{MAX_SPINS}</strong>
					</span>
					<span aria-live="polite">
						Última{" "}
						<strong className={`block text-[11px] ${(history[0]?.net ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
							{history[0] ? `${history[0].net > 0 ? "+" : ""}${history[0].net}` : "—"}
						</strong>
					</span>
				</div>
				<span className="ml-auto font-mono text-[9px] text-muted-foreground/45">
					{ROULETTE_POCKETS} casillas
				</span>
			</div>

			<div className="mb-2 flex flex-wrap gap-1">
				{BETS.map((option) => (
					<button
						key={option.id}
						onClick={() => setBet(option.id)}
						disabled={over}
						aria-pressed={bet === option.id}
						className={`rounded border px-2 py-1 font-mono text-[9px] transition-colors disabled:opacity-40 ${
							bet === option.id
								? "border-primary/60 bg-primary/15 text-primary"
								: "border-border/50 text-muted-foreground/70 hover:border-secondary/40"
						}`}
					>
						{option.label}
						<span className="ml-1 text-[8px] text-muted-foreground/45">{option.hint}</span>
					</button>
				))}
			</div>

			<div className="mb-3 flex flex-wrap items-center gap-1.5">
				<span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">Ficha</span>
				{STAKES.map((value) => (
					<button
						key={value}
						onClick={() => setStake(value)}
						disabled={over}
						aria-pressed={stake === value}
						className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors disabled:opacity-40 ${
							stake === value ? "border-secondary/60 bg-secondary/15 text-secondary" : "border-border/50"
						}`}
					>
						{value}
					</button>
				))}
			</div>

			{history.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-1 font-mono text-[8px] text-muted-foreground/55">
					{history.map((entry, index) => (
						<span
							key={`${entry.pocket}-${index}`}
							className={`rounded border px-1.5 py-0.5 ${betWins(entry.bet, entry.pocket) ? "border-primary/40 text-primary" : "border-border/50"}`}
						>
							{entry.pocket}
						</span>
					))}
				</div>
			)}

			<div className="mt-auto flex flex-wrap items-center gap-2">
				<button
					onClick={spin}
					disabled={over || stake > chips}
					className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
				>
					Girar {stake}
				</button>
				<button
					onClick={restart}
					className="flex items-center gap-1 rounded border border-border/60 px-3 py-1.5 font-mono text-[10px]"
				>
					<RotateCcw className="h-3 w-3" /> Otra sesión
				</button>
				<p className="font-mono text-[9px] text-muted-foreground/45" aria-live="polite">
					{over
						? `Sesión cerrada con ${peak} fichas de máximo · pago ${ROULETTE_ODDS.rojo}× en color`
						: `${MAX_SPINS - spins} tiradas · sin compra ni retirada`}
				</p>
			</div>
		</ArcadeCard>
	);
}
