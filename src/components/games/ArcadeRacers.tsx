import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Car, Flag, Layers, Swords, Trophy } from "lucide-react";
import {
  KART_GRIP_LIMIT,
  KART_LANES,
  KART_LAP_LENGTH,
  KART_LAPS,
  KART_MAX_SPEED,
  ROAD_LANES,
  chickenCrossed,
  chickenScore,
  chickenStart,
  chickenStep,
  clashScore,
  clashStart,
  clashTick,
  kartCurve,
  kartFinished,
  kartScore,
  kartStart,
  kartStep,
  trafficAt,
  type ChickenMove,
  type ChickenState,
  type ClashCommand,
  type ClashState,
  type KartState,
} from "@/lib/arcade-racers";
import {
  MUS_HAND_SIZE,
  PIEDRAS_TO_WIN,
  musCardLabel,
  musCompare,
  musCount,
  musDeal,
  musDiscard,
  musJuegoLabel,
  musShuffle,
  sumPiedras,
  type MusCard,
  type MusVerdict,
} from "@/lib/mus";

interface ArcadeProps {
  best?: number;
  onRun?: (score: number) => void;
}

/** Envoltorio común: la misma tarjeta que el resto del arcade. */
function Panel({
  title,
  hint,
  icon,
  best,
  children,
}: {
  title: string;
  hint: string;
  icon: ReactNode;
  best?: number;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border/50 bg-card/50">
      <header className="flex items-start gap-2 border-b border-border/40 px-3 py-2.5">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[11px] uppercase tracking-widest text-foreground/90">{title}</h3>
          <p className="mt-0.5 font-mono text-[9px] leading-relaxed text-muted-foreground/60">{hint}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] text-muted-foreground/45">
          <Trophy className="h-2.5 w-2.5" /> {best ?? 0}
        </span>
      </header>
      <div className="flex flex-1 flex-col p-3">{children}</div>
    </section>
  );
}

/* -------------------------------- Kart ---------------------------------- */

const KART_TICK_MS = 33;

export function KartRaceGame({ best = 0, onRun }: ArcadeProps) {
  const [state, setState] = useState<KartState>(kartStart);
  const [running, setRunning] = useState(false);
  const [marca, setMarca] = useState(best);
  const steer = useRef<0 | -1 | 1>(0);
  const brake = useRef(false);
  const seed = useRef(4242);
  const reported = useRef(false);

  const restart = useCallback(() => {
    setState(kartStart());
    steer.current = 0;
    brake.current = false;
    reported.current = false;
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setState((current) => {
        const curve = kartCurve(seed.current, Math.floor(current.distance / 180));
        return kartStep(current, { steer: steer.current, brake: brake.current }, curve, KART_TICK_MS / 1000);
      });
    }, KART_TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const finished = kartFinished(state);
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    setRunning(false);
    const score = kartScore(state);
    setMarca((value) => Math.max(value, score));
    onRun?.(score);
  }, [finished, state, onRun]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") steer.current = -1;
      if (event.key === "ArrowRight") steer.current = 1;
      if (event.key === " ") {
        brake.current = true;
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") steer.current = 0;
      if (event.key === " ") brake.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const progress = Math.min(1, state.distance / (KART_LAPS * KART_LAP_LENGTH));
  const lane = Math.max(
    0,
    Math.min(KART_LANES - 1, Math.round(((state.drift + 1.2) / 2.4) * (KART_LANES - 1))),
  );
  const offRoad = Math.abs(state.drift) > KART_GRIP_LIMIT;

  return (
    <Panel
      title="Kart de la órbita"
      hint="Dos vueltas. Corrige la deriva con las flechas; fuera de pista se pierde velocidad."
      icon={<Car className="h-3.5 w-3.5" />}
      best={marca}
    >
      <div className="mb-3 overflow-hidden rounded border border-border/60 bg-muted/20 p-2">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${KART_LANES}, minmax(0, 1fr))` }}>
          {Array.from({ length: KART_LANES }, (_, index) => (
            <span
              key={index}
              className={`h-9 rounded-sm border ${
                index === lane
                  ? offRoad
                    ? "border-destructive bg-destructive/20"
                    : "border-primary bg-primary/20"
                  : "border-border/40 bg-background/40"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 font-mono text-[9px] text-muted-foreground/60">
        <span>
          Velocidad <strong className="block text-[11px] text-foreground">{Math.round(state.speed)}</strong>
        </span>
        <span>
          Vuelta <strong className="block text-[11px] text-foreground">{Math.min(state.lap, KART_LAPS)}/{KART_LAPS}</strong>
        </span>
        <span>
          Deriva <strong className="block text-[11px] text-foreground">{state.drift.toFixed(2)}</strong>
        </span>
        <span>
          Puntos <strong className="block text-[11px] text-foreground">{kartScore(state)}</strong>
        </span>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-border/40" aria-hidden="true">
        <span
          className="block h-full bg-primary/70"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            steer.current = -1;
          }}
          disabled={!running}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          ←
        </button>
        <button
          onClick={() => {
            steer.current = 0;
          }}
          disabled={!running}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          centro
        </button>
        <button
          onClick={() => {
            steer.current = 1;
          }}
          disabled={!running}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          →
        </button>
        <button
          onClick={() => {
            brake.current = !brake.current;
          }}
          disabled={!running}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          freno
        </button>
        <button
          onClick={restart}
          className="ml-auto rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary"
        >
          {running ? "Reiniciar" : finished ? "Otra vez" : "Salir a pista"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground/45">
        {offRoad ? "Fuera de pista: 45 % menos de avance." : `Velocidad máxima ${KART_MAX_SPEED} m/s.`}
      </p>
    </Panel>
  );
}

