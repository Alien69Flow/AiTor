import { describe, expect, it } from "vitest";
import {
  ALTITUDE_BANDS,
  ROLE_LABELS,
  UNKNOWN_BAND,
  aircraftRole,
  altitudeBand,
} from "./aircraft-class";

/**
 * La capa de tráfico aéreo pintaba todos los contactos igual. Estas pruebas
 * fijan las dos decisiones que la hacen legible: los cortes de altitud —que es
 * lo que colorea el mapa— y la clasificación por tipo, con su regla más
 * importante: lo que no se puede asegurar no se afirma.
 */
describe("bandas de altitud", () => {
  it("cada corte cae en la banda que le toca", () => {
    expect(altitudeBand(0).id).toBe("bajo");
    expect(altitudeBand(2_999).id).toBe("bajo");
    expect(altitudeBand(3_000).id).toBe("ruta-corta");
    expect(altitudeBand(5_999).id).toBe("ruta-corta");
    expect(altitudeBand(8_999).id).toBe("regional");
    expect(altitudeBand(9_000).id).toBe("crucero");
    expect(altitudeBand(11_900).id).toBe("crucero");
    expect(altitudeBand(12_000).id).toBe("estratosfera");
    expect(altitudeBand(18_000).id).toBe("estratosfera");
  });

  it("sin altitud no se cae a la banda baja", () => {
    // Pintar de verde un contacto sin dato sería afirmar que vuela bajo.
    expect(altitudeBand(null)).toBe(UNKNOWN_BAND);
    expect(altitudeBand(undefined)).toBe(UNKNOWN_BAND);
    expect(altitudeBand(Number.NaN)).toBe(UNKNOWN_BAND);
    expect(altitudeBand(Number.POSITIVE_INFINITY)).toBe(UNKNOWN_BAND);
  });

  it("una lectura negativa del transpondedor se lee como suelo", () => {
    expect(altitudeBand(-400).id).toBe("bajo");
  });

  it("ninguna banda comparte color con otra", () => {
    const colors = [...ALTITUDE_BANDS, UNKNOWN_BAND].map((band) => band.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("las bandas están en orden y sin huecos", () => {
    for (let i = 1; i < ALTITUDE_BANDS.length; i += 1) {
      expect(ALTITUDE_BANDS[i].minKm).toBe(ALTITUDE_BANDS[i - 1].maxKm);
    }
    expect(ALTITUDE_BANDS[ALTITUDE_BANDS.length - 1].maxKm).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("tipo de vuelo", () => {
  it("reconoce militares por designador y por indicativo", () => {
    expect(aircraftRole({ aircraftType: "C130", callsign: "X" })).toBe("militar");
    expect(aircraftRole({ aircraftType: "K35R" })).toBe("militar");
    expect(aircraftRole({ callsign: "RCH317" })).toBe("militar");
    // El indicativo llega en minúsculas desde algunas fuentes.
    expect(aircraftRole({ callsign: "rrr2101" })).toBe("militar");
  });

  it("reconoce carga por indicativo de operador y por designador con F", () => {
    expect(aircraftRole({ callsign: "FDX1234", aircraftType: "B77F" })).toBe("carga");
    expect(aircraftRole({ callsign: "N123AB", aircraftType: "B77F" })).toBe("carga");
    expect(aircraftRole({ aircraftType: "A332F" })).toBe("carga");
  });

  it("no confunde un 777 de pasaje con un carguero", () => {
    expect(aircraftRole({ aircraftType: "B77W" })).toBe("pasajeros");
    expect(aircraftRole({ aircraftType: "B738", callsign: "IBE31A" })).toBe("pasajeros");
  });

  it("separa los vuelos de Estado de los militares", () => {
    expect(aircraftRole({ callsign: "SAM280" })).toBe("gobierno");
    expect(aircraftRole({ callsign: "SPAR19" })).toBe("gobierno");
  });

  it("la aviación general se reconoce por tipo o por categoría ligera", () => {
    expect(aircraftRole({ aircraftType: "C172" })).toBe("privado");
    expect(aircraftRole({ aircraftType: "GLF6" })).toBe("privado");
    expect(aircraftRole({ aircraftCategory: "A2", aircraftType: "ZZZZ" })).toBe("privado");
  });

  it("lo que no se puede asegurar es «otro», nunca «pasajeros»", () => {
    expect(aircraftRole({ callsign: "N12345" })).toBe("otro");
    expect(aircraftRole({ aircraftCategory: "A3", aircraftType: "ZZZZ" })).toBe("otro");
    expect(aircraftRole({})).toBe("otro");
  });

  it("un militar con matrícula civil sigue siendo militar por su tipo", () => {
    // Los aviones de Estado suelen volar con indicativos que no delatan nada.
    expect(aircraftRole({ callsign: "N610G", aircraftType: "C130" })).toBe("militar");
  });

  it("cada rol tiene nombre para la leyenda", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(6);
    expect(ROLE_LABELS.militar).toBe("Militar");
    expect(ROLE_LABELS.gobierno).toBe("Gubernamental");
  });
});
