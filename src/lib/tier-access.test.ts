import { describe, expect, it } from "vitest";
import { resolveTier } from "./tier-access";
import { TIER_RANK } from "./globe-layers";

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
