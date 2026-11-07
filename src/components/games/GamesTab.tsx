import { useMemo, useState } from "react";
import {
	CandlestickChart,
	Coins,
	ExternalLink,
	Flame,
	Gamepad2,
	Layers,
	Swords,
	Target,
	Trophy,
} from "lucide-react";
import { DAOS, DOMAINS, NFT_PROFILES, PRODUCTS } from "@/lib/ecosystem";
import {
	HISTORY_LIMIT,
	REWARDS_NOTE,
	dailyChallenge,
	dateKey,
	rankOf,
	readProfile,
	recordRun,
	seasonLadder,
	seasonOf,
	writeProfile,
	type HubGame,
} from "@/lib/games-hub";
import type { GameId } from "@/lib/mini-games";
import { ImpulseGame, MemoryGame } from "./GamesArcade";

const GAME_NAME: Record<HubGame, string> = {
	impulse: "Pulso orbital",
	memory: "Memoria de nodos",
};

type Section = "arcade" | "reto" | "liga" | "gamefi";

const SECTIONS: { id: Section; label: string; icon: typeof Gamepad2 }[] = [
	{ id: "arcade", label: "Arcade", icon: Gamepad2 },
	{ id: "reto", label: "Reto del día", icon: Target },
	{ id: "liga", label: "Liga", icon: Swords },
	{ id: "gamefi", label: "GameFi", icon: Coins },
];

const product = (id: string) => PRODUCTS.find((entry) => entry.id === id);

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
	return (
		<div
			className={`rounded-lg border px-2.5 py-1.5 ${
				accent ? "border-primary/40 bg-primary/10" : "border-border/40 bg-card/40"
			}`}
		>
			<p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">{label}</p>
			<p
				className={`mt-0.5 font-heading text-[11px] uppercase tracking-wider ${
					accent ? "text-primary" : "text-foreground/85"
				}`}
			>
				{value}
			</p>
		</div>
	);
}

