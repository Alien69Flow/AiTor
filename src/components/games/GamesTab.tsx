import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DAOS, DOMAINS, GAMEFI_TRACKS, NFT_PROFILES, PRODUCTS } from "@/lib/ecosystem";
import { authClient } from "@/integrations/supabase/client";
import { readArcadeBest, saveArcadeBest } from "@/lib/arcade-best";
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
import { KIND_LABEL, MINIAPPS, plannedMiniApps } from "@/lib/miniapps";
import { ChickenCrossGame, KartRaceGame, LaneClashGame, MusGame } from "./ArcadeRacers";
import { EscaleraGame } from "./EscaleraGame";
import { FlappyGame } from "./FlappyGame";
import { ImpulseGame, MemoryGame, ReactorGame, VeintiunaGame } from "./GamesArcade";
import { GuinoteGame } from "./GuinoteGame";
import { HeadSoccerGame } from "./HeadSoccerGame";
import { PartyGame } from "./PartyGame";
import { RouletteGame } from "./RouletteGame";
import { UnoGame } from "./UnoGame";

const GAME_NAME: Record<HubGame, string> = {
	impulse: "Pulso orbital",
	memory: "Memoria de nodos",
	reactor: "Reactor de pares",
	veintiuna: "Veintiuna",
};

/** Una fila de la tabla del servidor (`GET /api/league`). */
interface ServerRow {
	rank: number;
	handle: string;
	points: number;
	runs: number;
	best: number;
}

type LeagueState =
	| { status: "loading" }
	| { status: "ready"; season: string; rows: ServerRow[]; me: ServerRow | null }
	| { status: "missing" }
	| { status: "anon" }
	| { status: "error" };

