# Rebanada 1 de UI/UX: tokens de estado, una sola clasificación y tarjetas de herramienta

**Fecha:** 2026-11-13 · **Estado:** propuesta, lista para implementar · **Ámbito:** frontend (`src/`), sin cambios de esquema ni de API.

Esta es la primera rebanada de una lista más larga. Se elige esta porque son tres arreglos que comparten causa —cada pantalla inventa su propio vocabulario visual para decir "esto salió bien", "esto falló" o "este dato es de hace un rato"— y juntos se resuelven con un solo contrato.

## Lo que hay hoy (verificado en `main` @ `2cea919`)

| Frente | Dónde | Qué pasa |
|---|---|---|
| Color de estado | `src/index.css`, `tailwind.config.ts` | No hay tokens de severidad. `--accent` y `--secondary` valen lo mismo (`75 100% 34%`), así que "aviso" y "secundario" son el mismo verde lima; y `--destructive` cambia de tono entre `:root` (`0 84% 60%`) y `.dark` (`0 62% 30%`). |
| Clasificación de Juegos | `src/components/games/GamesTab.tsx`, bloque `section === "liga"` | Dos tablas con dos anatomías: la del servidor (`<ol className="divide-y divide-primary/10">`, rank/handle/partidas/puntos) y el historial local (`<ol className="divide-y divide-border/40 rounded-xl border …">`, índice/juego/fecha/+puntos). Cada una tiene su propio estado vacío y su propio grosor de fila. |
| Fuentes del chat | `src/components/chat/ChatMessage.tsx`, bloque `message.skills` | Todas las herramientas se pintan igual: un chip con check o triángulo, verde o ámbar. El usuario no puede distinguir una lectura de meteo de una de GitHub, y no hay sitio único donde añadir una tarjeta nueva. |

## Principios de la rebanada

1. **Tokens antes que clases sueltas.** Si un color significa algo (avisó, falló, está caducado), tiene nombre. Los grises y verdes decorativos se quedan como están.
2. **Una anatomía por tipo de dato.** Dos listas del mismo dato (clasificación) se leen igual aunque una venga del servidor y otra del navegador.
3. **La ausencia de dato es un estado, no un vacío.** "No hay migración", "no hay sesión" y "la API falló" son tres cosas distintas y deben verse distintas.
4. **Nada de clases construidas con plantillas.** Tailwind no ve `border-${tone}/30`; todos los mapas de color son objetos literales.

---

## 1. Tokens de severidad y de estado del dato

### 1.1 `src/index.css` — añadir al final del bloque `:root`

```css
    /* Severidad: un eje único para avisos del sistema (portero de la liga,
       fuentes del chat, estado de la tabla). Se apoyan en los `--glow-*` que
       ya existen para no inventar una segunda paleta. */
    --severity-ok: var(--glow-green);        /* 120 100% 50% */
    --severity-info: var(--glow-cyan);       /* 187 100% 50% */
    --severity-warn: var(--glow-amber);      /* 43 100% 50% */
    --severity-critical: var(--glow-red);    /* 0 100% 70% */
    --severity-unknown: 220 10% 55%;         /* gris: no hay dato */

    /* Estado del dato: ortogonal a la severidad. Un dato viejo no es un error. */
    --data-live: var(--glow-green);
    --data-stale: var(--glow-amber);
    --data-fallback: var(--glow-cyan);
    --data-unavailable: var(--glow-red);
```

No hace falta repetirlos en `.dark`: ese bloque redefine la paleta base, pero no borra las variables que no menciona. Si algún día se quiere un crítico más apagado en oscuro, se añade ahí y sólo ahí.

> Nota sobre opacidad: se mantiene el formato del resto de tokens (`hsl(var(--x))`), que es el que ya usan `border-primary/40` y compañía en toda la UI. Si algún modificador `/20` no compilara, la alternativa es `hsl(var(--severity-warn) / <alpha-value>)` sólo en esas cinco entradas.

### 1.2 `tailwind.config.ts` — dentro de `theme.extend.colors`

```ts
        severity: {
          ok: "hsl(var(--severity-ok))",
          info: "hsl(var(--severity-info))",
          warn: "hsl(var(--severity-warn))",
          critical: "hsl(var(--severity-critical))",
          unknown: "hsl(var(--severity-unknown))",
        },
        data: {
          live: "hsl(var(--data-live))",
          stale: "hsl(var(--data-stale))",
          fallback: "hsl(var(--data-fallback))",
          unavailable: "hsl(var(--data-unavailable))",
        },
```

