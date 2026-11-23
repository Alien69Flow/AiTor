import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOT_COMMANDS,
  COMMANDS_END,
  COMMANDS_START,
  commandNames,
  isBotCommand,
  renderCommandsMarkdown,
  renderHelpHtml,
} from "./bot-commands.js";
import { formatStatus } from "./bot-status.js";

// Vitest corre desde la raíz del repo; con `process.cwd()` no depende de cómo
// se transforme este módulo (con `import.meta.url` no siempre es un file: URL).
const root = process.cwd();
const webhookPath = resolve(root, "api/telegram-webhook.ts");
const agentsPath = resolve(root, "AGENTS.md");

describe("tabla de comandos", () => {
  it("no repite nombres ni alias", () => {
    const names = commandNames();
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^\/[a-z]+$/);
  });

  it("el webhook despacha exactamente lo que la tabla promete", () => {
    const source = readFileSync(webhookPath, "utf8");
    const dispatched = [...source.matchAll(/command\s*===\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(dispatched)).toEqual(new Set(commandNames()));
  });

  it("AGENTS.md lleva el bloque generado, sin deriva", () => {
    const doc = readFileSync(agentsPath, "utf8");
    const start = doc.indexOf(COMMANDS_START);
    const end = doc.indexOf(COMMANDS_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(doc.slice(start, end + COMMANDS_END.length)).toBe(renderCommandsMarkdown());
  });
});

describe("/ayuda", () => {
  const help = renderHelpHtml();

  it("lista cada comando con lo que hace", () => {
    for (const entry of BOT_COMMANDS) {
      expect(help).toContain(entry.command);
      expect(help).toContain(entry.summary);
    }
  });

  it("escapa los ejemplos para el HTML de Telegram", () => {
    expect(help).toContain("&gt;");
    expect(help).not.toContain("BTC > 95000");
  });

  it("reconoce también los alias con @bot", () => {
    expect(isBotCommand("/start@Alien69Bot")).toBe(true);
    expect(isBotCommand("/help")).toBe(true);
    expect(isBotCommand("/noexiste")).toBe(false);
  });
});

describe("/estado", () => {
  it("avisa de lo que falta en vez de pintarlo en verde", () => {
    const text = formatStatus({
      signed: false,
      memory: { configured: false, messages: null },
      alerts: { configured: false, count: null, max: 10 },
      dedupe: false,
      knowledgeBlocks: 4,
      supabaseKeyKind: "jwt",
    });
    expect(text.match(/⚠️/g)?.length).toBe(4);
    expect(text).toContain("4 bloque(s)");
    expect(text).toContain("<code>jwt</code>");
  });

  it("cuenta el hilo y las alertas cuando hay almacén", () => {
    const text = formatStatus({
      signed: true,
      memory: { configured: true, messages: 6 },
      alerts: { configured: true, count: 2, max: 10 },
      dedupe: true,
      knowledgeBlocks: 4,
      supabaseKeyKind: "jwt",
    });
    expect(text).toContain("6 mensaje(s)");
    expect(text).toContain("2 de 10");
    expect(text).not.toContain("⚠️");
  });
});
