import { describe, expect, it } from "vitest";
import { guardPublic, isAllowedOrigin } from "./guard";

const request = (origin: string) => new Request("https://example.com/osint", {
  headers: { origin },
});

describe("public proxy origin guard", () => {
  it.each([
    "https://aitor.lovable.app",
    "https://id-preview--2c5132b1-16ca-4d74-90b6-c7e7c79a842d.lovable.app",
    "https://preview--2c5132b1-16ca-4d74-90b6-c7e7c79a842d.lovable.app",
    "https://aitor.alienflow.space",
    "http://localhost:8080",
  ])("allows this app at %s", (origin) => {
    expect(isAllowedOrigin(request(origin))).toBe(true);
  });

  it.each([
    "https://another-project.lovable.app",
    "https://aitor.lovable.app.attacker.example",
    "https://notalienflow.space",
    "null",
  ])("rejects unrelated or malformed origin %s", (origin) => {
    expect(isAllowedOrigin(request(origin))).toBe(false);
  });

  it("keeps rejected origins forbidden with CORS on the error", () => {
    const response = guardPublic(request("https://attacker.example"), {
      "Access-Control-Allow-Origin": "*",
    });
    expect(response?.status).toBe(403);
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("does not grant access when origin and referer are absent", () => {
    expect(isAllowedOrigin(new Request("https://example.com/osint"))).toBe(false);
  });
});