Clases resultantes: `text-severity-warn`, `border-severity-critical/50`, `bg-data-stale/10`, etc.

### 1.3 `src/components/SeverityBadge.tsx` (nuevo)

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Severity = "ok" | "info" | "warn" | "critical" | "unknown";
export type DataState = "live" | "stale" | "fallback" | "unavailable";

/** Mapa literal: Tailwind no puede leer clases construidas con plantillas. */
export const SEVERITY_CLASS: Record<Severity, string> = {
  ok: "border-severity-ok/40 bg-severity-ok/10 text-severity-ok",
  info: "border-severity-info/40 bg-severity-info/10 text-severity-info",
  warn: "border-severity-warn/50 bg-severity-warn/10 text-severity-warn",
  critical: "border-severity-critical/50 bg-severity-critical/10 text-severity-critical",
  unknown: "border-severity-unknown/40 bg-severity-unknown/10 text-severity-unknown",
};

const DATA_CLASS: Record<DataState, string> = {
  live: "text-data-live",
  stale: "text-data-stale",
  fallback: "text-data-fallback",
  unavailable: "text-data-unavailable",
};

export function SeverityBadge({
  severity,
  dataState,
  icon,
  children,
  title,
}: {
  severity: Severity;
  dataState?: DataState;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      data-severity={severity}
      data-state={dataState}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        SEVERITY_CLASS[severity],
      )}
    >
      {icon}
      {children}
      {dataState && (
        <span className={cn("ml-0.5 text-[8px] normal-case tracking-normal opacity-80", DATA_CLASS[dataState])}>
          {dataState}
        </span>
      )}
    </span>
  );
}
```

### 1.4 Contrato de uso

| Severidad | Cuándo | Dónde se estrena |
|---|---|---|
| `ok` | el dato llegó y es de esta petición | liga `ready`, fuente del chat con `ok` |
| `info` | informativo o en curso | liga `loading`, tarjeta de herramienta neutra |
| `warn` | el sistema funciona a medias | liga `missing` (migración sin aplicar), fuente que devolvió vacío |
| `critical` | el dato no se pudo leer | liga `error`, fuente del chat con `error` |
| `unknown` | no hay dato que juzgar | liga `anon`, historial local (vive en el navegador) |

**No se renombra nada existente**: `primary`, `secondary`, `accent` y `destructive` siguen igual y las clases actuales siguen compilando. Esto es aditivo a propósito.

### 1.5 Criterios de aceptación

- `bg-severity-warn/10` y `text-data-stale` aparecen en el CSS compilado (`npm run build` y buscar en `dist/assets/*.css`).
- Cambiar `--severity-warn` a mano en el inspector cambia el color de un `SeverityBadge` sin tocar clases.
- Ninguna clase existente deja de compilar: el diff de `dist` sólo añade.

---

## 2. Una sola anatomía para las dos clasificaciones de Juegos

### 2.1 Qué se unifica y qué no

Se unifica el **marco y la fila**: borde, cabecera, tono, métricas (`w-5` para el puesto, `flex-1` para el nombre, `w-14` a la derecha para los puntos), tipografía (`font-mono text-[10px]`) y los estados vacío/cargando/error. **No** se unifican las columnas: el servidor tiene partidas y el historial local tiene fecha, y forzarlas a la misma forma obligaría a inventar datos.

La diferencia entre ambas queda codificada en el tono: servidor = `ok`/`info`, historial local = `unknown`.

### 2.2 `src/components/games/LeaguePanel.tsx` (nuevo)

```tsx
import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import { SeverityBadge, type Severity } from "@/components/SeverityBadge";
import { cn } from "@/lib/utils";

export type LeagueStatus = "loading" | "ready" | "missing" | "anon" | "error";

/** Estado de la liga del servidor → severidad. Se exporta para poder probarlo. */
export const LEAGUE_SEVERITY: Record<LeagueStatus, Severity> = {
  loading: "info",
  ready: "ok",
  missing: "warn",
  anon: "unknown",
  error: "critical",
};

