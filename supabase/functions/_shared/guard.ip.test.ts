import { describe, expect, it } from "vitest";
import { clientIp, lastForwardedIp } from "./guard";

const headers = (values: Record<string, string>) => new Headers(values);

// Misma tabla que api/_shared/types.test.ts: si una de las dos copias de la
// regla se desvía, este test y el del lado Node dejan de coincidir.
describe("una sola regla de IP (lado Deno)", () => {
  it("toma el ÚLTIMO salto de x-forwarded-for", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    // El cliente antepone segmentos; el borde añade el suyo al final.
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("70.41.3.18");
    expect(clientIp(headers({ "x-forwarded-for": "  203.0.113.7  , 70.41.3.18  " }))).toBe(
      "70.41.3.18",
    );
  });

  it("salta los segmentos vacíos por los dos extremos", () => {
    expect(lastForwardedIp(" , 70.41.3.18")).toBe("70.41.3.18");
    expect(lastForwardedIp("203.0.113.7, ,   ")).toBe("203.0.113.7");
    expect(lastForwardedIp(" , ")).toBe("");
  });

  it("toma enteras las cabeceras de plataforma y prefiere x-vercel-forwarded-for", () => {
    expect(clientIp(headers({ "x-vercel-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(
      clientIp(headers({ "x-vercel-forwarded-for": "198.51.100.4", "x-real-ip": "203.0.113.7" })),
    ).toBe("198.51.100.4");
  });

  it("las cabeceras de plataforma mandan sobre la cadena de proxies", () => {
    const both = headers({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
      "x-real-ip": "198.51.100.4",
      "cf-connecting-ip": "192.0.2.9",
    });
    expect(clientIp(both)).toBe("198.51.100.4");
  });

  it("cf-connecting-ip ya no se consulta", () => {
    // Antes bastaba rotarla para estrenar cubo de rate limit; ahora no cambia
    // la clave, ni adelanta al último salto de la cadena.
    expect(clientIp(headers({ "cf-connecting-ip": "192.0.2.9" }))).toBe("unknown");
    const spoofed = headers({
      "cf-connecting-ip": "192.0.2.9",
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
    });
    expect(clientIp(spoofed)).toBe("70.41.3.18");
  });

  it("sin cabeceras usa remoteAddress y, si tampoco hay, `unknown`", () => {
    expect(clientIp(headers({}), "127.0.0.1")).toBe("127.0.0.1");
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "   " }), "127.0.0.1")).toBe("127.0.0.1");
  });
});
