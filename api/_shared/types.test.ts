import { describe, expect, it } from "vitest";
import { clientIp, header, lastForwardedIp, type ApiRequest } from "./types";

const req = (headers: Record<string, string | string[]>, socket?: string): ApiRequest => ({
  headers,
  ...(socket ? { socket: { remoteAddress: socket } } : {}),
});

describe("una sola regla de IP (lado Node)", () => {
  it("toma el ÚLTIMO salto de x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    // El cliente antepone segmentos; el borde añade el suyo al final.
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("70.41.3.18");
    expect(clientIp(req({ "x-forwarded-for": "  203.0.113.7  , 70.41.3.18  " }))).toBe(
      "70.41.3.18",
    );
  });

  it("acepta el array que entrega Node y aplica la regla al valor que llega", () => {
    expect(clientIp(req({ "x-forwarded-for": ["203.0.113.7", "10.0.0.1"] }))).toBe("203.0.113.7");
  });

  it("salta los segmentos vacíos por los dos extremos", () => {
    expect(lastForwardedIp(" , 70.41.3.18")).toBe("70.41.3.18");
    expect(lastForwardedIp("203.0.113.7, ,   ")).toBe("203.0.113.7");
    expect(lastForwardedIp(" , ")).toBe("");
  });

  it("toma enteras las cabeceras de plataforma y prefiere x-vercel-forwarded-for", () => {
    expect(clientIp(req({ "x-vercel-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(req({ "x-vercel-forwarded-for": "198.51.100.4", "x-real-ip": "203.0.113.7" }))).toBe(
      "198.51.100.4",
    );
  });

  it("las cabeceras de plataforma mandan sobre la cadena de proxies", () => {
    const both = req({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
      "x-real-ip": "198.51.100.4",
      "cf-connecting-ip": "192.0.2.9",
    });
    expect(clientIp(both)).toBe("198.51.100.4");
  });

  it("cf-connecting-ip ya no se consulta", () => {
    // Antes bastaba rotarla para estrenar cubo de rate limit; ahora no cambia
    // la clave, ni adelanta al último salto de la cadena.
    expect(clientIp(req({ "cf-connecting-ip": "192.0.2.9" }))).toBe("unknown");
    const spoofed = req({
      "cf-connecting-ip": "192.0.2.9",
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
    });
    expect(clientIp(spoofed)).toBe("70.41.3.18");
  });

  it("sin cabeceras usa el socket y, si tampoco hay, `unknown`", () => {
    expect(clientIp(req({}, "127.0.0.1"))).toBe("127.0.0.1");
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": "   " }, "127.0.0.1"))).toBe("127.0.0.1");
  });

  it("busca la cabecera sin distinguir mayúsculas", () => {
    expect(header(req({ "X-Vercel-Forwarded-For": "198.51.100.4" }), "x-vercel-forwarded-for")).toBe(
      "198.51.100.4",
    );
  });
});
