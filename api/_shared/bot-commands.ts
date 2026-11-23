/**
 * La única tabla de comandos del bot.
 *
 * Antes había tres listas: lo que el webhook atendía, el texto de `/help` y lo
 * que decía `AGENTS.md`. Ya no coincidían —`AGENTS.md` decía que el bot sólo
 * entendía `/alerta`— y eso es deriva, no documentación.
 *
 * Ahora hay una tabla y tres salidas:
 *
 *  - el webhook despacha por lo que hay aquí (y el test lo comprueba),
 *  - `/ayuda` se pinta desde aquí,
 *  - `npm run docs:comandos` reescribe el bloque de `AGENTS.md`.
 *
 * Añadir un comando es añadir una fila, un `else if` en `api/telegram-webhook.ts`
 * y regenerar. Si falta cualquiera de los tres, `api/_shared/bot-commands.test.ts`
 * falla.
 */

export interface BotCommand {
  /** El nombre canónico, con barra. */
  command: string;
  /** Otros nombres que hacen exactamente lo mismo. */
  aliases?: readonly string[];
  /** Una línea, en presente: qué hace hoy de verdad. */
  summary: string;
  /** Ejemplo de uso cuando lleva argumentos. */
  usage?: string;
  /** Si gasta cuota de un servicio externo (modelo, Manus) o sólo responde. */
  cost: "gratis" | "cuota";
}

export const BOT_COMMANDS: readonly BotCommand[] = [
  {
    command: "/ayuda",
    aliases: ["/help"],
    summary: "Esta lista, pintada desde la tabla que atiende los comandos.",
    cost: "gratis",
  },
  {
    command: "/estado",
    summary: "Qué está vivo ahora mismo: webhook, memoria, alertas, dedupe y conocimiento.",
    cost: "gratis",
  },
  {
    command: "/senal",
    summary: "Precio ahora mismo, con su fuente y la hora del dato, servido desde /api/signal.",
    usage: "/senal BTC",
    cost: "gratis",
  },
  {
    command: "/alerta",
    summary: "Aviso de precio, movimiento, sismo o noticia nueva; se guarda y te aviso aquí.",
    usage: "/alerta BTC > 95000",
    cost: "gratis",
  },
  {
    command: "/manus",
    aliases: ["/investigar", "/analizar"],
    summary: "Manda una tarea larga a Manus AI y te trae el resultado.",
    usage: "/manus analiza las tendencias crypto de esta semana",
    cost: "cuota",
  },
  {
    command: "/start",
    summary: "Bienvenida y la lista de comandos.",
    cost: "gratis",
  },
  {
    command: "/web",
    summary: "Terminal web, con el mismo hilo de conversación.",
    cost: "gratis",
  },
  {
    command: "/app",
    summary: "Enlace a la Mini App de Alien69Bot.",
    cost: "gratis",
  },
  {
    command: "/dao",
    summary: "Qué es AlienFlow DAO.",
    cost: "gratis",
  },
];

/** Marcas que delimitan el bloque generado de `AGENTS.md`. */
export const COMMANDS_START = "<!-- comandos:inicio -->";
export const COMMANDS_END = "<!-- comandos:fin -->";

/** Todos los nombres que el bot reconoce: canónicos y alias, en minúsculas. */
export function commandNames(): string[] {
  return BOT_COMMANDS.flatMap((entry) => [entry.command, ...(entry.aliases ?? [])]).map((name) =>
    name.toLowerCase(),
  );
}

/** ¿Es un comando del bot (o un alias suyo)? */
export function isBotCommand(name: string): boolean {
  return commandNames().includes(name.trim().toLowerCase().split("@")[0]);
}

/**
 * HTML para Telegram. Se escapa porque los ejemplos llevan `>` y `<`, y un
 * mensaje con `&lt;` mal puesto rompe el parse de Telegram y no llega nada.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Lo que contesta `/ayuda`: se pinta de la tabla, no de un literal aparte. */
export function renderHelpHtml(): string {
  const lines = BOT_COMMANDS.map((entry) => {
    const alias = entry.aliases?.length ? ` <i>(${entry.aliases.join(", ")})</i>` : "";
    const usage = entry.usage ? `\n<code>${escapeHtml(entry.usage)}</code>` : "";
    const cost = entry.cost === "cuota" ? " · <i>gasta cuota</i>" : "";
    return `<b>${entry.command}</b>${alias} — ${escapeHtml(entry.summary)}${cost}${usage}`;
  });

  return [
    "<b>Comandos que respondo hoy</b>",
    "",
    lines.join("\n\n"),
    "",
    "Y sin comando: escríbeme y te contesto.",
  ].join("\n");
}

/** El bloque de `AGENTS.md`, entre las dos marcas. */
export function renderCommandsMarkdown(): string {
  const rows = BOT_COMMANDS.map((entry) => {
    const alias = entry.aliases?.length
      ? entry.aliases.map((name) => `\`${name}\``).join(", ")
      : "—";
    const usage = entry.usage ? `\`${entry.usage}\`` : "—";
    const cost = entry.cost === "cuota" ? "gasta cuota" : "—";
    return `| \`${entry.command}\` | ${alias} | ${entry.summary} | ${usage} | ${cost} |`;
  });

  return [
    COMMANDS_START,
    "Generado por `npm run docs:comandos` desde `api/_shared/bot-commands.ts`.",
    "No lo edites a mano: `api/_shared/bot-commands.test.ts` falla si no coincide con la tabla.",
    "",
    "| Comando | Alias | Qué hace | Uso | Coste |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Sin comando, el mensaje va al chat: es la vía para preguntar en lenguaje natural.",
    COMMANDS_END,
  ].join("\n");
}
