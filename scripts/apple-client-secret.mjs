#!/usr/bin/env node
/**
 * Genera el «client secret» de Apple para Supabase.
 *
 * En Apple el secret NO es una contraseña: es un JWT firmado con ES256 usando la
 * clave `AuthKey_*.p8` del Apple Developer. Supabase lo pide en
 * **Authentication → Providers → Apple → Secret Key (for OAuth)** y lo usa como
 * `client_secret` en el intercambio del código.
 *
 *   iss = Team ID
 *   sub = Services ID (el identificador web, no el bundle de la app)
 *   aud = https://appleid.apple.com
 *   exp = iat + días (Apple no acepta más de 6 meses / 15 777 000 s)
 *
 * Uso:
 *   node scripts/apple-client-secret.mjs \
 *     --team-id ABCD1234E5 --key-id XYZ9876543 \
 *     --services-id space.alienflow.aitor.web \
 *     --key ~/AuthKey_XYZ9876543.p8 [--days 180]
 *
 * Variables equivalentes: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID,
 * APPLE_KEY_PATH. El JWT sale por stdout y por ningún otro sitio: es un secreto,
 * va al panel de Supabase y no al repositorio, a un log ni al chat.
 */
import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** Tope de Apple: 15 777 000 s (≈ 6 meses). */
export const APPLE_MAX_SECONDS = 15_777_000;

const ID_PATTERN = /^[A-Z0-9]{10}$/;
/** Services ID: dominio inverso, p. ej. `space.alienflow.aitor.web`. */
const SERVICES_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]{2,120}$/;

const base64url = (value) => Buffer.from(value).toString("base64url");

function fail(message) {
  throw new Error(message);
}

/**
 * Construye y firma el JWT. `privateKey` puede ser el PEM o una `KeyObject`.
 * Se valida todo antes de firmar para que un error de tecleo no acabe siendo un
 * `invalid_client` opaco en la pantalla de Apple.
 */
export function buildAppleClientSecret({
  teamId,
  keyId,
  servicesId,
  privateKey,
  days = 180,
  now = Math.floor(Date.now() / 1000),
}) {
  if (!ID_PATTERN.test(String(teamId ?? ""))) fail("team-id inválido: son 10 caracteres en mayúsculas (p. ej. ABCD1234E5)");
  if (!ID_PATTERN.test(String(keyId ?? ""))) fail("key-id inválido: son 10 caracteres en mayúsculas (el del archivo AuthKey_XXXXXXXXXX.p8)");
  if (!SERVICES_ID_PATTERN.test(String(servicesId ?? ""))) fail("services-id inválido: es el identificador web (p. ej. space.alienflow.aitor.web)");

  const key = typeof privateKey === "string" ? createPrivateKey(privateKey) : privateKey;
  if (key?.asymmetricKeyType !== "ec") fail("la clave no es EC: descarga la .p8 de Keys → «Sign in with Apple»");
  if (key?.asymmetricKeyDetails?.namedCurve !== "prime256v1") fail("la clave no es P-256; Apple exige ES256");

  const lifetime = Math.max(60, Math.min(Math.floor(days), 180) * 86_400);
  if (lifetime > APPLE_MAX_SECONDS) fail("Apple no acepta un secret de más de 6 meses");

  const header = { alg: "ES256", kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + lifetime,
    aud: "https://appleid.apple.com",
    sub: servicesId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // JWS exige la firma en IEEE P1363 (r||s); el formato DER por defecto no vale.
  const signature = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`falta el valor de --${name}`);
    out[name] = value;
    i += 1;
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const teamId = args["team-id"] ?? process.env.APPLE_TEAM_ID;
  const keyId = args["key-id"] ?? process.env.APPLE_KEY_ID;
  const servicesId = args["services-id"] ?? process.env.APPLE_SERVICES_ID;
  const keyPath = args.key ?? process.env.APPLE_KEY_PATH;
  const days = Number(args.days ?? 180);

  if (!keyPath) {
    fail(
      "falta --key: ruta del AuthKey_XXXXXXXXXX.p8 que descarga Apple Developer.\n" +
        "  node scripts/apple-client-secret.mjs --team-id ABCD1234E5 --key-id XYZ9876543 \\\n" +
        "    --services-id space.alienflow.aitor.web --key ~/AuthKey_XYZ9876543.p8",
    );
  }

  const token = buildAppleClientSecret({
    teamId,
    keyId,
    servicesId,
    privateKey: readFileSync(resolve(keyPath.replace(/^~/, process.env.HOME ?? "~")), "utf8"),
    days: Number.isFinite(days) ? days : 180,
  });

  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  console.error(
    `Apple client secret listo · sub ${payload.sub} · caduca el ${new Date(payload.exp * 1000).toISOString().slice(0, 10)}\n` +
      "Pégalo en Supabase → Authentication → Providers → Apple → Secret Key (for OAuth).\n" +
      "Es un secreto: no lo guardes en el repo ni lo pegues en un chat. Regenera antes de que caduque.",
  );
  process.stdout.write(`${token}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`\n✘ ${error.message}\n`);
    process.exit(1);
  }
}
