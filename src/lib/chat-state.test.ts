import { describe, expect, test } from "bun:test";
import { normalizeChatHistory, readChatHistory, chatRequestError } from "./chat-state";

describe("chat state recovery", () => {
  test("rejects corrupt JSON and non-array saved values", () => {
    for (const raw of ["{", "null", "42", '{"error":"Invalid JSON in request body"}']) expect(normalizeChatHistory(raw)).toEqual([]);
  });
  test("filters malformed entries while preserving valid messages", () => {
    const history = normalizeChatHistory(JSON.stringify([null, { role: "user" }, { id: "a", role: "user", content: "Hello", timestamp: "bad", imageData: {} }]));
    expect(history).toEqual([{ id: "a", role: "user", content: "Hello", timestamp: new Date(0) }]);
  });
  test("unavailable storage cannot crash initialization", () => {
    expect(readChatHistory({ getItem: () => { throw new Error("SecurityError"); } }, "history")).toEqual([]);
  });
  test("HTTP 400 produces a recoverable user message without backend detail", () => {
    expect(chatRequestError(400)).toBe("No se pudo procesar el mensaje. Intenta enviarlo de nuevo.");
  });
});