export function GamesTab() {
	const [section, setSection] = useState<Section>("arcade");
	const [profile, setProfile] = useState(() => readProfile());
	const [dailyMode, setDailyMode] = useState(false);

	const today = useMemo(() => new Date(), []);
	const challenge = useMemo(() => dailyChallenge(today), [today]);
	const rank = rankOf(profile.points);
	const ladder = seasonLadder(profile, today);
	const dailyDone = profile.dailyDone === challenge.id;

	// Los dos juegos pueden alimentar el reto: sólo el que toca recibe el ajuste.
	const hasDaily = dailyMode && !dailyDone;

	const handleRun = (game: GameId, score: number) => {
		const countsForDaily = hasDaily && game === challenge.game;
		setProfile(
			writeProfile(
				recordRun(profile, {
					game,
					score,
					daily: countsForDaily ? challenge.id : undefined,
				}),
			),
		);
		if (countsForDaily) setDailyMode(false);
	};

	const playDaily = () => {
		setDailyMode(true);
		setSection("arcade");
	};

	const progress =
		rank.next && rank.next.min > rank.min
			? Math.min(100, Math.round(((profile.points - rank.min) / (rank.next.min - rank.min)) * 100))
			: 100;

	const playHub = product("adex");
	const engine = product("ace");
	const dao = product("dao");
	const docs = product("docs");
	const trip = product("atrip");

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<header className="shrink-0 border-b border-border/40 px-3 pb-3 pt-3 md:px-5">
				<div className="flex flex-wrap items-center gap-2">
					<Gamepad2 className="h-4 w-4 text-primary" />
					<h1 className="font-heading text-sm uppercase tracking-widest text-primary">Juegos</h1>
					<span className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
						Temporada {seasonOf(today)}
					</span>
					{dailyDone && (
						<span className="flex items-center gap-1 rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-secondary">
							<Flame className="h-2.5 w-2.5" /> reto hecho
						</span>
					)}
				</div>
				<p className="mt-1 max-w-2xl font-mono text-[10px] leading-relaxed text-muted-foreground/60">
					Arcade del ecosistema: dos juegos que corren enteros en el navegador, un reto diario
					reproducible y la liga local de la temporada. Sin servidor ni clave.
				</p>

				<div className="mt-3 flex flex-wrap items-center gap-2">
					<Chip label="Rango" value={rank.name} accent />
					<Chip label="Puntos" value={String(profile.points)} />
					<Chip label="Racha" value={`${profile.streak} d`} />
					<Chip label="Partidas" value={String(profile.runs)} />
					<div className="ml-auto flex min-w-[140px] flex-col gap-1">
						<div className="h-1 overflow-hidden rounded-full bg-border/50">
							<div className="h-full rounded-full bg-primary/70" style={{ width: `${progress}%` }} />
						</div>
						<p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/45">
							{rank.next ? `${progress}% → ${rank.next.name}` : "rango máximo"}
						</p>
					</div>
				</div>

				<nav aria-label="Secciones de juegos" className="mt-3 flex flex-wrap gap-1">
					{SECTIONS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							onClick={() => setSection(id)}
							aria-current={section === id ? "page" : undefined}
							className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
								section === id
									? "border-primary/50 bg-primary/10 text-primary"
									: "border-border/40 text-muted-foreground/60 hover:border-secondary/40 hover:text-foreground/80"
							}`}
						>
							<Icon className="h-3 w-3" />
							{label}
						</button>
					))}
				</nav>
			</header>

			<div className="min-h-0 flex-1 px-3 py-4 md:px-5">
				{section === "arcade" && (
					<div className="grid min-h-0 gap-3 lg:grid-cols-2">
						<ImpulseGame
							tolerance={hasDaily && challenge.game === "impulse" ? challenge.tolerance : undefined}
							speed={hasDaily && challenge.game === "impulse" ? challenge.speed : undefined}
							best={profile.best.impulse}
							badge={hasDaily && challenge.game === "impulse" ? "reto del día" : undefined}
							onRun={handleRun}
						/>
						<MemoryGame
							nodeCount={hasDaily && challenge.game === "memory" ? challenge.nodeCount : undefined}
							best={profile.best.memory}
							badge={hasDaily && challenge.game === "memory" ? "reto del día" : undefined}
							onRun={handleRun}
						/>
					</div>
				)}

				{section === "reto" && (
					<div className="mx-auto max-w-2xl space-y-3">
						<div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
							<div className="flex items-center gap-2">
								<Target className="h-3.5 w-3.5 text-accent" />
								<h2 className="font-heading text-[11px] uppercase tracking-widest text-accent">
									{challenge.label}
								</h2>
								<span className="ml-auto font-mono text-[9px] text-muted-foreground/50">
									{dateKey(today)}
								</span>
							</div>
							<p className="mt-2 font-mono text-[10px] leading-relaxed text-foreground/75">
								{challenge.detail}
							</p>
							<p className="mt-1 font-mono text-[9px] text-muted-foreground/55">
								Juego: {GAME_NAME[challenge.game]} · el mismo reto para todo el mundo hasta
								medianoche UTC
							</p>
							<div className="mt-3 flex items-center gap-2">
								{dailyDone ? (
									<span className="flex items-center gap-1 rounded border border-secondary/40 bg-secondary/10 px-3 py-1.5 font-mono text-[10px] text-secondary">
										<Flame className="h-3 w-3" /> Completado hoy
									</span>
								) : (
									<button
										onClick={playDaily}
										className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20"
									>
										Jugar el reto
									</button>
								)}
								<span className="font-mono text-[9px] text-muted-foreground/45">
									Recompensa: puntos de liga, no on-chain
								</span>
							</div>
						</div>

						<div className="rounded-xl border border-border/40 bg-card/40 p-3">
							<h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/60">
								Cómo se calcula
							</h3>
							<ul className="mt-2 space-y-1 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
								<li>· Un pulso perfecto son 100 puntos, uno bueno 40, y cada acierto seguido suma 10 más (hasta 8).</li>
								<li>· En memoria, cada ronda completada son 40 puntos de liga.</li>
								<li>· La racha cuenta días seguidos con al menos una partida, no partidas.</li>
							</ul>
						</div>
					</div>
				)}

				{section === "liga" && (
					<div className="mx-auto max-w-2xl space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Chip label="Temporada" value={seasonOf(today)} accent />
							<Chip label="Rango" value={rank.name} />
							<Chip label="Puntos" value={String(profile.points)} />
							<Chip label="Últimas" value={`${ladder.length}/${HISTORY_LIMIT}`} />
						</div>

						{ladder.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
								<Trophy className="mx-auto h-5 w-5 text-muted-foreground/40" />
								<p className="mt-2 font-mono text-[10px] text-muted-foreground/60">
									Sin partidas esta temporada. Juega una y aparece aquí.
								</p>
							</div>
						) : (
							<ol className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40">
								{ladder.map((run, index) => (
									<li
										key={`${run.at}-${index}`}
										className="flex items-center gap-2 px-3 py-2 font-mono text-[10px]"
									>
										<span className="w-5 text-muted-foreground/40">{index + 1}</span>
										<span className="min-w-0 flex-1 truncate text-foreground/80">
											{GAME_NAME[run.game]}
											{run.daily ? " · reto" : ""}
										</span>
										<span className="text-muted-foreground/50">
											{new Date(run.at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
										</span>
										<span className="w-12 text-right text-primary">+{run.points}</span>
									</li>
								))}
							</ol>
						)}

						<p className="font-mono text-[9px] leading-relaxed text-muted-foreground/45">
							Liga local del navegador: no hay servidor de clasificación todavía. La competición
							real del ecosistema vive en {playHub?.name ?? "ADEX"}.
						</p>
					</div>
				)}

				{section === "gamefi" && (
					<div className="mx-auto max-w-3xl space-y-3">
						<div className="grid gap-2 sm:grid-cols-2">
							{[
								{
									product: playHub,
									icon: Layers,
									title: "Play HUB · economía de juego",
									note: "Intercambio y liquidez del ecosistema; es donde viven los juegos de ACE.",
								},
								{
									product: engine,
									icon: Gamepad2,
									title: "ACE · motor de los juegos",
									note: "La pestaña Arcade es la versión local; ACE es el motor que corre aparte.",
								},
								{
									product: dao,
									icon: Trophy,
									title: "DAO · gobernanza y tesorería",
									note: "Aragon en Polygon, con las direcciones públicas de abajo.",
								},
								{
									product: trip,
									icon: ExternalLink,
									title: "AlienTrip · experiencias",
									note: "Reservas del ecosistema; sirve de canje para eventos de la comunidad.",
								},
							].map(({ product: entry, icon: Icon, title, note }) => (
								<a
									key={title}
									href={entry?.url ?? "https://www.alienflow.space"}
									target="_blank"
									rel="noopener noreferrer"
									className="group rounded-xl border border-border/40 bg-card/40 p-3 transition-colors hover:border-secondary/40"
								>
									<h3 className="flex items-center gap-2 font-heading text-[10px] uppercase tracking-widest text-foreground/85">
										<Icon className="h-3 w-3 text-secondary" />
										{title}
										<ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/40 group-hover:text-secondary" />
									</h3>
									<p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground/55">
										{note}
									</p>
									<p className="mt-1 font-mono text-[8px] text-muted-foreground/40">
										{entry?.host ?? "alienflow.space"}
									</p>
								</a>
							))}
						</div>

						<div className="rounded-xl border border-border/40 bg-card/40 p-3">
							<h3 className="flex items-center gap-2 font-heading text-[10px] uppercase tracking-widest text-muted-foreground/60">
								<CandlestickChart className="h-3 w-3" /> Tesorería de la DAO
							</h3>
							<ul className="mt-2 space-y-1.5">
								{DAOS.map((org) => (
									<li key={org.id} className="flex flex-wrap items-center gap-2 font-mono text-[9px]">
										<span className="text-foreground/75">{org.name}</span>
										<code className="rounded bg-muted/40 px-1 py-0.5 text-[8px] text-muted-foreground/70">
											{org.address.slice(0, 6)}…{org.address.slice(-4)}
										</code>
										<a
											href={org.aragonUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="ml-auto flex items-center gap-1 text-secondary hover:text-primary"
										>
											Aragon <ExternalLink className="h-2.5 w-2.5" />
										</a>
									</li>
								))}
							</ul>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{NFT_PROFILES.map((nft) => (
									<a
										key={nft.id}
										href={nft.url}
										target="_blank"
										rel="noopener noreferrer"
										className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground/70 transition-colors hover:border-secondary/40 hover:text-secondary"
									>
										{nft.name} · OpenSea
									</a>
								))}
								{DOMAINS.slice(0, 2).map((domain) => (
									<a
										key={domain.domain}
										href={domain.url}
										target="_blank"
										rel="noopener noreferrer"
										className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground/70 transition-colors hover:border-secondary/40 hover:text-secondary"
									>
										{domain.domain}
									</a>
								))}
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
							<Coins className="h-3.5 w-3.5 shrink-0 text-accent" />
							<p className="min-w-0 flex-1 font-mono text-[9px] leading-relaxed text-foreground/70">
								{REWARDS_NOTE}
							</p>
							{docs && (
								<a
									href={docs.url}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1 rounded border border-accent/40 px-2 py-1 font-mono text-[9px] text-accent transition-colors hover:bg-accent/10"
								>
									Tokenomics <ExternalLink className="h-2.5 w-2.5" />
								</a>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
