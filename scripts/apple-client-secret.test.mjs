import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { APPLE_MAX_SECONDS, buildAppleClientSecret } from "./apple-client-secret.mjs";

/**
 * El secret de Apple es el eslabón que nadie puede comprobar a ojo: si el JWT
 * está mal firmado, el panel de Supabase lo acepta igual y el fallo aparece como
 * `invalid_client` en la pantalla de Apple. Estas pruebas firman de verdad con
 * una clave P-256 generada al vuelo y verifican la firma.
 */
function ecKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    privateKey,
    publicKey,
    pem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

const decode = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));

describe("apple client secret", () => {
  it("firma un JWT ES256 verificable con los claims que espera Apple", () => {
    const { pem, publicKey } = ecKeyPair();
    const token = buildAppleClientSecret({
      teamId: "ABCD1234E5",
      keyId: "XYZ9876543",
      servicesId: "space.alienflow.aitor.web",
      privateKey: pem,
      now: 1_800_000_000,
    });

    const [header, , signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString("utf8"))).toEqual({
      alg: "ES256",
      kid: "XYZ9876543",
    });

    const claims = decode(token);
    expect(claims).toMatchObject({
      iss: "ABCD1234E5",
      aud: "https://appleid.apple.com",
      sub: "space.alienflow.aitor.web",
      iat: 1_800_000_000,
    });
    expect(claims.exp - claims.iat).toBe(180 * 86_400);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(APPLE_MAX_SECONDS);

    const ok = verify(
      "sha256",
      Buffer.from(`${header}.${token.split(".")[1]}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    expect(ok).toBe(true);
  });

  it("acota la vida del token a 6 meses", () => {
    const { pem } = ecKeyPair();
    const token = buildAppleClientSecret({
      teamId: "ABCD1234E5",
      keyId: "XYZ9876543",
      servicesId: "space.alienflow.aitor.web",
      privateKey: pem,
      days: 3650,
      now: 1_800_000_000,
    });
    const claims = decode(token);
    expect(claims.exp - claims.iat).toBe(180 * 86_400);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(APPLE_MAX_SECONDS);
  });

  it("rechaza identificadores mal escritos antes de firmar", () => {
    const { pem } = ecKeyPair();
    const base = {
      teamId: "ABCD1234E5",
      keyId: "XYZ9876543",
      servicesId: "space.alienflow.aitor.web",
      privateKey: pem,
    };
    expect(() => buildAppleClientSecret({ ...base, teamId: "abcd1234e5" })).toThrow(/team-id/);
    expect(() => buildAppleClientSecret({ ...base, keyId: "123" })).toThrow(/key-id/);
    expect(() => buildAppleClientSecret({ ...base, servicesId: "" })).toThrow(/services-id/);
  });

  it("rechaza una clave que no sea EC P-256", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() =>
      buildAppleClientSecret({
        teamId: "ABCD1234E5",
        keyId: "XYZ9876543",
        servicesId: "space.alienflow.aitor.web",
        privateKey,
      }),
    ).toThrow(/EC/);
  });
});
