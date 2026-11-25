import { describe, expect, it } from "vitest";
import { clientIp, firstForwardedIp } from "./guard";

const headers = (values: Record<string, string>) => new Headers(values);

// Misma tabla que api/_shared/types.test.ts: si una de las dos copias de la
// regla se desvía, este test y el del lado Node dejan de coincidir.
describe("una sola regla de IP (lado Deno)", () => {
  it("toma el primer valor de x-forwarded-for", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
    expect(clientIp(headers({ "x-forwarded-for": "  203.0.113.7  , 70.41.3.18" }))).toBe("203.0.113.7");
  });

  it("salta los segmentos vacíos en vez de devolver cadena vacía", () => {
    expect(firstForwardedIp(" , 70.41.3.18")).toBe("70.41.3.18");
    expect(clientIp(headers({ "x-forwarded-for": " , 70.41.3.18" }))).toBe("70.41.3.18");
  });

  it("cae a x-real-ip y después a cf-connecting-ip", () => {
    expect(clientIp(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.4", "cf-connecting-ip": "192.0.2.9" }))).toBe(
      "198.51.100.4",
    );
    expect(clientIp(headers({ "cf-connecting-ip": "192.0.2.9" }))).toBe("192.0.2.9");
  });

  it("la cadena de proxies manda sobre las cabeceras sueltas", () => {
    const both = headers({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "198.51.100.4",
      "cf-connecting-ip": "192.0.2.9",
    });
    expect(clientIp(both)).toBe("203.0.113.7");
  });

  it("cf-connecting-ip ya no puede adelantar a la cadena de proxies", () => {
    // El agujero que tenía esta versión: bastaba mandar cf-connecting-ip.
    const spoofed = headers({
      "cf-connecting-ip": "192.0.2.9",
      "x-forwarded-for": "203.0.113.7",
    });
    expect(clientIp(spoofed)).toBe("203.0.113.7");
  });

  it("sin cabeceras usa remoteAddress y, si tampoco hay, `unknown`", () => {
    expect(clientIp(headers({}), "127.0.0.1")).toBe("127.0.0.1");
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "   " }), "127.0.0.1")).toBe("127.0.0.1");
  });
});