type Section = "arcade" | "reto" | "liga" | "gamefi" | "modulos";
const SECTIONS: { id: Section; label: string; icon: typeof Gamepad2 }[] = [
	{ id: "arcade", label: "Arcade", icon: Gamepad2 },
	{ id: "reto", label: "Reto del día", icon: Target },
	{ id: "liga", label: "Liga", icon: Swords },
	{ id: "gamefi", label: "GameFi", icon: Coins },
	{ id: "modulos", label: "Módulos", icon: Layers },
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

	/**
	 * Liga real en servidor.
	 *
	 * La tabla la calcula `GET /api/league` (Postgres, una fila por partida);
	 * el perfil local sigue mandando en el navegador para poder jugar sin sesión.
	 * Si la migración no está aplicada, la ruta responde 503 y aquí se dice tal
	 * cual en vez de fingir una clasificación vacía.
	 */
	const [league, setLeague] = useState<LeagueState>({ status: "loading" });

	const loadLeague = useCallback(async () => {
		const season = seasonOf(new Date());
		try {
			const { data } = await authClient.auth.getSession();
			const token = data.session?.access_token;
			const response = await fetch(`/api/league?season=${season}`, {
				headers: token ? { authorization: `Bearer ${token}` } : {},
			});
			if (response.status === 503) {
				setLeague({ status: "missing" });
				return;
			}
			if (!response.ok) {
				setLeague({ status: "error" });
				return;
			}
			const payload = (await response.json()) as {
				season: string;
				rows: ServerRow[];
				me: ServerRow | null;
				signedIn: boolean;
			};
			if (!payload.signedIn) {
				setLeague({ status: "anon" });
				return;
			}
			setLeague({ status: "ready", season: payload.season, rows: payload.rows, me: payload.me });
		} catch {
			setLeague({ status: "error" });
		}
	}, []);

	useEffect(() => {
		void loadLeague();
	}, [loadLeague]);

	/** Envía la partida al servidor sin romper la partida si no hay red o sesión. */
	const pushRun = useCallback(
		async (game: GameId, score: number, daily?: string) => {
			try {
				const { data } = await authClient.auth.getSession();
				const token = data.session?.access_token;
				if (!token) return;
				const response = await fetch("/api/league", {
					method: "POST",
					headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
					body: JSON.stringify({ game, score, daily }),
				});
				if (response.ok) void loadLeague();
			} catch {
				// La clasificación es un extra: si falla, la partida ya está guardada.
			}
		},
		[loadLeague],
	);

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
		void pushRun(game, score, countsForDaily ? challenge.id : undefined);
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
					Arcade del ecosistema: quince juegos que corren enteros en el navegador, un reto
					diario reproducible y la liga de la temporada en el servidor del proyecto.
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
						<ReactorGame
							seconds={hasDaily && challenge.game === "reactor" ? challenge.seconds : undefined}
							rounds={hasDaily && challenge.game === "reactor" ? challenge.rounds : undefined}
							best={profile.best.reactor}
							badge={hasDaily && challenge.game === "reactor" ? "reto del día" : undefined}
							onRun={handleRun}
						/>
						<VeintiunaGame best={profile.best.veintiuna} onRun={handleRun} />
						<UnoGame best={readArcadeBest("uno")} onRun={(score) => saveArcadeBest("uno", score)} />
						<GuinoteGame best={readArcadeBest("guinote")} onRun={(score) => saveArcadeBest("guinote", score)} />
						<EscaleraGame />
						<FlappyGame />
						<KartRaceGame best={readArcadeBest("kart")} onRun={(score) => saveArcadeBest("kart", score)} />
						<ChickenCrossGame
							best={readArcadeBest("chicken-road")}
							onRun={(score) => saveArcadeBest("chicken-road", score)}
						/>
						<LaneClashGame
							best={readArcadeBest("lane-clash")}
							onRun={(score) => saveArcadeBest("lane-clash", score)}
						/>
						<HeadSoccerGame
							best={readArcadeBest("head-soccer")}
							onRun={(score) => saveArcadeBest("head-soccer", score)}
						/>
						<MusGame best={readArcadeBest("mus")} onRun={(score) => saveArcadeBest("mus", score)} />
						<PartyGame best={readArcadeBest("party")} onRun={(score) => saveArcadeBest("party", score)} />
						<RouletteGame
							best={readArcadeBest("ruleta")}
							onRun={(score) => saveArcadeBest("ruleta", score)}
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
								<li>· En reactor, 100 por pareja acertada más 10 por segundo restante y 10 por combo.</li>
								<li>· Escalera, OVNI, UNO, guiñote, kart, cruce, escuadrón, head soccer, mus, party y ruleta guardan su marca en el navegador: no envían partidas.</li>
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
						{/* Clasificación real: la calcula el servidor, no el navegador. */}
						<div className="rounded-xl border border-primary/30 bg-primary/5">
							<header className="flex items-center gap-2 border-b border-primary/20 px-3 py-2">
								<Swords className="h-3 w-3 text-primary" />
								<h3 className="font-heading text-[10px] uppercase tracking-widest text-primary">
									Clasificación · {league.status === "ready" ? league.season : seasonOf(today)}
								</h3>
								<span className="ml-auto font-mono text-[8px] uppercase tracking-wider text-muted-foreground/50">
									servidor · {league.status}
								</span>
							</header>
							{league.status === "loading" && (
								<p className="px-3 py-4 font-mono text-[10px] text-muted-foreground/55">
									Leyendo la tabla de la temporada…
								</p>
							)}
							{league.status === "missing" && (
								<p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-accent">
									La tabla existe en código pero no en la base: falta aplicar
									<code className="mx-1 rounded bg-muted/40 px-1">
										supabase/migrations/20261107210000_game_league.sql
									</code>
									. Mientras tanto se juega igual y manda la liga local de abajo.
								</p>
							)}
							{league.status === "anon" && (
								<p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
									La clasificación es pública; para puntuar hace falta sesión iniciada.
								</p>
							)}
							{league.status === "error" && (
								<p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-destructive">
									No se pudo leer la clasificación del servidor. Tu historial local sigue intacto.
								</p>
							)}
							{league.status === "ready" &&
								(league.rows.length === 0 ? (
									<p className="px-3 py-4 font-mono text-[10px] text-muted-foreground/55">
										Nadie ha puntuado esta temporada: la primera partida abre la tabla.
									</p>
								) : (
									<ol className="divide-y divide-primary/10">
										{league.rows.map((row) => (
											<li
												key={`${row.rank}-${row.handle}`}
												className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px]"
											>
												<span className="w-5 text-muted-foreground/40">{row.rank}</span>
												<span className="min-w-0 flex-1 truncate text-foreground/85">
													{row.handle}
												</span>
												<span className="text-muted-foreground/45">{row.runs} p</span>
												<span className="w-14 text-right text-primary">{row.points} pts</span>
											</li>
										))}
									</ol>
								))}
							{league.status === "ready" && league.me && (
								<p className="border-t border-primary/20 px-3 py-1.5 font-mono text-[9px] text-secondary">
									Tú: puesto {league.me.rank} · {league.me.points} pts · mejor marca {league.me.best}
								</p>
							)}
						</div>
						<h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/60">
							Tu historial local
						</h3>

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
							Arriba manda la tabla del servidor (Postgres, una fila por partida). Abajo queda
							tu historial del navegador, que funciona sin sesión. La competición del ecosistema
							vive en {playHub?.name ?? "ADEX"}.
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

						<div className="grid gap-2 sm:grid-cols-2">
							{GAMEFI_TRACKS.map((track) => (
								<a
									key={track.id}
									href={track.url}
									target="_blank"
									rel="noopener noreferrer"
									className="group rounded-xl border border-border/40 bg-card/40 p-2.5 transition-colors hover:border-primary/40"
								>
									<h3 className="flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-widest text-foreground/85">
										{track.name}
										<ExternalLink className="ml-auto h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-primary" />
									</h3>
									<p className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-secondary/80">
										{track.role} · {track.host}
									</p>
									<p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground/55">
										{track.detail}
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

				{section === "modulos" && (
					<div className="mx-auto max-w-3xl space-y-3">
						<div className="rounded-xl border border-border/40 bg-card/40 p-3">
							<h2 className="flex items-center gap-2 font-heading text-[10px] uppercase tracking-widest text-foreground/85">
								<Layers className="h-3 w-3 text-primary" /> Registro de miniapps
							</h2>
							<p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
								Cada módulo es un motor puro en `src/lib` más una ficha en `miniapps.ts`. La
								pestaña los pinta sin cambios: añadir cartas, un plataformas o una mina es
								escribir el motor, probarlo y declararlo aquí.
							</p>
							<p className="mt-1 font-mono text-[9px] text-muted-foreground/45">
								{MINIAPPS.length} fichas · {MINIAPPS.length - plannedMiniApps().length} jugables ·{" "}
								{plannedMiniApps().length} diseñadas
							</p>
						</div>

						<div className="grid gap-2 sm:grid-cols-2">
							{MINIAPPS.map((app) => (
								<article key={app.id} className="rounded-xl border border-border/40 bg-card/40 p-3">
									<header className="flex flex-wrap items-center gap-1.5">
										<h3 className="font-heading text-[10px] uppercase tracking-widest text-foreground/85">
											{app.name}
										</h3>
										<span className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">
											{KIND_LABEL[app.kind]}
										</span>
										<span
											className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
												app.status === "jugable"
													? "bg-primary/15 text-primary"
													: "bg-accent/10 text-accent"
											}`}
										>
											{app.status}
										</span>
									</header>
									<p className="mt-1 font-mono text-[9px] leading-relaxed text-foreground/70">
										{app.tagline}
									</p>
									<p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground/55">
										{app.controls}
									</p>
									<p className="mt-1 font-mono text-[8px] leading-relaxed text-muted-foreground/45">
										{app.pointsRule}
									</p>
									<p className="mt-1.5 flex items-start gap-1 font-mono text-[8px] leading-relaxed text-accent/80">
										<Coins className="mt-0.5 h-2.5 w-2.5 shrink-0" />
										{app.payouts.state} · {app.payouts.note}
									</p>
									{app.requires && (
										<p className="mt-1 font-mono text-[8px] leading-relaxed text-muted-foreground/45">
											Falta: {app.requires}
										</p>
									)}
								</article>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
