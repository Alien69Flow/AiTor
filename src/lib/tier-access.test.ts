import { describe, expect, it } from "vitest";
import {
  REGISTERED_TIER,
  paidUntilMs,
  readPlanExpiry,
  resolveTier,
} from "./tier-access";
import { TIER_RANK } from "./globe-layers";

/** Reloj fijo: la caducidad no puede depender de la hora de la máquina. */
const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

/**
 * El caso que llegó al usuario: sesión iniciada y todas las capas de Node en
 * gris. Pasaba cuando la consulta de créditos fallaba y el estado se quedaba a
 * medias; aquí se fija que con sesión nunca se baja de Node.
 */
describe("plan efectivo del visitante", () => {
  it("sin sesión es el plan público", () => {
    expect(resolveTier({ authed: false })).toBe("signal");
    expect(resolveTier({ authed: false, paidTier: "pro" })).toBe("signal");
  });

  it("con sesión y sin fila de créditos es Node, no Signal", () => {
    expect(resolveTier({ authed: true })).toBe("node");
    expect(resolveTier({ authed: true, paidTier: null })).toBe("node");
  });

  it("con sesión y un valor que no conoce no se queda por debajo de Node", () => {
    expect(resolveTier({ authed: true, paidTier: "lo-que-sea" })).toBe("node");
    expect(resolveTier({ authed: true, paidTier: "" })).toBe("node");
  });

  it("los planes de pago se respetan tal cual", () => {
    expect(resolveTier({ authed: true, paidTier: "basic" })).toBe("synapse");
    expect(resolveTier({ authed: true, paidTier: "pro" })).toBe("oracle");
    expect(resolveTier({ authed: true, paidTier: "quantum" })).toBe("quantum");
  });

  it("un plan de pago nunca rebaja a Node", () => {
    for (const paid of ["registered", "basic", "pro", "quantum"]) {
      const tier = resolveTier({ authed: true, paidTier: paid });
      expect(TIER_RANK[tier]).toBeGreaterThanOrEqual(TIER_RANK.node);
    }
  });
});

describe("caducidad del plan de pago", () => {
  it("un plan con fecha futura sigue vigente", () => {
    expect(resolveTier({ authed: true, paidTier: "basic", paidUntil: inDays(3), now: NOW })).toBe(
      "synapse",
    );
    expect(resolveTier({ authed: true, paidTier: "quantum", paidUntil: inDays(300), now: NOW })).toBe(
      "quantum",
    );
  });

  it("un plan vencido cae al mínimo de la sesión aunque paid_tier diga otra cosa", () => {
    expect(resolveTier({ authed: true, paidTier: "basic", paidUntil: inDays(-1), now: NOW })).toBe(
      REGISTERED_TIER,
    );
    expect(resolveTier({ authed: true, paidTier: "quantum", paidUntil: inDays(-400), now: NOW })).toBe(
      REGISTERED_TIER,
    );
  });

  it("el instante exacto de vencimiento ya no da acceso", () => {
    expect(resolveTier({ authed: true, paidTier: "pro", paidUntil: inDays(0), now: NOW })).toBe(
      "node",
    );
  });

  it("sin fecha no hay caducidad: las filas anteriores y el acceso vitalicio se respetan", () => {
    expect(resolveTier({ authed: true, paidTier: "pro", paidUntil: null, now: NOW })).toBe("oracle");
    expect(resolveTier({ authed: true, paidTier: "basic", paidUntil: "", now: NOW })).toBe("synapse");
  });

  it("una fecha corrupta no degrada a quien pagó", () => {
    expect(resolveTier({ authed: true, paidTier: "basic", paidUntil: "ayer", now: NOW })).toBe(
      "synapse",
    );
  });

  it("caducar nunca sube de plan: sin sesión sigue siendo Signal", () => {
    expect(resolveTier({ authed: false, paidTier: "basic", paidUntil: inDays(-1), now: NOW })).toBe(
      "signal",
    );
  });

  it("acepta Date además de ISO", () => {
    const until = new Date(NOW + 86_400_000);
    expect(resolveTier({ authed: true, paidTier: "basic", paidUntil: until, now: NOW })).toBe(
      "synapse",
    );
    expect(paidUntilMs(until)).toBe(until.getTime());
  });
});

describe("aviso de renovación", () => {
  it("sin fecha no avisa de nada", () => {
    const expiry = readPlanExpiry({ paidUntil: null, now: NOW });
    expect(expiry).toEqual({
      expiresAt: null,
      daysLeft: null,
      expired: false,
      expiringSoon: false,
    });
  });

  it("avisa dentro de la ventana de siete días", () => {
    const expiry = readPlanExpiry({ paidUntil: inDays(3), now: NOW });
    expect(expiry.expiringSoon).toBe(true);
    expect(expiry.expired).toBe(false);
    expect(expiry.daysLeft).toBe(3);
    expect(expiry.expiresAt?.toISOString()).toBe(inDays(3));
  });

  it("no avisa si aún queda un mes", () => {
    expect(readPlanExpiry({ paidUntil: inDays(30), now: NOW }).expiringSoon).toBe(false);
  });

  it("el borde de la ventana entra y el día siguiente no", () => {
    expect(readPlanExpiry({ paidUntil: inDays(7), now: NOW }).expiringSoon).toBe(true);
    expect(readPlanExpiry({ paidUntil: inDays(8), now: NOW }).expiringSoon).toBe(false);
  });

  it("la ventana se puede estrechar", () => {
    const expiry = readPlanExpiry({ paidUntil: inDays(3), now: NOW, warningDays: 2 });
    expect(expiry.expiringSoon).toBe(false);
  });

  it("vencido se marca como vencido, no como próximo", () => {
    const expiry = readPlanExpiry({ paidUntil: inDays(-2), now: NOW });
    expect(expiry.expired).toBe(true);
    expect(expiry.expiringSoon).toBe(false);
    expect(expiry.daysLeft).toBe(-2);
  });

  it("los días se redondean hacia arriba: caduca hoy, quedan 0", () => {
    const soon = new Date(NOW + 3_600_000).toISOString();
    expect(readPlanExpiry({ paidUntil: soon, now: NOW }).daysLeft).toBe(1);
    expect(readPlanExpiry({ paidUntil: new Date(NOW).toISOString(), now: NOW }).daysLeft).toBe(0);
  });
});
