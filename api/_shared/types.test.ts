import { describe, expect, it } from "vitest";
import { clientIp } from "./types";

const req = (headers: Record<string, string>) => ({ headers });

describe("clientIp", () => {
  it("usa las cabeceras que escribe la plataforma", () => {
    expect(clientIp(req({ "x-vercel-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("no deja estrenar cubo con cabeceras que escribe el visitante", () => {
    // `cf-connecting-ip` no la pone nadie de confianza y el primer salto de
    // `x-forwarded-for` lo escribe quien llama: ninguno cambia la identidad.
    expect(clientIp(req({ "cf-connecting-ip": "203.0.113.7" }))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("sin cabeceras cae en un único cubo", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