const FRAME: Record<Severity, string> = {
  ok: "border-primary/30 bg-primary/5",
  info: "border-severity-info/30 bg-severity-info/5",
  warn: "border-severity-warn/40 bg-severity-warn/5",
  critical: "border-severity-critical/40 bg-severity-critical/5",
  unknown: "border-border/40 bg-card/40",
};

export function LeaguePanel({
  title,
  meta,
  severity,
  children,
}: {
  title: ReactNode;
  meta: string;
  severity: Severity;
  children: ReactNode;
}) {
  return (
    <section data-severity={severity} className={cn("rounded-xl border", FRAME[severity])}>
      <header className="flex items-center gap-2 border-b border-border/20 px-3 py-2">
        <Trophy className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        <h3 className="font-heading text-[10px] uppercase tracking-widest text-foreground/85">{title}</h3>
        <span className="ml-auto">
          <SeverityBadge severity={severity}>{meta}</SeverityBadge>
        </span>
      </header>
      <div className="py-1">{children}</div>
    </section>
  );
}

/** Una línea de clasificación. Mismas medidas en las dos tablas. */
export function LeagueRow({
  leading,
  label,
  aside,
  value,
  highlight = false,
}: {
  leading: ReactNode;
  label: ReactNode;
  aside?: ReactNode;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 font-mono text-[10px]",
        highlight && "bg-secondary/5",
      )}
    >
      <span className="w-5 shrink-0 text-muted-foreground/40">{leading}</span>
      <span className={cn("min-w-0 flex-1 truncate", highlight ? "text-secondary" : "text-foreground/85")}>
        {label}
      </span>
      {aside != null && <span className="shrink-0 text-muted-foreground/45">{aside}</span>}
      <span className={cn("w-14 shrink-0 text-right", highlight ? "text-secondary" : "text-primary")}>
        {value}
      </span>
    </li>
  );
}

export function LeagueEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-dashed border-border/50 px-3 py-5 text-center">
      <Trophy className="mx-auto h-5 w-5 text-muted-foreground/40" />
      <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">{children}</p>
    </div>
  );
}
```

### 2.3 `src/components/games/GamesTab.tsx` — hunk del bloque `liga`

Se borra el `<div className="rounded-xl border border-primary/30 bg-primary/5">…</div>` completo (cabecera incluida) y el `<ol>` del historial local, y se sustituyen por:

```tsx
{/* Clasificación real: la calcula el servidor, no el navegador. */}
<LeaguePanel
  title={`Clasificación · ${league.status === "ready" ? league.season : seasonOf(today)}`}
  meta={`servidor · ${league.status}`}
  severity={LEAGUE_SEVERITY[league.status]}
>
  {league.status === "loading" && (
    <p className="px-3 py-4 font-mono text-[10px] text-muted-foreground/55">
      Leyendo la tabla de la temporada…
    </p>
  )}
  {league.status === "missing" && (
    <p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-severity-warn">
      La tabla existe en código pero no en la base: falta aplicar{" "}
      <code className="mx-1 rounded bg-muted/40 px-1">supabase/migrations/20261107210000_game_league.sql</code>
      . Mientras tanto se juega igual y manda el historial del navegador.
    </p>
  )}
  {league.status === "anon" && (
    <p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
      La clasificación es pública; para puntuar hace falta sesión iniciada.
    </p>
  )}
  {league.status === "error" && (
    <p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-severity-critical">
      No se pudo leer la clasificación del servidor. Tu historial local sigue intacto.
    </p>
  )}
  {league.status === "ready" &&
    (league.rows.length === 0 ? (
      <LeagueEmpty>Nadie ha puntuado esta temporada: la primera partida abre la tabla.</LeagueEmpty>
    ) : (
      <ol className="divide-y divide-border/20">
        {league.rows.map((row) => (
          <LeagueRow
            key={`${row.rank}-${row.handle}`}
            leading={row.rank}
            label={row.handle}
            aside={`${row.runs} p`}
            value={`${row.points} pts`}
            highlight={league.me?.rank === row.rank}
          />
        ))}
      </ol>
    ))}
  {league.status === "ready" && league.me && (
    <p className="border-t border-border/20 px-3 py-1.5 font-mono text-[9px] text-secondary">
      Tú: puesto {league.me.rank} · {league.me.points} pts · mejor marca {league.me.best}
    </p>
  )}
</LeaguePanel>

<h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/60">
  Tu historial local
</h3>

