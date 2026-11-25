import { describe, expect, it } from "vitest";
import { clientIp } from "./types";

const req = (headers: Record<string, string>) => ({ headers });

describe("clientIp", () => {
  it("prefiere cf-connecting-ip, que es lo único que sobrevive a Cloudflare", () => {
    expect(
      clientIp(
        req({
          "cf-connecting-ip": "203.0.113.7",
          // Borde de Cloudflare: la misma IP para todo el PoP.
          "x-real-ip": "172.70.1.1",
          "x-forwarded-for": "203.0.113.7, 172.70.1.1",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("sin Cloudflare usa x-real-ip, no el salto que inventa el cliente", () => {
    expect(
      clientIp(req({ "x-real-ip": "198.51.100.9", "x-forwarded-for": "1.2.3.4, 198.51.100.9" })),
    ).toBe("198.51.100.9");
  });

  it("como último recurso toma el primer salto de x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.9, 172.70.1.1" }))).toBe("198.51.100.9");
  });

  it("en local no hay cabeceras y todos caen en un mismo cubo 'unknown'", () => {
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
