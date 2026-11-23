import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

/** Proyecto de datos y funciones: donde viven las Edge Functions. */
const DATA_REF = "wkdtvrxavkhbifjtvvdw";
/** Proyecto de identidad: GoTrue con Google y `profiles`. No sirve funciones. */
const AUTH_REF = "pnyigikagdxqaogbiift";

const configRef = read("supabase/config.toml").match(
  /project_id\s*=\s*"([a-z0-9]+)"/,
)?.[1];
const botRef = read("api/telegram-webhook.ts").match(
  /'(https:\/\/([a-z0-9]+)\.supabase\.co)'/,
)?.[2];
const pkg = JSON.parse(read("package.json"));

/** El valor real de la constante, no una mención en un comentario. */
const fallback = (path, name) =>
  read(path).match(
    new RegExp(`${name}\\s*=\\s*'(https:\\/\\/([a-z0-9]+)\\.supabase\\.co)'`),
  )?.[2];
const literal = (path, name) =>
  read(path).match(
    new RegExp(
      `${name}\\s*=\\s*[\\s\\S]*?"(https:\\/\\/([a-z0-9]+)\\.supabase\\.co)"`,
    ),
  )?.[2];

describe("ref canónico del proyecto Supabase", () => {
  it("config.toml declara el proyecto al que llama el bot", () => {
    expect(configRef).toBe(DATA_REF);
    expect(botRef).toBe(configRef);
  });

  it("edge:deploy despliega en ese mismo proyecto", () => {
    const script = pkg.scripts["edge:deploy"];
    expect(script).toContain(`--project-ref ${configRef}`);
    expect(script).not.toContain(AUTH_REF);
  });

  it("deploy-all.mjs y la documentación de despliegue no mandan al de identidad", () => {
    expect(read("scripts/deploy-all.mjs")).toContain(`"${configRef}"`);
    // La documentación puede nombrar el proyecto de identidad (lo hace, para
    // explicar la contraprueba del 404), pero ningún `--project-ref` puede
    // apuntar allí: eso es lo que desplegaba donde nada responde.
    const doc = read("docs/edge-functions.md");
    const targets = [...doc.matchAll(/--project-ref\s+([a-z0-9]+)/g)].map(
      (m) => m[1],
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((ref) => ref === configRef)).toBe(true);
  });

  it("la identidad sigue en su proyecto y no se confunde con el de datos", () => {
    const client = "src/integrations/supabase/client.ts";
    // Las constantes, no los comentarios: client.ts nombra los dos refs al
    // explicarse, así que un `toContain` pasaría cambiando la de auth.
    expect(fallback(client, "AUTH_URL_FALLBACK")).toBe(AUTH_REF);
    expect(fallback(client, "DATA_URL_FALLBACK")).toBe(DATA_REF);
    expect(literal("api/mcp.ts", "const AUTH_URL")).toBe(AUTH_REF);
    expect(literal("api/league.ts", "const AUTH_URL")).toBe(AUTH_REF);
    // Si algún día se unifican, este test deja de tener sentido y hay que
    // borrarlo a conciencia, no "arreglarlo" cambiando las constantes de auth.
    expect(configRef).not.toBe(AUTH_REF);
  });
});