/* --------------------------- Cruce de carriles -------------------------- */

export function ChickenCrossGame({ best = 0, onRun }: ArcadeProps) {
  const [state, setState] = useState<ChickenState>(chickenStart);
  const [tick, setTick] = useState(0);
  const seed = useRef(2026);
  const [marca, setMarca] = useState(best);
  const reported = useRef(false);
  const cars = useMemo(() => trafficAt(seed.current, tick), [tick]);
  const playing = state.alive && !chickenCrossed(state);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 380);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (playing || reported.current) return;
    reported.current = true;
    const score = chickenScore(state);
    setMarca((value) => Math.max(value, score));
    onRun?.(score);
  }, [playing, state, onRun]);

  const move = (direction: ChickenMove) => {
    if (!playing) return;
    setState((current) => chickenStep(current, direction, trafficAt(seed.current, tick)));
  };

  const restart = () => {
    setState(chickenStart());
    setTick(0);
    reported.current = false;
  };

  return (
    <Panel
      title="Cruce de carriles"
      hint="Cruza las nueve filas sin que te pise un coche. La meta no mata."
      icon={<Flag className="h-3.5 w-3.5" />}
      best={marca}
    >
      <div className="mb-3 space-y-0.5">
        {Array.from({ length: ROAD_LANES + 2 }, (_, index) => ROAD_LANES + 1 - index).map((row) => (
          <div
            key={row}
            className={`relative h-4 overflow-hidden rounded-sm border ${
              row === 0 || row === ROAD_LANES + 1
                ? "border-secondary/40 bg-secondary/10"
                : "border-border/40 bg-muted/20"
            }`}
          >
            {cars
              .filter((car) => car.lane === row)
              .map((car, index) => (
                <span
                  key={index}
                  className="absolute top-0.5 h-3 w-5 rounded-sm bg-destructive/70"
                  style={{ left: `${car.x * 88}%` }}
                />
              ))}
            {state.row === row && (
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full ${
                  state.alive ? "bg-primary" : "bg-muted-foreground/60"
                }`}
                style={{ left: `${state.x * 92}%` }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => move("left")}
          disabled={!playing}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          ←
        </button>
        <button
          onClick={() => move("up")}
          disabled={!playing}
          className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary disabled:opacity-40"
        >
          saltar
        </button>
        <button
          onClick={() => move("right")}
          disabled={!playing}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          →
        </button>
        <button
          onClick={() => move("down")}
          disabled={!playing}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          ↓
        </button>
        <button
          onClick={restart}
          className="ml-auto rounded border border-border/60 px-3 py-1.5 font-mono text-[10px]"
        >
          Otra vez
        </button>
      </div>

      <p className="mt-auto font-mono text-[9px] text-muted-foreground/55" aria-live="polite">
        {!state.alive
          ? `Te pisaron en la fila ${state.row} · ${chickenScore(state)} puntos`
          : chickenCrossed(state)
            ? `Cruzaste · ${chickenScore(state)} puntos`
            : `Fila ${state.row}/${ROAD_LANES} · ${chickenScore(state)} puntos`}
      </p>
    </Panel>
  );
}

/* -------------------------- Combate por carriles ------------------------ */

export function LaneClashGame({ best = 0, onRun }: ArcadeProps) {
  const [state, setState] = useState<ClashState>(clashStart);
  const seed = useRef(7);
  const [marca, setMarca] = useState(best);
  const reported = useRef(false);

  const act = (command: ClashCommand) => setState((current) => clashTick(current, command, seed.current));

  useEffect(() => {
    if (!state.over || reported.current) return;
    reported.current = true;
    const score = clashScore(state);
    setMarca((value) => Math.max(value, score));
    onRun?.(score);
  }, [state, onRun]);

  const restart = () => {
    reported.current = false;
    setState(clashStart());
  };

  return (
    <Panel
      title="Combate por carriles"
      hint="Tres carriles, oleadas que avanzan con cada acción. Escudo aguanta un golpe."
      icon={<Swords className="h-3.5 w-3.5" />}
      best={marca}
    >
      <div className="mb-3 grid grid-cols-3 gap-1">
        {Array.from({ length: 3 }, (_, lane) => (
          <div
            key={lane}
            className={`flex min-h-24 flex-col justify-end gap-1 rounded border p-1 ${
              state.lane === lane ? "border-primary/60 bg-primary/10" : "border-border/40 bg-muted/20"
            }`}
          >
            {state.enemies
              .filter((enemy) => enemy.lane === lane)
              .sort((a, b) => a.at - b.at)
              .map((enemy, index) => (
                <span
                  key={index}
                  className="rounded-sm bg-destructive/60 px-1 py-0.5 text-center font-mono text-[8px] text-background"
                  style={{ opacity: 0.45 + (1 - enemy.at) * 0.55 }}
                >
                  {enemy.hp}
                </span>
              ))}
            {state.lane === lane && (
              <span className="rounded-sm bg-primary/70 px-1 py-0.5 text-center font-mono text-[8px] text-background">
                tú
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 font-mono text-[9px] text-muted-foreground/60">
        <span>
          Casco <strong className="block text-[11px] text-foreground">{state.hp}</strong>
        </span>
        <span>
          Oleada <strong className="block text-[11px] text-foreground">{state.wave}</strong>
        </span>
        <span>
          Bajas <strong className="block text-[11px] text-foreground">{state.kills}</strong>
        </span>
        <span>
          Puntos <strong className="block text-[11px] text-foreground">{clashScore(state)}</strong>
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <button
          onClick={() => act("left")}
          disabled={state.over}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          ←
        </button>
        <button
          onClick={() => act("fire")}
          disabled={state.over}
          className="rounded border border-destructive/50 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] text-destructive disabled:opacity-40"
        >
          disparar
        </button>
        <button
          onClick={() => act("shield")}
          disabled={state.over}
          className="rounded border border-secondary/50 bg-secondary/10 px-3 py-1.5 font-mono text-[10px] text-secondary disabled:opacity-40"
        >
          escudo
        </button>
        <button
          onClick={() => act("right")}
          disabled={state.over}
          className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] disabled:opacity-40"
        >
          →
        </button>
        <button onClick={restart} className="ml-auto rounded border border-border/60 px-3 py-1.5 font-mono text-[10px]">
          {state.over ? "Otra vez" : "Reiniciar"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground/45">
        {state.over ? "Casco roto: partida terminada." : state.shielded ? "Escudo arriba." : "Cada acción mueve la oleada."}
      </p>
    </Panel>
  );
}

/* --------------------------------- Mus ---------------------------------- */

export function MusGame({ best = 0, onRun }: ArcadeProps) {
  const [round, setRound] = useState(0);
  const [mine, setMine] = useState<MusCard[]>([]);
  const [rival, setRival] = useState<MusCard[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<MusVerdict | null>(null);
  const [stones, setStones] = useState({ mine: 0, rival: 0 });
  const [phase, setPhase] = useState<"idle" | "discard" | "scored" | "over">("idle");
  const [marca, setMarca] = useState(best);

  const deal = (index: number) => {
    const { hands } = musDeal(musShuffle(5000 + index), 2, MUS_HAND_SIZE);
    setMine(hands[0] ?? []);
    setRival(hands[1] ?? []);
    setMarked([]);
    setVerdict(null);
    setRound(index);
    setPhase("discard");
  };

  const sing = () => {
    const { kept } = musDiscard(mine, marked);
    const result = musCompare(musCount(kept), musCount(rival));
    const mineStones = sumPiedras(stones.mine, result.stones);
    const rivalStones = sumPiedras(stones.rival, result.stones === 0 ? 1 : 0);
    setMine(kept);
    setVerdict(result);
    setStones({ mine: mineStones, rival: rivalStones });
    const over = mineStones >= PIEDRAS_TO_WIN || rivalStones >= PIEDRAS_TO_WIN;
    setPhase(over ? "over" : "scored");
    if (over) {
      setMarca((value) => Math.max(value, mineStones));
      onRun?.(mineStones);
    }
  };

  const toggle = (index: number) =>
    setMarked((current) =>
      current.includes(index)
        ? current.filter((one) => one !== index)
        : current.length >= MUS_HAND_SIZE
          ? current
          : [...current, index],
    );

  return (
    <Panel
      title="Mus"
      hint="Baraja española a 40 piedras: descarta, canta pares, juego y punto."
      icon={<Layers className="h-3.5 w-3.5" />}
      best={marca}
    >
      {phase === "idle" ? (
        <button
          onClick={() => deal(0)}
          className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary"
        >
          Repartir
        </button>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-4 gap-1">
            {mine.map((card, index) => (
              <button
                key={`${musCardLabel(card)}-${index}`}
                onClick={() => phase === "discard" && toggle(index)}
                disabled={phase !== "discard"}
                aria-pressed={marked.includes(index)}
                className={`rounded border px-1 py-2 font-mono text-[9px] ${
                  marked.includes(index)
                    ? "border-destructive/60 bg-destructive/10 text-destructive"
                    : "border-border/60 bg-muted/20 text-foreground/85"
                } disabled:opacity-70`}
              >
                {musCardLabel(card)}
              </button>
            ))}
          </div>

          <div className="mb-2 grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground/60">
            <span>
              Pares
              <strong className="block text-[11px] text-foreground">{musCount(mine).pares.label}</strong>
            </span>
            <span>
              Juego
              <strong className="block text-[11px] text-foreground">{musJuegoLabel(musCount(mine).juego)}</strong>
            </span>
            <span>
              Punto
              <strong className="block text-[11px] text-foreground">{musCount(mine).punto}</strong>
            </span>
          </div>

          {verdict && (
            <p className="mb-2 font-mono text-[9px] leading-relaxed text-muted-foreground/70">
              Pares {verdict.pares > 0 ? "ganas" : verdict.pares < 0 ? "pierdes" : "empate"} · juego{" "}
              {verdict.juego > 0 ? "ganas" : verdict.juego < 0 ? "pierdes" : "empate"} · punto{" "}
              {verdict.punto > 0 ? "ganas" : verdict.punto < 0 ? "pierdes" : "empate"} ·{" "}
              {verdict.stones} piedra(s)
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] text-muted-foreground/60">
              Tú {stones.mine} · Rival {stones.rival} / {PIEDRAS_TO_WIN}
            </span>
            {phase === "discard" && (
              <button
                onClick={sing}
                className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-[10px] text-primary"
              >
                Descartar y cantar ({marked.length})
              </button>
            )}
            {phase !== "discard" && (
              <button
                onClick={() => deal(round + 1)}
                className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px]"
              >
                Siguiente mano
              </button>
            )}
            <button
              onClick={() => {
                setStones({ mine: 0, rival: 0 });
                setPhase("idle");
                setVerdict(null);
              }}
              className="ml-auto rounded border border-border/60 px-3 py-1.5 font-mono text-[10px]"
            >
              Nueva partida
            </button>
          </div>

          {phase === "over" && (
            <p className="mt-2 font-mono text-[9px] text-primary">
              {stones.mine >= PIEDRAS_TO_WIN ? "Partida ganada a " : "El rival llegó a "}
              {PIEDRAS_TO_WIN} piedras.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
