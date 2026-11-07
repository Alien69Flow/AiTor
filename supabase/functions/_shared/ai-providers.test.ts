import { describe, expect, it } from "vitest";
import {
  attachProbes,
  buildChatHealth,
  keyState,
  probeOracles,
  PROVIDERS,
  type OracleProbeCall,
} from "./ai-providers";

/**
 * La sonda del informe de salud es lo único que distingue "hay una clave" de
 * "el oráculo responde": una clave revocada, un proveedor caído o un modelo
 * retirado pasaban el chequeo de la clave y fallaban en la primera pregunta.
 *
 * Estas pruebas fijan que la sonda llama de verdad, que distingue los códigos
 * de estado, que respeta el tope de tiempo y que un error nunca arrastra la
 * credencial al informe.
 */

const CLAVE_VALIDA = "AIzaSyDUMMYKEY1234567890abcdef";

function envCon(claves: Record<string, string>) {
  return (name: string) => claves[name] ?? process.env[name];
}

describe("sonda de oráculos del informe de salud", () => {
  it("sólo sondea los proveedores con clave que parece real", async () => {
    const llamados: string[] = [];
    const call: OracleProbeCall = async (model) => {
      llamados.push(model);
      return { ok: true, status: 200 };
    };

    const probes = await probeOracles(
      envCon({ LOVABLE_API_KEY: CLAVE_VALIDA }),
      call,
    );

    expect(llamados).toEqual([...PROVIDERS.find((p) => p.id === "lovable")!.models]);
    expect(probes.every((probe) => probe.provider === "lovable")).toBe(true);
    expect(probes.every((probe) => probe.ok && probe.status === 200)).toBe(true);
  });

  it("no llama a nada si la clave es un marcador de posición", async () => {
    let llamadas = 0;
    const probes = await probeOracles(
      envCon({ LOVABLE_API_KEY: "cambia-esto" }),
      async () => {
        llamadas += 1;
        return { ok: true, status: 200 };
      },
    );

    expect(llamadas).toBe(0);
    expect(probes).toEqual([]);
    expect(keyState("cambia-esto")).toBe("placeholder");
  });

  it("marca el fallo con su código HTTP y mide la latencia", async () => {
    let t = 0;
    const probes = await probeOracles(
      envCon({ LOVABLE_API_KEY: CLAVE_VALIDA }),
      async (model) =>
        model === "openai/gpt-5"
          ? { ok: false, status: 401 }
          : { ok: true, status: 200 },
      { now: () => (t += 25) },
    );

    const caido = probes.find((probe) => probe.model === "openai/gpt-5");
    expect(caido).toMatchObject({ ok: false, status: 401 });
    // Las sondas van en paralelo: la latencia se mide, no se fija.
    expect(Number.isFinite(caido?.ms)).toBe(true);
    expect(caido?.ms).toBeGreaterThanOrEqual(0);
    expect(probes.filter((probe) => probe.ok).length).toBe(probes.length - 1);
  });

  it("corta al proveedor que se cuelga en vez de colgar el informe", async () => {
    const probes = await probeOracles(
      envCon({ LOVABLE_API_KEY: CLAVE_VALIDA }),
      () => new Promise<never>(() => undefined),
      { timeoutMs: 20, models: ["google/gemini-2.5-flash"] },
    );

    expect(probes).toHaveLength(1);
    expect(probes[0]).toMatchObject({ ok: false, status: null });
    expect(probes[0].error).toMatch(/tiempo agotado/);
  });

  it("no deja escapar una credencial en el mensaje de error", async () => {
    const probes = await probeOracles(
      envCon({ LOVABLE_API_KEY: CLAVE_VALIDA }),
      async () => {
        throw new Error(
          "falló https://api.example.com/v1?key=AIzaSySECRETO123&x=1 con Authorization: Bearer sk-abc.def",
        );
      },
      { models: ["google/gemini-2.5-flash"] },
    );

    expect(probes[0].error).not.toContain("AIzaSySECRETO123");
    expect(probes[0].error).not.toContain("sk-abc.def");
    expect(probes[0].error).toContain("key=***");
  });

  it("adjunta cada sonda a su modelo y resume cuántos respondieron", async () => {
    const health = buildChatHealth(envCon({ LOVABLE_API_KEY: CLAVE_VALIDA }));
    const probes = await probeOracles(
      envCon({ LOVABLE_API_KEY: CLAVE_VALIDA }),
      async (model) =>
        model === "google/gemini-2.5-pro"
          ? { ok: false, status: 503 }
          : { ok: true, status: 200 },
    );

    const conSonda = attachProbes(health, probes);

    expect(conSonda.probe).toMatchObject({ ok: probes.length - 1, total: probes.length });
    expect(conSonda.models.find((model) => model.id === "google/gemini-2.5-pro")?.probe).toMatchObject({
      ok: false,
      status: 503,
    });
    // Los modelos sin clave no se sondean y conservan el motivo del catálogo.
    expect(conSonda.models.find((model) => model.id === "xai/grok-2")?.probe).toBeUndefined();
    expect(conSonda.models.find((model) => model.id === "xai/grok-2")?.reason).toBe("missing-key");
  });
});