<LeaguePanel title="Historial del navegador" meta="sin sesión" severity="unknown">
  {ladder.length === 0 ? (
    <LeagueEmpty>Sin partidas esta temporada. Juega una y aparece aquí.</LeagueEmpty>
  ) : (
    <ol className="divide-y divide-border/40">
      {ladder.map((run, index) => (
        <LeagueRow
          key={`${run.at}-${index}`}
          leading={index + 1}
          label={`${GAME_NAME[run.game]}${run.daily ? " · reto" : ""}`}
          aside={new Date(run.at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
          value={`+${run.points}`}
        />
      ))}
    </ol>
  )}
</LeaguePanel>
```

Imports que cambian en `GamesTab.tsx`:

```tsx
import { LEAGUE_SEVERITY, LeagueEmpty, LeaguePanel, LeagueRow } from "./LeaguePanel";
```

`Trophy` ya está importado en el fichero; si queda sin uso tras quitar el estado vacío propio, se quita del `import` de `lucide-react` (el compilador de TypeScript no falla por un import sin usar, pero el lint sí).

### 2.4 `src/components/games/LeaguePanel.test.tsx` (nuevo)

```tsx
import { describe, expect, it } from "vitest";
import { LEAGUE_SEVERITY } from "./LeaguePanel";

describe("LEAGUE_SEVERITY", () => {
  it("distingue las cinco salidas de la liga", () => {
    expect(new Set(Object.values(LEAGUE_SEVERITY)).size).toBe(5);
  });

  it("trata la migración ausente como aviso, no como error", () => {
    expect(LEAGUE_SEVERITY.missing).toBe("warn");
    expect(LEAGUE_SEVERITY.error).toBe("critical");
  });

  it("no pinta la liga sin sesión como fallo", () => {
    expect(LEAGUE_SEVERITY.anon).toBe("unknown");
  });
});
```

### 2.5 Criterios de aceptación

- En Juegos → Liga hay **una** cabecera por bloque, con el mismo alto de fila y la misma alineación de puntos que el historial local.
- Los cinco estados del servidor se distinguen por color y texto: `loading` cian, `ready` verde, `missing` ámbar, `anon` gris, `error` rojo.
- Con la fila propia en la tabla, aparece resaltada en lima (antes no se resaltaba).
- Sin sesión no se muestra ningún panel en rojo: sólo el de historial, en gris.
- Nada de `border-primary/30` hardcodeado en `GamesTab.tsx`.

---

## 3. Registro herramienta → tarjeta en el chat

### 3.1 El problema concreto

`ChatMessage.tsx` decide el color con `skill.ok` y elige entre `Check` y `AlertTriangle`. Eso significa que:

- una fuente que devolvió datos y una que devolvió vacío se ven idénticas si las dos traen `ok: true`;
- no hay forma de dar identidad a una herramienta (icono, nombre corto, orden);
- añadir una herramienta nueva no cambia nada visible.

Las herramientas existen y están separadas por fichero: `src/lib/mcp/tools/weather.ts`, `satellites.ts`, `osint.ts`, `github.ts`, `database.ts`.

### 3.2 `src/lib/chat-cards.ts` (nuevo)

```ts
export type ToolTone = "ok" | "info" | "warn" | "critical" | "unknown";
export type ToolIcon = "cloud" | "satellite" | "radar" | "github" | "database" | "wrench";

export interface ToolCardMeta {
  id: string;
  label: string;
  /** Nombres alternativos: ids namespaced, etiquetas en español, prefijos. */
  aliases: string[];
  icon: ToolIcon;
  tone: ToolTone;
  emptyHint: string;
}

export const TOOL_CARDS: Record<string, ToolCardMeta> = {
  weather: {
    id: "weather",
    label: "Meteo",
    aliases: ["meteo", "tiempo", "clima", "surface-weather"],
    icon: "cloud",
    tone: "info",
    emptyHint: "Sin lectura de superficie",
  },
  satellites: {
    id: "satellites",
    label: "Satélites",
    aliases: ["satelite", "satélites", "tle", "pases"],
    icon: "satellite",
    tone: "info",
    emptyHint: "Sin pases en la ventana",
  },
  osint: {
    id: "osint",
    label: "OSINT",
    aliases: ["radar", "fuentes abiertas"],
    icon: "radar",
    tone: "info",
    emptyHint: "Sin resultados públicos",
  },
  github: {
    id: "github",
    label: "GitHub",
    aliases: ["git", "repo", "repositorio"],
    icon: "github",
    tone: "info",
    emptyHint: "Sin respuesta de la API",
  },
  database: {
    id: "database",
    label: "Base de datos",
    aliases: ["db", "supabase", "base de datos", "sql"],
    icon: "database",
    tone: "info",
    emptyHint: "Consulta sin filas",
  },
};

export const FALLBACK_CARD: ToolCardMeta = {
  id: "generic",
  label: "Herramienta",
  aliases: [],
  icon: "wrench",
  tone: "unknown",
  emptyHint: "Sin datos",
};

/** Minúsculas, sin acentos y sin espacios de sobra. */
export function normalizeToolKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const BY_KEY: Record<string, ToolCardMeta> = Object.values(TOOL_CARDS).reduce(
  (acc, card) => {
    acc[normalizeToolKey(card.id)] = card;
    acc[normalizeToolKey(card.label)] = card;
    for (const alias of card.aliases) acc[normalizeToolKey(alias)] = card;
    return acc;
  },
  {} as Record<string, ToolCardMeta>,
);

export function resolveToolCard(raw: string | null | undefined): ToolCardMeta {
  const key = normalizeToolKey(raw);
  if (!key) return FALLBACK_CARD;
  if (BY_KEY[key]) return BY_KEY[key];
  // Nombres namespaced: `mcp__weather__get`, `weather.get`, `tool:weather`.
  const token = key.split(/[^a-z0-9]+/).find((part) => part in BY_KEY);
  return token ? BY_KEY[token] : FALLBACK_CARD;
}
```

### 3.3 `src/lib/chat-cards.test.ts` (nuevo)

```ts
import { describe, expect, it } from "vitest";
import { FALLBACK_CARD, TOOL_CARDS, normalizeToolKey, resolveToolCard } from "./chat-cards";

describe("resolveToolCard", () => {
  it("reconoce las cinco herramientas del MCP por su id", () => {
    for (const id of ["weather", "satellites", "osint", "github", "database"]) {
      expect(resolveToolCard(id).id).toBe(id);
    }
  });

  it("resuelve nombres namespaced por el token que conoce", () => {
    expect(resolveToolCard("mcp__weather__get").id).toBe("weather");
    expect(resolveToolCard("tools.github.search").id).toBe("github");
  });

  it("acepta la etiqueta en español y sin acentos", () => {
    expect(resolveToolCard("Meteo").id).toBe("weather");
    expect(resolveToolCard("satelites").id).toBe("satellites");
    expect(resolveToolCard("  Base de datos ").id).toBe("database");
  });

  it("no inventa: lo desconocido cae en la tarjeta genérica", () => {
    expect(resolveToolCard("quimica-cuantica")).toBe(FALLBACK_CARD);
    expect(resolveToolCard(null)).toBe(FALLBACK_CARD);
    expect(resolveToolCard("   ")).toBe(FALLBACK_CARD);
  });

  it("no hay dos tarjetas con el mismo id y todas tienen pista de vacío", () => {
    const ids = Object.values(TOOL_CARDS).map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of [...Object.values(TOOL_CARDS), FALLBACK_CARD]) {
      expect(card.emptyHint.length).toBeGreaterThan(0);
    }
  });

  it("normaliza mayúsculas, acentos y espacios", () => {
    expect(normalizeToolKey("  Satélites ")).toBe("satelites");
  });
});
```

### 3.4 `src/components/chat/ToolCard.tsx` (nuevo)

```tsx
import { AlertTriangle, Check, Cloud, Database, Github, Radar, Satellite, Wrench } from "lucide-react";
import { resolveToolCard, type ToolIcon } from "@/lib/chat-cards";
import { SEVERITY_CLASS, type Severity } from "@/components/SeverityBadge";
import { cn } from "@/lib/utils";

const ICONS: Record<ToolIcon, typeof Cloud> = {
  cloud: Cloud,
  satellite: Satellite,
  radar: Radar,
  github: Github,
  database: Database,
  wrench: Wrench,
};

/** Lo que hoy manda `useChat` en `message.skills`. */
export interface SkillReport {
  tool?: string;
  label: string;
  ok: boolean;
  error?: string;
}

export function ToolCard({ skill }: { skill: SkillReport }) {
  const card = resolveToolCard(skill.tool ?? skill.label);
  const severity: Severity = skill.ok ? card.tone : "critical";
  const Icon = ICONS[card.icon];

  return (
    <span
      data-tool={card.id}
      data-state={skill.ok ? "ok" : "error"}
      title={skill.ok ? card.label : (skill.error ?? card.emptyHint)}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        SEVERITY_CLASS[severity],
      )}
    >
      {skill.ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      <Icon className="h-2.5 w-2.5 opacity-70" aria-hidden="true" />
      {skill.label}
    </span>
  );
}
```

### 3.5 `src/components/chat/ChatMessage.tsx` — hunk

Se sustituye el `<div>` de `message.skills` por:

```tsx
{isUser && message.skills && message.skills.length > 0 && (
  <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Fuentes consultadas">
    {message.skills.map((skill) => (
      <ToolCard key={`${skill.tool ?? skill.label}-${skill.ok ? "ok" : "error"}`} skill={skill} />
    ))}
  </div>
)}
```

Imports: `+ import { ToolCard } from "./ToolCard";` y quitar `AlertTriangle` del import de `lucide-react` (sigue usándose `Check` para el botón de copiar).

### 3.6 `src/hooks/useChat.ts` — opcional pero recomendado

Añadir `tool?: string` al tipo del elemento de `skills` (hoy sólo `label`, `ok`, `error`). Sin ese campo, `resolveToolCard` cae a la etiqueta, que también funciona; con él, la tarjeta no depende del idioma del texto.

### 3.7 Criterios de aceptación

- Una fuente con `ok: true` de meteo se ve cian con icono de nube; una de GitHub, cian con el icono de GitHub: se distinguen sin leer.
- Una fuente con `ok: false` se ve roja, con el `error` en el `title` (sigue siendo visible al pasar el ratón, como hoy).
- Una herramienta desconocida pinta la tarjeta genérica gris, no rompe el render.
- `message.skills` vacío o ausente no pinta nada.

---

## Orden de implementación

1. **Tokens** (`index.css`, `tailwind.config.ts`, `SeverityBadge.tsx`). Sin consumidores todavía; compila y no cambia nada visual.
2. **Clasificación** (`LeaguePanel.tsx`, `GamesTab.tsx`, test). Es donde el usuario ve el cambio.
3. **Chat** (`chat-cards.ts`, `ToolCard.tsx`, `ChatMessage.tsx`, test). Depende de los tokens del paso 1.

Cada paso es un commit independiente y reversibles por separado; ninguno toca base de datos, API ni `api/league.ts`.

## Checklist de verificación

- [ ] `npm run typecheck` en verde.
- [ ] `npm run test` en verde, con los dos ficheros nuevos incluidos.
- [ ] `npm run build` en verde y las clases nuevas presentes en el CSS emitido.
- [ ] Juegos → Liga a 360 px: los puntos no se cortan y las dos tablas alinean la columna derecha.
- [ ] Juegos → Liga sin sesión: sólo el panel gris del historial, ningún rojo.
- [ ] Chat con una fuente caída (`ok: false`): chip rojo, tooltip con el motivo.
- [ ] Chat con una herramienta inventada: chip genérico gris.

## Fuera de alcance (siguiente rebanada)

- Sustituir `accent`/`secondary` duplicados por los tokens nuevos en el resto de la app: son ~100 clases repartidas y merecen su propio PR con revisión visual.
- Convertir la clasificación en `<table>` real (hoy es `<ol>` y funciona para lectores de pantalla con el orden del DOM; el salto a tabla pide `scope` y cabeceras).
- Persistir en el servidor el historial local y unificar ambas fuentes en una sola consulta.
- Arreglar `--destructive` en `.dark` (hoy `0 62% 30%` frente a `0 84% 60%`), que es un bug de contraste independiente de esta rebanada.

## Referencias

- Auditoría de la que sale la rebanada: issue #86.
- Tokens existentes: `src/index.css` (`:root`, `.dark`, `--glow-*`), `tailwind.config.ts`.
- Clasificación: `src/components/games/GamesTab.tsx` (bloque `section === "liga"`), datos de `GET /api/league` y de `seasonLadder`.
- Chat: `src/components/chat/ChatMessage.tsx`, `src/lib/mcp/tools/*`.
