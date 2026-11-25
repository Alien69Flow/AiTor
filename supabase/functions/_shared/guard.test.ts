import { describe, expect, it } from "vitest";
import { clientIp, guardPublic, isAllowedOrigin } from "./guard";

const request = (origin: string) => new Request("https://example.com/air-traffic", { headers: { origin } });

const requestWith = (headers: Record<string, string>) =>
  new Request("https://example.com/air-traffic", { headers });

describe("client IP for the rate limit", () => {
  it("usa la IP que escribe la plataforma", () => {
    expect(clientIp(requestWith({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("no deja estrenar cubo con cabeceras que escribe el visitante", () => {
    // `cf-connecting-ip` no la pone nadie de confianza en Edge Functions y el
    // primer salto de `x-forwarded-for` lo prefija quien llama: ninguno de los
    // dos puede decidir el cubo.
    expect(clientIp(requestWith({ "cf-connecting-ip": "203.0.113.7" }))).toBe("unknown");
    expect(
      clientIp(requestWith({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" })),
    ).toBe("198.51.100.9");
  });

  it("sin cabeceras cae en un único cubo", () => {
    expect(clientIp(requestWith({}))).toBe("unknown");
  });
});

describe("public feed origin permissions", () => {
  it.each([
    "https://aitor.lovable.app",
    "https://id-preview--2c5132b1-16ca-4d74-90b6-c7e7c79a842d.lovable.app",
    "https://preview--2c5132b1-16ca-4d74-90b6-c7e7c79a842d.lovable.app",
    "https://2c5132b1-16ca-4d74-90b6-c7e7c79a842d.lovableproject.com",
    "https://aitor.alienflow.space",
    "http://localhost:8080",
  ])("allows verified app origin %s", origin => {
    expect(isAllowedOrigin(request(origin))).toBe(true);
  });

  it.each(["https://other.lovable.app", "https://other.lovableproject.com", "https://2c5132b1-16ca-4d74-90b6-c7e7c79a842d.lovableproject.com.evil.example", "https://aitor.lovable.app.evil.example", "https://notalienflow.space", "null"])("rejects %s", origin => {
    expect(isAllowedOrigin(request(origin))).toBe(false);
  });

  it("preserves CORS headers on forbidden responses", () => {
    const response = guardPublic(request("https://evil.example"), { "Access-Control-Allow-Origin": "*" });
    expect(response?.status).toBe(403);
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
