import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  benignUpdate,
  fingerprint,
  formatReport,
  judge,
  SECRET_PATTERN,
} from "./telegram-signature-check.mjs";
import { main } from "./telegram-signature-check.mjs";

const probe = (status, body = "") => ({ status, body });
const SECRET = "secreto-de-prueba_123";

function report(probes, diagnostic = { secretConfigured: true, secretState: "ok" }) {
  return formatReport({
    url: "https://ejemplo.test/api/telegram-webhook",
    secret: SECRET,
    probes,
    diagnostic,
    result: judge(probes, diagnostic),
  });
}

describe("comprobación de la firma del webhook", () => {
  it("acepta la firma correcta y exige 401 a las otras dos", () => {
    const result = judge(
      { unsigned: probe(401), wrong: probe(401), signed: probe(200, "OK") },
      { secretConfigured: true, secretState: "ok" },
    );
    expect(result.ok).toBe(true);
    expect(result.verdict).toBe("ok");
  });

  it("falla si el endpoint acepta una entrega sin firma", () => {
    const result = judge(
      { unsigned: probe(200, "OK"), wrong: probe(401), signed: probe(200, "OK") },
      { secretConfigured: true, secretState: "ok" },
    );
    expect(result.ok).toBe(false);
    expect(result.verdict).toBe("gate-abierto");
  });

  it("llama 5xx lo que es: la función caída, no la firma", () => {
    const result = judge(
      { unsigned: probe(500), wrong: probe(500), signed: probe(500) },
      null,
    );
    expect(result.ok).toBe(false);
    expect(result.verdict).toBe("sin-401");
    expect(result.message).toContain("5xx");
  });

  it("distingue «no hay variable» de «hay otra variable»", () => {
    const probes = { unsigned: probe(401), wrong: probe(401), signed: probe(401) };
    const missing = judge(probes, { secretConfigured: false, secretState: "missing" });
    expect(missing.verdict).toBe("sin-variable");
    expect(missing.message).toContain("redespliega");

    const other = judge(probes, { secretConfigured: true, secretState: "ok" });
    expect(other.verdict).toBe("secreto-distinto");
    expect(other.message).toContain("--set");

    const unknown = judge(probes, null);
    expect(unknown.verdict).toBe("correcto-rechazado");
  });

  it("no imprime el secreto, pero sí su huella", () => {
    const text = report({ unsigned: probe(401), wrong: probe(401), signed: probe(200, "OK") });
    expect(text).not.toContain(SECRET);
    expect(text).toContain(fingerprint(SECRET));
    expect(text).toContain("nunca se imprime");
  });

  it("la entrega de prueba no lleva `message`, así que no gasta modelo", () => {
    const update = benignUpdate(123456);
    expect(update).not.toHaveProperty("message");
    expect(update).toHaveProperty("edited_message");
    expect(update.update_id).toBe(123456);
  });

  it("usa el mismo alfabeto que el servidor para el secreto", () => {
    expect(SECRET_PATTERN.test(SECRET)).toBe(true);
    expect(SECRET_PATTERN.test('"con comillas"')).toBe(false);
    expect(SECRET_PATTERN.test("a".repeat(257))).toBe(false);
    expect(SECRET_PATTERN.test("")).toBe(false);
  });

  it("recorre el camino completo contra un endpoint que firma bien", async () => {
    const server = createServer((req, res) => {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ secretConfigured: true, secretState: "ok" }));
        return;
      }
      const signed = req.headers["x-telegram-bot-api-secret-token"] === SECRET;
      res.writeHead(signed ? 200 : 401, { "Content-Type": "text/plain" });
      res.end(signed ? "OK" : "Unauthorized");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const previous = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    try {
      const code = await main([`--url=http://127.0.0.1:${port}`]);
      expect(code).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
      else process.env.TELEGRAM_WEBHOOK_SECRET = previous;
      server.close();
    }
  });
});
