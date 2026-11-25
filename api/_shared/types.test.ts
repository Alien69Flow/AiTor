import { describe, expect, it } from "vitest";
import { clientIp, firstForwardedIp, header, type ApiRequest } from "./types";

const req = (headers: Record<string, string | string[]>, socket?: string): ApiRequest => ({
  headers,
  ...(socket ? { socket: { remoteAddress: socket } } : {}),
});

describe("una sola regla de IP (lado Node)", () => {
  it("toma el primer valor de x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "  203.0.113.7  , 70.41.3.18" }))).toBe("203.0.113.7");
  });

  it("acepta el array que entrega Node y se queda con el primero", () => {
    expect(clientIp(req({ "x-forwarded-for": ["203.0.113.7", "10.0.0.1"] }))).toBe("203.0.113.7");
  });

  it("salta los segmentos vacíos en vez de devolver cadena vacía", () => {
    expect(firstForwardedIp(" , 70.41.3.18")).toBe("70.41.3.18");
    expect(clientIp(req({ "x-forwarded-for": " , 70.41.3.18" }))).toBe("70.41.3.18");
  });

  it("cae a x-real-ip y después a cf-connecting-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(req({ "x-real-ip": "198.51.100.4", "cf-connecting-ip": "192.0.2.9" }))).toBe(
      "198.51.100.4",
    );
    expect(clientIp(req({ "cf-connecting-ip": "192.0.2.9" }))).toBe("192.0.2.9");
  });

  it("la cadena de proxies manda sobre las cabeceras sueltas", () => {
    const both = req({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "198.51.100.4",
      "cf-connecting-ip": "192.0.2.9",
    });
    expect(clientIp(both)).toBe("203.0.113.7");
  });

  it("sin cabeceras usa el socket y, si tampoco hay, `unknown`", () => {
    expect(clientIp(req({}, "127.0.0.1"))).toBe("127.0.0.1");
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": "   " }, "127.0.0.1"))).toBe("127.0.0.1");
  });

  it("busca la cabecera sin distinguir mayúsculas", () => {
    expect(header(req({ "X-Forwarded-For": "203.0.113.7" }), "x-forwarded-for")).toBe("203.0.113.7");
  });
});
