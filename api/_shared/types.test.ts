import { describe, expect, it } from "vitest";
import { clientIp } from "./types";

const req = (headers: Record<string, string>) => ({ headers });

describe("clientIp", () => {
  it("usa x-vercel-forwarded-for, que la plataforma sobrescribe", () => {
    expect(
      clientIp(req({ "x-vercel-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.9" })),
    ).toBe("203.0.113.7");
  });

  it("cae a x-real-ip cuando falta la de Vercel", () => {
    expect(
      clientIp(req({ "x-real-ip": "198.51.100.9", "x-forwarded-for": "1.2.3.4, 198.51.100.9" })),
    ).toBe("198.51.100.9");
  });

  it("como último recurso toma el último salto de x-forwarded-for, no el que escribe el cliente", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("ignora cf-connecting-ip: la escribe el visitante, no la plataforma", () => {
    // Producción no está detrás de Cloudflare (CNAME a vercel-dns, apex a
    // 76.76.21.21) y los previews van directos a Vercel, así que esta cabecera
    // sólo puede venir de quien llama. Aceptarla estrenaba cubo por petición.
    expect(clientIp(req({ "cf-connecting-ip": "203.0.113.7" }))).toBe("unknown");
    expect(
      clientIp(req({ "cf-connecting-ip": "203.0.113.7", "x-real-ip": "198.51.100.9" })),
    ).toBe("198.51.100.9");
    expect(
      clientIp(req({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" })),
    ).toBe("198.51.100.9");
  });

  it("en local no hay cabeceras y todos caen en un mismo cubo 'unknown'", () => {
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
